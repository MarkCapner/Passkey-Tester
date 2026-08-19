const $ = (selector) => document.querySelector(selector);
const state = { credential: null, lastResult: null, passkeys: [], selectedCredentialIds: new Set() };

function randomBytes(length = 32) { return crypto.getRandomValues(new Uint8Array(length)); }
function toBase64Url(value) {
  const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
function randomBase64Url(length = 32) { return toBase64Url(randomBytes(length)); }
function decodeJson(buffer) {
  try { return JSON.parse(new TextDecoder().decode(buffer)); } catch { return null; }
}
function transportInfo(response) {
  return typeof response.getTransports === "function" ? response.getTransports() : [];
}

function serializedCredential(credential, operation) {
  const base = { operation, id: credential.id, type: credential.type, authenticatorAttachment: credential.authenticatorAttachment || null };
  if (operation === "create") {
    return { ...base, response: { clientDataJSON: decodeJson(credential.response.clientDataJSON), attestationObject: toBase64Url(credential.response.attestationObject), transports: transportInfo(credential.response), publicKeyAlgorithm: credential.response.getPublicKeyAlgorithm?.() ?? null }, clientExtensionResults: credential.getClientExtensionResults() };
  }
  return { ...base, response: { clientDataJSON: decodeJson(credential.response.clientDataJSON), authenticatorData: toBase64Url(credential.response.authenticatorData), signature: toBase64Url(credential.response.signature), userHandle: credential.response.userHandle ? toBase64Url(credential.response.userHandle) : null }, clientExtensionResults: credential.getClientExtensionResults() };
}

function showResult(status, data, isError = false) {
  state.lastResult = data;
  $("#emptyState").hidden = true;
  $("#resultContent").hidden = false;
  $("#statusLine").textContent = status;
  $("#statusLine").classList.toggle("error", isError);
  $("#resultJson").textContent = JSON.stringify(data, null, 2);
  $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
}
function showError(error) {
  showResult(`${error.name || "Error"}: ${error.message}`, { name: error.name, message: error.message }, true);
}
function setBusy(button, busy) { button.disabled = busy; button.dataset.label ||= button.innerHTML; button.innerHTML = busy ? "Waiting for authenticator…" : button.dataset.label; }

function creationExample() {
  return {
    challenge: randomBase64Url(),
    rp: { name: "Local Passkey Tester", id: location.hostname },
    user: { id: randomBase64Url(), name: "test@example.com", displayName: "Test User" },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }, { type: "public-key", alg: -8 }],
    timeout: 60000,
    excludeCredentials: [],
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    attestation: "none",
    extensions: {}
  };
}

function requestExample() {
  return { challenge: randomBase64Url(), rpId: location.hostname, timeout: 60000, allowCredentials: [], userVerification: "preferred", extensions: {} };
}

function setEditor(selector, value) { $(selector).value = JSON.stringify(value, null, 2); }
function readEditor(selector) { return JSON.parse($(selector).value); }
function prepareCredentialOptions(selector, operation) {
  const input = readEditor(selector);
  const publicKeyJson = input.publicKey || input;
  const outerOptions = input.publicKey ? input : {};
  return { input, options: { ...outerOptions, publicKey: WebAuthnJson.parseOptionsFromJson(publicKeyJson, operation) } };
}
function credentialDescriptor() {
  if (!state.credential) throw new Error("Create a passkey first before inserting its credential ID.");
  const descriptor = { type: "public-key", id: toBase64Url(state.credential.rawId) };
  const transports = transportInfo(state.credential.response);
  if (transports.length) descriptor.transports = transports;
  return descriptor;
}
function storedDescriptor(passkey) {
  const descriptor = { type: "public-key", id: passkey.credentialId };
  if (passkey.transports?.length) descriptor.transports = passkey.transports;
  return descriptor;
}
function applySelectedCredentials() {
  for (const [selector, property] of [["#createJson", "excludeCredentials"], ["#authJson", "allowCredentials"]]) {
    try {
      const input = readEditor(selector);
      const options = input.publicKey || input;
      const loggedIds = new Set(state.passkeys.map((item) => item.credentialId));
      const retained = (options[property] || []).filter((item) => !loggedIds.has(item.id));
      const selected = state.passkeys.filter((item) => state.selectedCredentialIds.has(item.credentialId)).map(storedDescriptor);
      options[property] = [...retained, ...selected];
      setEditor(selector, input);
    } catch (error) { showError(error); }
  }
}
function renderPasskeys() {
  const list = $("#passkeyList");
  list.replaceChildren();
  if (!state.passkeys.length) {
    const empty = document.createElement("span"); empty.className = "hint";
    empty.textContent = "No passkeys logged yet. Create one to add it here."; list.append(empty); return;
  }
  state.passkeys.forEach((passkey) => {
    const label = document.createElement("label"); label.className = "passkey-choice";
    const checkbox = document.createElement("input"); checkbox.type = "checkbox";
    checkbox.checked = state.selectedCredentialIds.has(passkey.credentialId);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.selectedCredentialIds.add(passkey.credentialId); else state.selectedCredentialIds.delete(passkey.credentialId);
      applySelectedCredentials();
    });
    const details = document.createElement("span");
    const name = document.createElement("strong"); name.textContent = passkey.passwordManager;
    const id = document.createElement("small"); id.textContent = `${passkey.aaguid} · ${passkey.credentialId.slice(0, 18)}…`;
    details.append(name, id); label.append(checkbox, details); list.append(label);
  });
}
async function loadPasskeys() {
  const response = await fetch("/api/passkeys");
  if (!response.ok) throw new Error("Could not load the passkey log.");
  state.passkeys = await response.json(); renderPasskeys();
}
async function logPasskey(credential) {
  const aaguid = Aaguid.fromCredential(credential);
  if (!aaguid) throw new Error("This browser did not expose attested authenticator data, so its AAGUID could not be logged.");
  const response = await fetch("/api/passkeys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
    credentialId: toBase64Url(credential.rawId), aaguid, passwordManager: Aaguid.provider(aaguid), transports: transportInfo(credential.response)
  }) });
  if (!response.ok) throw new Error("The passkey was created, but its log entry could not be saved.");
  const saved = await response.json();
  state.passkeys = state.passkeys.filter((item) => item.credentialId !== saved.credentialId).concat(saved);
  state.selectedCredentialIds.add(saved.credentialId); renderPasskeys(); applySelectedCredentials();
  return saved;
}
function insertLastCredential(selector, property) {
  try {
    const input = readEditor(selector);
    const options = input.publicKey || input;
    options[property] = [credentialDescriptor()];
    setEditor(selector, input);
  } catch (error) { showError(error); }
}

