const assert = require("node:assert/strict");
const { test } = require("node:test");
const { fromCredential, provider } = require("../aaguid");

test("extracts an AAGUID from attested authenticator data", () => {
  const bytes = new Uint8Array(55);
  bytes[32] = 0x40;
  bytes.set([0xb5, 0x39, 0x76, 0x66, 0x48, 0x85, 0xaa, 0x6b, 0xce, 0xbf, 0xe5, 0x22, 0x62, 0xa4, 0x39, 0xa2], 37);
  const credential = { response: { getAuthenticatorData: () => bytes.buffer } };
  assert.equal(fromCredential(credential), "b5397666-4885-aa6b-cebf-e52262a439a2");
  assert.equal(provider(fromCredential(credential)), "1Password");
});

test("does not infer an AAGUID without attested credential data", () => {
  const bytes = new Uint8Array(55);
  assert.equal(fromCredential({ response: { getAuthenticatorData: () => bytes } }), null);
});
