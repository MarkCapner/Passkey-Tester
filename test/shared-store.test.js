const assert = require("node:assert/strict");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { test } = require("node:test");
const { createSharedStore } = require("../shared-store");

test("persists and merges shared records by id", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "passkey-tester-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, "state.json");
  const store = createSharedStore(file);

  await Promise.all([
    store.merge("credentials", [{ id: "one", lastUsed: "2026-01-01", transports: ["internal"] }]),
    store.merge("credentials", [{ id: "two", lastUsed: "2026-02-01" }])
  ]);
  await store.merge("credentials", [{ id: "one", lastUsed: "2026-03-01", transports: ["hybrid"] }]);

  assert.deepEqual((await store.list("credentials")).map((record) => record.id), ["one", "two"]);
  assert.deepEqual(JSON.parse(await readFile(file, "utf8")).credentials[0].transports, ["hybrid"]);
});

test("clears activity without clearing credentials", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "passkey-tester-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const store = createSharedStore(join(directory, "state.json"));
  await store.merge("activity", [{ id: "run", timestamp: "2026-01-01" }]);
  await store.merge("credentials", [{ id: "credential", lastUsed: "2026-01-01" }]);
  await store.clearActivity();
  assert.deepEqual(await store.list("activity"), []);
  assert.equal((await store.list("credentials")).length, 1);
});
