const assert = require("node:assert/strict");
const { test } = require("node:test");
const { inspectAttestation, lookupMetadata } = require("../authenticator-info");

function attestationWithAaguid(aaguid) {
  const hex = aaguid.replaceAll("-", "");
  const authData = new Uint8Array(53);
  authData[32] = 0x40;
  for (let index = 0; index < 16; index++) authData[37 + index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  const key = new TextEncoder().encode("authData");
  return Uint8Array.from([0xa1, 0x68, ...key, 0x58, authData.length, ...authData]).buffer;
}

test("extracts an AAGUID without relying on a hard-coded provider map", () => {
  assert.deepEqual(inspectAttestation(attestationWithAaguid("b5397666-4885-aa6b-cebf-e52262a439a2")), {
    aaguid: "b5397666-4885-aa6b-cebf-e52262a439a2", passwordManager: "Unknown authenticator"
  });
});

test("looks up an AAGUID through the local metadata endpoint without using a cached response", async () => {
  const metadata = await lookupMetadata("b5397666-4885-aa6b-cebf-e52262a439a2", async (url, options) => {
    assert.equal(url, "/api/metadata/b5397666-4885-aa6b-cebf-e52262a439a2");
    assert.deepEqual(options, { cache: "no-store" });
    return { ok: true, status: 200, json: async () => ({ description: "Example authenticator" }) };
  });
  assert.equal(metadata.description, "Example authenticator");
});

test("keeps an unrecognized AAGUID visible without guessing a provider", () => {
  const result = inspectAttestation(attestationWithAaguid("00000000-0000-0000-0000-000000000000"));
  assert.equal(result.aaguid, "00000000-0000-0000-0000-000000000000");
  assert.equal(result.passwordManager, "Unknown authenticator");
});
