const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createMetadataService, decodeBlob } = require("../metadata-service");

function jwt(payload) {
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}

test("decodes entries from an MDS JWT", () => {
  assert.equal(decodeBlob(jwt({ entries: [{ aaguid: "one" }] }))[0].aaguid, "one");
});

test("fetches MDS once and resolves descriptions by AAGUID", async () => {
  let requests = 0;
  const service = createMetadataService({ fetchImpl: async () => {
    requests++;
    return { ok: true, text: async () => jwt({ entries: [{ aaguid: "ABC", metadataStatement: { description: "Authenticator name" }, statusReports: [] }] }) };
  } });
  assert.equal((await service.find("abc")).description, "Authenticator name");
  assert.equal((await service.find("missing")), null);
  assert.equal(requests, 1);
});
