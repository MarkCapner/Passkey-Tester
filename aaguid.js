(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Aaguid = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  const providers = {
    "adce0002-35bc-c60a-648b-0b25f1f05503": "Apple Passwords",
    "b5397666-4885-aa6b-cebf-e52262a439a2": "1Password",
    "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4": "Google Password Manager",
    "08987058-cadc-4b81-b6e1-30de50dcbe96": "Windows Hello"
  };

  function format(bytes) {
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function fromCredential(credential) {
    const getData = credential?.response?.getAuthenticatorData;
    if (typeof getData !== "function") return null;
    const data = new Uint8Array(getData.call(credential.response));
    if (data.length < 53 || !(data[32] & 0x40)) return null;
    return format(data.slice(37, 53));
  }

  function provider(aaguid) {
    if (!aaguid || aaguid === "00000000-0000-0000-0000-000000000000") return "Unspecified authenticator";
    return providers[aaguid.toLowerCase()] || "Unknown authenticator";
  }

  return { format, fromCredential, provider };
});
