const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { createServer } = require("../server");

let server;
let origin;

before(async () => {
  server = createServer({ metadataService: { find: async (aaguid) => aaguid.startsWith("b539") ? { aaguid, description: "Test authenticator", statusReports: [] } : null } });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

test("resolves AAGUID metadata through the server endpoint", async () => {
  const response = await fetch(`${origin}/api/metadata/b5397666-4885-aa6b-cebf-e52262a439a2`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).description, "Test authenticator");
  assert.equal(response.headers.get("cache-control"), "public, max-age=86400");
});

test("returns a successful, uncached null result for an absent AAGUID", async () => {
  const response = await fetch(`${origin}/api/metadata/d3452668-01fd-4c12-926c-83a4204853aa`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(await response.json(), null);
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("serves the application entry point", async () => {
  const response = await fetch(`${origin}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/html/);
  assert.match(await response.text(), /Passkey Tester/);
});

test("serves JavaScript and CSS assets instead of rejecting them", async () => {
  for (const [asset, type] of [["app.js", "text/javascript"], ["webauthn-json.js", "text/javascript"], ["styles.css", "text/css"]]) {
    const response = await fetch(`${origin}/${asset}`);
    assert.equal(response.status, 200, asset);
    assert.match(response.headers.get("content-type"), new RegExp(`^${type}`));
  }
});

test("returns 404 for files that do not exist", async () => {
  const response = await fetch(`${origin}/missing-file.js`);
  assert.equal(response.status, 404);
});
