const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { createServer } = require("../server");

let server;
let origin;
const sharedData = { activity: [], credentials: [] };
const sharedStore = {
  list: async (kind) => sharedData[kind],
  merge: async (kind, records) => {
    for (const record of records) {
      const index = sharedData[kind].findIndex((item) => item.id === record.id);
      if (index >= 0) sharedData[kind][index] = record;
      else sharedData[kind].unshift(record);
    }
    return sharedData[kind];
  },
  clearActivity: async () => (sharedData.activity = [])
};

before(async () => {
  server = createServer({ metadataService: { find: async (aaguid) => aaguid.startsWith("b539") ? { aaguid, description: "Test authenticator", statusReports: [] } : null }, sharedStore });
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

test("shares activity and credentials through server APIs", async () => {
  for (const [path, record] of [["activity", { id: "run-1", outcome: "Success" }], ["credentials", { id: "credential-1", transports: ["internal"] }]]) {
    const saved = await fetch(`${origin}/api/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(record) });
    assert.equal(saved.status, 200);
    const records = await (await fetch(`${origin}/api/${path}`)).json();
    assert.deepEqual(records, [record]);
  }
  assert.equal((await fetch(`${origin}/api/activity`, { method: "DELETE" })).status, 200);
  assert.deepEqual(await (await fetch(`${origin}/api/activity`)).json(), []);
});

test("rejects invalid shared records", async () => {
  const response = await fetch(`${origin}/api/credentials`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(response.status, 400);
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("serves the application entry point", async () => {
  const response = await fetch(`${origin}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/html/);
  const html = await response.text();
  assert.match(html, /Passkey Tester/);
  assert.match(html, /<section class="page-view active" id="test-view" role="tabpanel">[\s\S]*?<div class="workspace"[\s\S]*?<div class="results"/);
  assert.match(html, /<section class="page-view log-view" id="log-view" role="tabpanel" hidden>/);
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
