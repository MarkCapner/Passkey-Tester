const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { createServer } = require("../server");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

let server;
let origin;
let directory;

before(async () => {
  directory = await mkdtemp(join(tmpdir(), "passkey-tester-"));
  server = createServer({ dataFile: join(directory, "passkeys.json") });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await rm(directory, { recursive: true, force: true });
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

test("persists and returns passkey log entries", async () => {
  const input = { credentialId: "credential_1", aaguid: "b5397666-4885-aa6b-cebf-e52262a439a2", passwordManager: "1Password", transports: ["internal"] };
  const created = await fetch(`${origin}/api/passkeys`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).passwordManager, "1Password");

  const response = await fetch(`${origin}/api/passkeys`);
  assert.equal(response.status, 200);
  const values = await response.json();
  assert.equal(values.length, 1);
  assert.deepEqual(values[0].transports, ["internal"]);
  assert.match(await readFile(join(directory, "passkeys.json"), "utf8"), /credential_1/);
});

test("rejects malformed passkey log entries", async () => {
  const response = await fetch(`${origin}/api/passkeys`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ credentialId: "not valid" }) });
  assert.equal(response.status, 400);
});
