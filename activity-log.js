(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ActivityLog = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const STORAGE_KEY = "passkey-tester.activity-log.v1";

  function browserName(userAgent, brands) {
    if (Array.isArray(brands) && brands.length) {
      const brand = brands.find((item) => !/not.a.brand/i.test(item.brand)) || brands[0];
      return `${brand.brand}${brand.version ? ` ${brand.version}` : ""}`;
    }
    const ua = userAgent || "";
    const match = ua.match(/(Edg|OPR|Chrome|Firefox|Version)\/(\d+(?:\.\d+)?)/);
    if (!match) return "Unknown browser";
    const names = { Edg: "Microsoft Edge", OPR: "Opera", Chrome: "Chrome", Firefox: "Firefox", Version: /Safari/.test(ua) ? "Safari" : "Browser" };
    return `${names[match[1]]} ${match[2]}`;
  }

  function runKind(operation, request) {
    const options = request?.publicKey || request || {};
    if (operation === "create") return options.excludeCredentials?.length ? "Exclude" : "Standard";
    return options.allowCredentials?.length ? "Include" : "Discoverable";
  }

  function read(storage) {
    try {
      const value = JSON.parse(storage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function append(storage, entry) {
    const entries = read(storage);
    entries.unshift(entry);
    try { storage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 500))); } catch { /* Keep the current session usable if storage is unavailable. */ }
    return entries.slice(0, 500);
  }

  return { STORAGE_KEY, browserName, runKind, read, append };
});
