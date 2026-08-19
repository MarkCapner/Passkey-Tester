const assert = require("node:assert/strict");
const { test } = require("node:test");
const { STORAGE_KEY, append, browserName, read, runKind } = require("../activity-log");

function memoryStorage(initial = {}) {
  const values = { ...initial };
  return { getItem: (key) => values[key] ?? null, setItem: (key, value) => { values[key] = value; } };
}

test("labels creation exclusion and authentication inclusion runs", () => {
  assert.equal(runKind("create", { excludeCredentials: [{ id: "one" }] }), "Exclude");
  assert.equal(runKind("create", { excludeCredentials: [] }), "Standard");
  assert.equal(runKind("authenticate", { publicKey: { allowCredentials: [{ id: "one" }] } }), "Include");
  assert.equal(runKind("authenticate", { allowCredentials: [] }), "Discoverable");
});

test("identifies common browsers from client hints and user agents", () => {
  assert.equal(browserName("", [{ brand: "Not.A/Brand", version: "99" }, { brand: "Chromium", version: "140" }]), "Chromium 140");
  assert.equal(browserName("Mozilla/5.0 Version/18.6 Safari/605.1.15"), "Safari 18.6");
  assert.equal(browserName("Mozilla/5.0 Firefox/142.0"), "Firefox 142.0");
});

test("stores newest entries first and tolerates invalid saved data", () => {
  const storage = memoryStorage({ [STORAGE_KEY]: "not-json" });
  assert.deepEqual(read(storage), []);
  append(storage, { id: "first" });
  append(storage, { id: "second" });
  assert.deepEqual(read(storage).map((entry) => entry.id), ["second", "first"]);
});
