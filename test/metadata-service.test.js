const assert = require("node:assert/strict");
const { test } = require("node:test");
const { CONVENIENCE_METADATA_URL, createMetadataService, normalizeEntries } = require("../metadata-service");

test("normalizes AAGUID-keyed convenience metadata", () => {
  assert.deepEqual(normalizeEntries({ ABC: { name: "Authenticator name" } }), [
    { aaguid: "ABC", name: "Authenticator name" }
  ]);
});

test("fetches convenience metadata once and resolves names and icons by AAGUID", async () => {
  let requests = 0;
  const service = createMetadataService({ fetchImpl: async (url, options) => {
    requests++;
    assert.equal(url, CONVENIENCE_METADATA_URL);
    assert.equal(options.headers.Accept, "application/json");
    return { ok: true, json: async () => ({ ABC: { name: "Authenticator name", icon_light: "data:image/svg+xml;base64,abc" } }) };
  } });
  assert.deepEqual(await service.find("abc"), {
    aaguid: "ABC",
    name: "Authenticator name",
    description: "Authenticator name",
    icon: "data:image/svg+xml;base64,abc"
  });
  assert.equal(await service.find("missing"), null);
  assert.equal(requests, 1);
});
