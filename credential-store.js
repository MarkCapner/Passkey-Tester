(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CredentialStore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const STORAGE_KEY = "passkey-tester.credentials.v1";
  function read(storage) {
    try { const value = JSON.parse(storage.getItem(STORAGE_KEY) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; }
  }
  function save(storage, credential) {
    const records = read(storage);
    const existing = records.find((item) => item.id === credential.id);
    if (existing) Object.assign(existing, credential, { lastUsed: new Date().toISOString() });
    else records.unshift({ ...credential, createdAt: new Date().toISOString(), lastUsed: new Date().toISOString() });
    storage.setItem(STORAGE_KEY, JSON.stringify(records));
    return records;
  }
  function descriptors(records, ids) {
    return records.filter((record) => ids.includes(record.id)).map(({ id, transports }) => ({ type: "public-key", id, ...(transports?.length ? { transports } : {}) }));
  }
  return { STORAGE_KEY, read, save, descriptors };
});
