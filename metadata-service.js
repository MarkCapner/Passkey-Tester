const CONVENIENCE_METADATA_URL = "https://raw.githubusercontent.com/passkeydeveloper/passkey-authenticator-aaguids/main/convenience-metadata.json";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeEntries(document) {
  const source = document.entries || document.aaguids || document;
  if (Array.isArray(source)) return source;
  if (!source || typeof source !== "object") throw new Error("Authenticator convenience metadata has an invalid format");
  return Object.entries(source).map(([aaguid, metadata]) => ({ aaguid, ...metadata }));
}

function normalizeEntry(entry) {
  const name = entry.name || entry.friendlyName || entry.description || null;
  const icon = entry.icon || entry.icon_light || entry.iconLight || null;
  return { aaguid: entry.aaguid, name, description: name, icon };
}

function createMetadataService({ fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  let cachedEntries = null;
  let cachedAt = 0;
  let pendingRequest = null;

  async function entries() {
    if (cachedEntries && now() - cachedAt < CACHE_TTL_MS) return cachedEntries;
    if (!pendingRequest) {
      pendingRequest = fetchImpl(CONVENIENCE_METADATA_URL, { headers: { Accept: "application/json" } })
        .then((response) => {
          if (!response.ok) throw new Error(`Authenticator convenience metadata returned HTTP ${response.status}`);
          return response.json();
        })
        .then((document) => {
          cachedEntries = normalizeEntries(document);
          cachedAt = now();
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

module.exports = { CACHE_TTL_MS, CONVENIENCE_METADATA_URL, createMetadataService, normalizeEntries };
