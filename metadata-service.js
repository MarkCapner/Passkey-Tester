const { readFile } = require("node:fs/promises");
const { join } = require("node:path");

const METADATA_BLOB_PATH = join(__dirname, "blob.jwt");

function parseMetadataBlob(blob) {
  const parts = blob.trim().split(".");
  if (parts.length !== 3 || !parts[1]) throw new Error("FIDO metadata BLOB has an invalid JWT format");

  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    throw new Error("FIDO metadata BLOB has an invalid payload");
  }
  if (!Array.isArray(payload.entries)) throw new Error("FIDO metadata BLOB has no entries");
  return payload.entries;
}

function normalizeEntry(entry) {
  const statement = entry.metadataStatement || {};
  const name = statement.friendlyNames?.["en-US"] ||
    Object.values(statement.friendlyNames || {})[0] || statement.description || null;
  return {
    aaguid: entry.aaguid,
    name,
    description: statement.description || name,
    icon: statement.icon || null
  };
}

function createMetadataService({ readFileImpl = readFile, metadataPath = METADATA_BLOB_PATH } = {}) {
  let cachedEntries = null;
  let pendingRequest = null;

  async function entries() {
    if (cachedEntries) return cachedEntries;
    if (!pendingRequest) {
      pendingRequest = readFileImpl(metadataPath, "utf8")
        .then((contents) => {
          cachedEntries = parseMetadataBlob(contents);
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

module.exports = { METADATA_BLOB_PATH, createMetadataService, parseMetadataBlob };
