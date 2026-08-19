const assert = require("node:assert/strict");
const { test } = require("node:test");
const { METADATA_BLOB_PATH, createMetadataService, parseMetadataBlob } = require("../metadata-service");

function jwt(payload) {
  return `${Buffer.from('{"alg":"RS256"}').toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}

test("decodes entries from a FIDO metadata BLOB JWT", () => {
  const entries = [{ aaguid: "ABC", metadataStatement: { description: "Authenticator" } }];
  assert.deepEqual(parseMetadataBlob(jwt({ no: 1, entries })), entries);
});

test("rejects malformed FIDO metadata BLOBs", () => {
  assert.throws(() => parseMetadataBlob("not-a-jwt"), /invalid JWT format/);
  assert.throws(() => parseMetadataBlob("header.!!!.signature"), /invalid payload/);
  assert.throws(() => parseMetadataBlob(jwt({ no: 1 })), /no entries/);
});

test("reads the local BLOB once and resolves nested metadata by AAGUID", async () => {
  let reads = 0;
  const service = createMetadataService({ readFileImpl: async (path, encoding) => {
    reads++;
    assert.equal(path, METADATA_BLOB_PATH);
    assert.equal(encoding, "utf8");
    return jwt({ entries: [{
      aaguid: "ABC",
      metadataStatement: {
        friendlyNames: { "en-US": "Authenticator name" },
        description: "Authenticator description",
        icon: "data:image/svg+xml;base64,abc"
      }
    }] });
  } });
  assert.deepEqual(await service.find("abc"), {
    aaguid: "ABC",
    name: "Authenticator name",
    description: "Authenticator description",
    icon: "data:image/svg+xml;base64,abc"
  });
  assert.equal(await service.find("missing"), null);
  assert.equal(reads, 1);
});