async function createPasskey() {
  const button = $("#createButton"); setBusy(button, true);
  try {
    const request = prepareCredentialOptions("#createJson", "create");
    const credential = await navigator.credentials.create(request.options);
    state.credential = credential;
    $("#savedHint").textContent = `Ready to authenticate credential ${credential.id.slice(0, 18)}…`;
    const record = await logPasskey(credential);
    showResult(`Passkey created and logged as ${record.passwordManager}`, { request: request.input, credential: serializedCredential(credential, "create"), passkeyLog: record });
  } catch (error) { showError(error); } finally { setBusy(button, false); }
}

async function authenticatePasskey() {
  const button = $("#authButton"); setBusy(button, true);
  try {
    const request = prepareCredentialOptions("#authJson", "get");
    const credential = await navigator.credentials.get(request.options);
    showResult("Authentication completed successfully", { request: request.input, credential: serializedCredential(credential, "authenticate") });
  } catch (error) { showError(error); } finally { setBusy(button, false); }
}

document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach((item) => { const active = item === tab; item.classList.toggle("active", active); item.setAttribute("aria-selected", active); });
  document.querySelectorAll(".panel").forEach((panel) => { const active = panel.id === `${tab.dataset.tab}-panel`; panel.classList.toggle("active", active); panel.hidden = !active; });
}));
$("#createButton").addEventListener("click", createPasskey);
$("#authButton").addEventListener("click", authenticatePasskey);
$("#createReset").addEventListener("click", () => { setEditor("#createJson", creationExample()); applySelectedCredentials(); });
$("#authReset").addEventListener("click", () => { setEditor("#authJson", requestExample()); applySelectedCredentials(); });
$("#addExcluded").addEventListener("click", () => insertLastCredential("#createJson", "excludeCredentials"));
$("#addAllowed").addEventListener("click", () => insertLastCredential("#authJson", "allowCredentials"));
$("#clearButton").addEventListener("click", () => { state.lastResult = null; $("#emptyState").hidden = false; $("#resultContent").hidden = true; });
$("#copyButton").addEventListener("click", async () => { if (!state.lastResult) return; await navigator.clipboard.writeText(JSON.stringify(state.lastResult, null, 2)); $("#copyButton").textContent = "Copied!"; setTimeout(() => { $("#copyButton").textContent = "Copy JSON"; }, 1200); });

(async () => {
  setEditor("#createJson", creationExample());
  setEditor("#authJson", requestExample());
  try { await loadPasskeys(); } catch (error) { $("#passkeyList").textContent = error.message; }
  const supported = window.isSecureContext && "PublicKeyCredential" in window;
  let platform = false;
  if (supported && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) platform = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  const support = $("#support"); support.classList.add(supported ? "good" : "bad");
  support.querySelector(".support-icon").textContent = supported ? "✓" : "!";
  support.querySelector("strong").textContent = supported ? "WebAuthn is supported" : "WebAuthn is unavailable";
  support.querySelector("small").textContent = supported ? `${platform ? "Platform authenticator detected" : "Try a security key or password manager"} · ${navigator.userAgentData?.brands?.[0]?.brand || navigator.userAgent.split(" ").at(-1)}` : "Open this page on localhost in a modern browser";
  $("#createButton").disabled = !supported; $("#authButton").disabled = !supported;
})();
