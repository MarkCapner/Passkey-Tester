const MDS_URL = "https://mds3.fidoalliance.org/";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function decodeBlob(blob) {
  const parts = blob.trim().split(".");
  if (parts.length !== 3) throw new Error("FIDO metadata service returned an invalid JWT");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  if (!Array.isArray(payload.entries)) throw new Error("FIDO metadata service payload has no entries");
  return payload.entries;
}

function createMetadataService({ fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  let cachedEntries = null;
  let cachedAt = 0;
  let pendingRequest = null;

  async function entries() {
    if (cachedEntries && now() - cachedAt < CACHE_TTL_MS) return cachedEntries;
    if (!pendingRequest) {
      pendingRequest = fetchImpl(MDS_URL, { headers: { Accept: "application/octet-stream" } })
        .then((response) => {
          if (!response.ok) throw new Error(`FIDO metadata service returned HTTP ${response.status}`);
          return response.text();
        })
        .then((blob) => {
          cachedEntries = decodeBlob(blob);
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
    if (!entry) return null;
    return {
      aaguid: entry.aaguid,
      description: entry.metadataStatement?.description || null,
      statusReports: entry.statusReports || []
    };
  }

  return { find };
}

module.exports = { CACHE_TTL_MS, MDS_URL, createMetadataService, decodeBlob };
