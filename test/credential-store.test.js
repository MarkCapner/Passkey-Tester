const assert = require("node:assert/strict");
const { test } = require("node:test");
const { descriptors, read, save } = require("../credential-store");

function storage() { const values = {}; return { getItem: (key) => values[key] || null, setItem: (key, value) => { values[key] = value; } }; }

test("saves unique credentials and updates an existing credential", () => {
  const local = storage();
  save(local, { id: "one", passwordManager: "1Password", transports: ["internal"] });
  save(local, { id: "one", passwordManager: "1Password", transports: ["hybrid"] });
  assert.equal(read(local).length, 1);
  assert.deepEqual(read(local)[0].transports, ["hybrid"]);
});

test("builds descriptors only for selected credentials", () => {
  assert.deepEqual(descriptors([{ id: "one", transports: ["internal"] }, { id: "two", transports: [] }], ["two"]), [{ type: "public-key", id: "two" }]);
});
