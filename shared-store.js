const { mkdir, readFile, rename, writeFile } = require("node:fs/promises");
const { dirname } = require("node:path");

function uniqueNewest(records, limit) {
  const seen = new Set();
  return records
    .sort((a, b) => String(b.timestamp || b.lastUsed || "").localeCompare(String(a.timestamp || a.lastUsed || "")))
    .filter((record) => record?.id && !seen.has(record.id) && seen.add(record.id))
    .slice(0, limit);
}

function createSharedStore(file) {
  let pending = Promise.resolve();
  async function readData() {
    try {
      const value = JSON.parse(await readFile(file, "utf8"));
      return { activity: Array.isArray(value.activity) ? value.activity : [], credentials: Array.isArray(value.credentials) ? value.credentials : [] };
    } catch (error) {
      if (error.code === "ENOENT" || error instanceof SyntaxError) return { activity: [], credentials: [] };
      throw error;
    }
  }
  async function update(change) {
    const operation = pending.then(async () => {
      const data = await readData();
      const result = change(data);
      await mkdir(dirname(file), { recursive: true });
      const temporary = `${file}.${process.pid}.tmp`;
      await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
      await rename(temporary, file);
      return result;
    });
    pending = operation.catch(() => {});
    return operation;
  }
  return {
    async list(kind) { await pending; return (await readData())[kind]; },
    merge(kind, records) {
      return update((data) => {
        data[kind] = uniqueNewest([...records, ...data[kind]], kind === "activity" ? 500 : 1000);
        return data[kind];
      });
    },
    clearActivity() { return update((data) => { data.activity = []; return data.activity; }); }
  };
}

module.exports = { createSharedStore };
