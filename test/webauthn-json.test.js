const assert = require("node:assert/strict");
const { test } = require("node:test");
const { base64UrlToBytes, parseOptionsFromJson } = require("../webauthn-json");

test("decodes padded and unpadded base64url binary values", () => {
  assert.deepEqual([...base64UrlToBytes("__4")], [255, 254]);
  assert.deepEqual([...base64UrlToBytes("AQ==")], [1]);
});

test("fallback creation conversion handles user and excluded credential IDs", () => {
  const options = parseOptionsFromJson({
    challenge: "AQ", user: { id: "Ag", name: "user", displayName: "User" },
    excludeCredentials: [{ type: "public-key", id: "Aw", transports: ["usb"] }]
  }, "create", {});

  assert.deepEqual([...options.challenge], [1]);
  assert.deepEqual([...options.user.id], [2]);
  assert.deepEqual([...options.excludeCredentials[0].id], [3]);
  assert.deepEqual(options.excludeCredentials[0].transports, ["usb"]);
});

test("fallback request conversion handles allow lists and binary extension inputs", () => {
  const options = parseOptionsFromJson({
    challenge: "AQ", allowCredentials: [{ type: "public-key", id: "Ag" }],
    extensions: { largeBlob: { write: "Aw" }, prf: { eval: { first: "BA", second: "BQ" } } }
  }, "get", {});

  assert.deepEqual([...options.allowCredentials[0].id], [2]);
  assert.deepEqual([...options.extensions.largeBlob.write], [3]);
  assert.deepEqual([...options.extensions.prf.eval.first], [4]);
  assert.deepEqual([...options.extensions.prf.eval.second], [5]);
});

test("uses the browser's WebAuthn JSON parser when it is available", () => {
  const expected = { parsed: true };
  const browserApi = { parseCreationOptionsFromJSON: (value) => value.marker === 42 ? expected : null };
  assert.equal(parseOptionsFromJson({ marker: 42 }, "create", browserApi), expected);
});
