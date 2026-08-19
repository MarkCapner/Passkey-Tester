const { readFile } = require("node:fs/promises");
const { join } = require("node:path");

const CONVENIENCE_METADATA_PATH = join(__dirname, "convenience-metadata.json");

function normalizeEntries(document) {
  const source = document.entries || document.aaguids || document;
  if (Array.isArray(source)) return source;
  if (!source || typeof source !== "object") throw new Error("Authenticator convenience metadata has an invalid format");
  return Object.entries(source)
    .filter(([, metadata]) => metadata && typeof metadata === "object")
    .map(([aaguid, metadata]) => ({ aaguid, ...metadata }));
}

function normalizeEntry(entry) {
  const name = entry.name || entry.friendlyName || entry.friendlyNames?.["en-US"] ||
    Object.values(entry.friendlyNames || {})[0] || entry.description || null;
  const icon = entry.icon || entry.icon_light || entry.iconLight || null;
  return { aaguid: entry.aaguid, name, description: name, icon };
}

function createMetadataService({ readFileImpl = readFile, metadataPath = CONVENIENCE_METADATA_PATH } = {}) {
  let cachedEntries = null;
  let pendingRequest = null;

  async function entries() {
    if (cachedEntries) return cachedEntries;
    if (!pendingRequest) {
      pendingRequest = readFileImpl(metadataPath, "utf8")
        .then((contents) => JSON.parse(contents))
        .then((document) => {
          cachedEntries = normalizeEntries(document);
          return cachedEntries;
        })
        .finally(() => { pendingRequest = null; });
    }
    return pendingRequest;
  }

  async function find(aaguid) {
    const normalized = aaguid.toLowerCase();
    const entry = (await entries()).find((item) => item.aaguid?.toLowerCase() === normalized);
    return entry ? normalizeEntry(entry) : null;
  }

  return { find };
}

module.exports = { CONVENIENCE_METADATA_PATH, createMetadataService, normalizeEntries };
