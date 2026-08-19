const assert = require("node:assert/strict");
const { test } = require("node:test");
const { CONVENIENCE_METADATA_PATH, createMetadataService, normalizeEntries } = require("../metadata-service");

test("normalizes AAGUID-keyed convenience metadata", () => {
  assert.deepEqual(normalizeEntries({ no: 1, ABC: { name: "Authenticator name" } }), [
    { aaguid: "ABC", name: "Authenticator name" }
  ]);
});

test("reads local convenience metadata once and resolves names and icons by AAGUID", async () => {
  let reads = 0;
  const service = createMetadataService({ readFileImpl: async (path, encoding) => {
    reads++;
    assert.equal(path, CONVENIENCE_METADATA_PATH);
    assert.equal(encoding, "utf8");
    return JSON.stringify({ ABC: { friendlyNames: { "en-US": "Authenticator name" }, icon_light: "data:image/svg+xml;base64,abc" } });
  } });
  assert.deepEqual(await service.find("abc"), {
    aaguid: "ABC",
    name: "Authenticator name",
    description: "Authenticator name",
    icon: "data:image/svg+xml;base64,abc"
  });
  assert.equal(await service.find("missing"), null);
  assert.equal(reads, 1);
});
