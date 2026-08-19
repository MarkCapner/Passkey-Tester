const { readFile } = require("node:fs/promises");
const { join } = require("node:path");

const METADATA_PATH = join(__dirname, "combined_aaguid.json");

function parseMetadata(contents) {
  let metadata;
  try {
    metadata = JSON.parse(contents);
  } catch {
    throw new Error("Combined AAGUID metadata has invalid JSON");
  }
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") {
    throw new Error("Combined AAGUID metadata must be an object");
  }
  return metadata;
}

function normalizeEntry(aaguid, entry) {
  if (!entry || typeof entry !== "object") return null;
  const name = typeof entry.name === "string" ? entry.name : null;
  return {
    aaguid,
    name,
    description: name,
    // These icons are shown on the app's light card background, so prefer the
    // dark artwork and retain the light version only as a compatibility fallback.
    icon: entry.icon_dark || entry.icon_light || null
  };
}

function createMetadataService({ readFileImpl = readFile, metadataPath = METADATA_PATH } = {}) {
  let cachedMetadata = null;
  let pendingRequest = null;

  async function metadata() {
    if (cachedMetadata) return cachedMetadata;
    if (!pendingRequest) {
      pendingRequest = readFileImpl(metadataPath, "utf8")
        .then((contents) => {
          cachedMetadata = parseMetadata(contents);
          return cachedMetadata;
        })
        .finally(() => { pendingRequest = null; });
    }
    return pendingRequest;
  }

  async function find(aaguid) {
    const normalized = aaguid.toLowerCase();
    const entries = await metadata();
    const storedAaguid = Object.keys(entries).find((key) => key.toLowerCase() === normalized);
    return storedAaguid ? normalizeEntry(storedAaguid, entries[storedAaguid]) : null;
  }

  return { find };
}

module.exports = { METADATA_PATH, createMetadataService, parseMetadata };
