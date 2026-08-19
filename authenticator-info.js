(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AuthenticatorInfo = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const AAGUID_MANAGERS = {
    "b5397666-4885-aa6b-cebf-e52262a439a2": "1Password",
    "dd4ec289-e01d-41c9-bb89-70fa845d4bf2": "Apple Passwords / iCloud Keychain",
    "d548826e-79b4-db40-a3d8-11116f7e8349": "Bitwarden",
    "531126d6-e717-415c-9320-3d9aa6981239": "Dashlane",
    "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4": "Google Password Manager"
  };

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
      return { aaguid, passwordManager: AAGUID_MANAGERS[aaguid] || "Unknown authenticator" };
    } catch { return { aaguid: null, passwordManager: "Unknown authenticator" }; }
  }

  return { AAGUID_MANAGERS, inspectAttestation };
});
