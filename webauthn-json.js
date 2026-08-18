(function exposeWebAuthnJson(global) {
  function base64UrlToBytes(value) {
    if (typeof value !== "string") throw new TypeError("Binary WebAuthn values must be base64url strings.");
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = global.atob ? global.atob(base64) : Buffer.from(base64, "base64").toString("binary");
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  function convertDescriptorIds(descriptors = []) {
    return descriptors.map((descriptor) => ({ ...descriptor, id: base64UrlToBytes(descriptor.id) }));
  }

  function convertPrf(extension) {
    if (!extension?.eval && !extension?.evalByCredential) return extension;
    const convertValues = (values) => values && ({
      ...values,
      first: base64UrlToBytes(values.first),
      ...(values.second === undefined ? {} : { second: base64UrlToBytes(values.second) })
    });
    return {
      ...extension,
      ...(extension.eval ? { eval: convertValues(extension.eval) } : {}),
      ...(extension.evalByCredential ? { evalByCredential: Object.fromEntries(Object.entries(extension.evalByCredential).map(([id, values]) => [id, convertValues(values)])) } : {})
    };
  }

  function fallbackConversion(options, operation) {
    const converted = { ...options, challenge: base64UrlToBytes(options.challenge) };
    if (operation === "create") {
      converted.user = { ...options.user, id: base64UrlToBytes(options.user.id) };
      if (options.excludeCredentials) converted.excludeCredentials = convertDescriptorIds(options.excludeCredentials);
    } else if (options.allowCredentials) converted.allowCredentials = convertDescriptorIds(options.allowCredentials);

    if (options.extensions) {
      converted.extensions = { ...options.extensions };
      if (options.extensions.credBlob !== undefined) converted.extensions.credBlob = base64UrlToBytes(options.extensions.credBlob);
      if (options.extensions.largeBlob?.write !== undefined) converted.extensions.largeBlob = { ...options.extensions.largeBlob, write: base64UrlToBytes(options.extensions.largeBlob.write) };
      if (options.extensions.prf) converted.extensions.prf = convertPrf(options.extensions.prf);
    }
    return converted;
  }

  function parseOptionsFromJson(options, operation, PublicKeyCredentialClass = global.PublicKeyCredential) {
    const method = operation === "create" ? "parseCreationOptionsFromJSON" : "parseRequestOptionsFromJSON";
    if (typeof PublicKeyCredentialClass?.[method] === "function") return PublicKeyCredentialClass[method](options);
    return fallbackConversion(options, operation);
  }

  const api = { base64UrlToBytes, parseOptionsFromJson };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.WebAuthnJson = api;
})(typeof globalThis === "undefined" ? window : globalThis);
