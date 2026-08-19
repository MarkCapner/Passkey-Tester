(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AuthenticatorInfo = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function cborValue(bytes, offset = 0) {
    const initial = bytes[offset++];
    const major = initial >> 5;
    let length = initial & 31;
    if (length === 24) length = bytes[offset++];
    else if (length === 25) length = (bytes[offset++] << 8) | bytes[offset++];
    else if (length === 26) length = bytes[offset++] * 0x1000000 + (bytes[offset++] << 16) + (bytes[offset++] << 8) + bytes[offset++];
    if (major === 2 || major === 3) {
      const value = bytes.slice(offset, offset + length);
      return { value: major === 3 ? new TextDecoder().decode(value) : value, offset: offset + length };
    }
    if (major === 0) return { value: length, offset };
    if (major === 1) return { value: -1 - length, offset };
    if (major === 4) {
      const value = [];
      for (let index = 0; index < length; index++) { const item = cborValue(bytes, offset); value.push(item.value); offset = item.offset; }
      return { value, offset };
    }
    if (major === 5) {
      const value = {};
      for (let index = 0; index < length; index++) {
        const key = cborValue(bytes, offset); const item = cborValue(bytes, key.offset);
        value[key.value] = item.value; offset = item.offset;
      }
      return { value, offset };
    }
    throw new Error("Unsupported CBOR value in attestation object");
  }

  function formatAaguid(bytes) {
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function inspectAttestation(attestationObject) {
    try {
      const decoded = cborValue(new Uint8Array(attestationObject)).value;
      const authData = decoded.authData;
      if (!(authData instanceof Uint8Array) || authData.length < 53 || !(authData[32] & 0x40)) return { aaguid: null, passwordManager: "Unknown authenticator" };
      const aaguid = formatAaguid(authData.slice(37, 53));
      return { aaguid, passwordManager: "Unknown authenticator" };
    } catch { return { aaguid: null, passwordManager: "Unknown authenticator" }; }
  }

  async function lookupMetadata(aaguid, fetchImpl = fetch) {
    if (!aaguid) return null;
    const response = await fetchImpl(`/api/metadata/${encodeURIComponent(aaguid)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("FIDO Metadata Service lookup failed");
    return response.json();
  }

  return { inspectAttestation, lookupMetadata };
});
