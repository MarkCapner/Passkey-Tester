const assert = require("node:assert/strict");
const { test } = require("node:test");
const { METADATA_PATH, createMetadataService, parseMetadata } = require("../metadata-service");

test("parses combined AAGUID metadata", () => {
  assert.deepEqual(parseMetadata('{"ABC":{"name":"Authenticator"}}'), {
    ABC: { name: "Authenticator" }
  });
});

test("rejects malformed combined AAGUID metadata", () => {
  assert.throws(() => parseMetadata("not-json"), /invalid JSON/);
  assert.throws(() => parseMetadata("[]"), /must be an object/);
  assert.throws(() => parseMetadata("null"), /must be an object/);
});

test("reads combined metadata once and prefers the dark icon", async () => {
  let reads = 0;
  const service = createMetadataService({ readFileImpl: async (path, encoding) => {
    reads++;
    assert.equal(path, METADATA_PATH);
    assert.equal(encoding, "utf8");
    return JSON.stringify({ ABC: {
      name: "Authenticator name",
      icon_light: "data:image/png;base64,light",
      icon_dark: "data:image/png;base64,dark"
    } });
  } });
  assert.deepEqual(await service.find("abc"), {
    aaguid: "ABC",
    name: "Authenticator name",
    description: "Authenticator name",
    icon: "data:image/png;base64,dark"
  });
  assert.equal(await service.find("missing"), null);
  assert.equal(reads, 1);
});

test("falls back to a light icon when dark artwork is unavailable", async () => {
  const service = createMetadataService({ readFileImpl: async () => JSON.stringify({
    abc: { name: "Authenticator", icon_light: "data:image/png;base64,light" }
  }) });
  assert.equal((await service.find("ABC")).icon, "data:image/png;base64,light");
});
