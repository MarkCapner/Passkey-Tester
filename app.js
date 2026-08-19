const $ = (selector) => document.querySelector(selector);
const state = { credentials: [], lastResult: null, log: [], passwordManager: "Unknown authenticator", aaguid: null };
const browser = ActivityLog.browserName(navigator.userAgent, navigator.userAgentData?.brands);

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

function safeEditorValue(selector) {
  try { return readEditor(selector); } catch { return null; }
}
async function syncCollection(path, localRecords) {
  try {
    const migrationKey = `passkey-tester.shared${path}.v1`;
    if (!localStorage.getItem(migrationKey) && localRecords.length) {
      const migration = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(localRecords) });
      if (!migration.ok) throw new Error(`Migration failed (${migration.status})`);
    }
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Sync failed (${response.status})`);
    localStorage.setItem(migrationKey, "true");
    return await response.json();
  } catch {
    return localRecords;
  }
}
function recordRun(operation, request, outcome, error = null, credential = null) {
  const entry = {
    id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    timestamp: new Date().toISOString(),
    operation,
    run: ActivityLog.runKind(operation, request),
    passwordManager: state.passwordManager,
    browser,
    outcome,
    credentialId: credential?.id || null,
    error: error ? { name: error.name || "Error", message: error.message || String(error) } : null
  };
  state.log = ActivityLog.append(localStorage, entry);
  renderLog();
  fetch("/api/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry) }).catch(() => {});
}

function creationExample() {
  return {
    challenge: randomBase64Url(),
    rp: { name: "Local Passkey Tester", id: location.hostname },
    user: { id: randomBase64Url(), name: "test@example.com", displayName: "Test User" },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }, { type: "public-key", alg: -8 }],
    timeout: 60000,
    excludeCredentials: [],
    authenticatorSelection: { authenticatorAttachment: "platform", requireResidentKey: true, residentKey: "required", userVerification: "required" },
    attestation: "indirect",
    extensions: { uvm: true, credProps: true }
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
function saveCredential(credential, details = {}) {
  const record = {
    id: toBase64Url(credential.rawId),
    transports: transportInfo(credential.response),
    passwordManager: details.passwordManager || state.credentials.find((item) => item.id === credential.id)?.passwordManager || "Unknown authenticator",
    aaguid: details.aaguid || null
  };
  state.credentials = CredentialStore.save(localStorage, record);
  fetch("/api/credentials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(record) }).catch(() => {});
  return record;
}
function renderCredentialPicker() {
  const choices = state.credentials.length ? state.credentials.map((record) => `<label><input type="checkbox" value="${escapeHtml(record.id)}"><span>${escapeHtml(record.passwordManager)}<small>${escapeHtml(record.id.slice(0, 24))}… · last used ${escapeHtml(new Date(record.lastUsed).toLocaleString())}</small></span></label>`).join("") : '<span class="muted">No saved credentials yet.</span>';
  $("#excludeChoices").innerHTML = choices;
  $("#allowChoices").innerHTML = choices;
}
function applyExcludedCredentials() {
  try {
    const input = readEditor("#createJson");
    const options = input.publicKey || input;
    const ids = [...document.querySelectorAll("#excludeChoices input:checked")].map((input) => input.value);
    options.excludeCredentials = CredentialStore.descriptors(state.credentials, ids);
    setEditor("#createJson", input);
    $("#excludePicker").hidden = true;
  } catch (error) { showError(error); }
}
function applyAllowedCredentials() {
  try {
    const input = readEditor("#authJson");
    const options = input.publicKey || input;
    const ids = [...document.querySelectorAll("#allowChoices input:checked")].map((input) => input.value);
    options.allowCredentials = CredentialStore.descriptors(state.credentials, ids);
    setEditor("#authJson", input);
    $("#allowPicker").hidden = true;
  } catch (error) { showError(error); }
}
async function createPasskey() {
  const button = $("#createButton"); setBusy(button, true);
  let input = safeEditorValue("#createJson");
  try {
    const request = prepareCredentialOptions("#createJson", "create");
    input = request.input;
    const credential = await navigator.credentials.create(request.options);
    const detected = AuthenticatorInfo.inspectAttestation(credential.response.attestationObject);
    try {
      const metadata = await AuthenticatorInfo.lookupMetadata(detected.aaguid);
      if (metadata?.name || metadata?.description) detected.passwordManager = metadata.name || metadata.description;
      detected.icon = metadata?.icon || null;
    } catch {
      // Metadata is informational; creation still succeeds when it is unavailable.
    }
    state.passwordManager = detected.passwordManager;
    state.aaguid = detected.aaguid;
    saveCredential(credential, detected);
    renderCredentialPicker();
    $("#detectedManager").textContent = detected.passwordManager;
    const managerIcon = $("#detectedManagerIcon");
    managerIcon.hidden = !detected.icon;
    managerIcon.src = detected.icon || "";
    managerIcon.alt = detected.icon ? `${detected.passwordManager} icon` : "";
    $("#detectedAaguid").textContent = detected.aaguid ? `AAGUID ${detected.aaguid}` : "No AAGUID was available in this attestation.";
    $("#savedHint").textContent = `Ready to authenticate credential ${credential.id.slice(0, 18)}…`;
    showResult("Passkey created successfully", { request: request.input, credential: serializedCredential(credential, "create") });
    recordRun("create", request.input, "Success", null, credential);
  } catch (error) { showError(error); recordRun("create", input, "Error", error); } finally { setBusy(button, false); }
}

async function authenticatePasskey() {
  const button = $("#authButton"); setBusy(button, true);
  let input = safeEditorValue("#authJson");
  try {
    const request = prepareCredentialOptions("#authJson", "get");
    input = request.input;
    const credential = await navigator.credentials.get(request.options);
    const saved = saveCredential(credential);
    state.passwordManager = saved.passwordManager;
    renderCredentialPicker();
    showResult("Authentication completed successfully", { request: request.input, credential: serializedCredential(credential, "authenticate") });
    recordRun("authenticate", request.input, "Success", null, credential);
  } catch (error) { showError(error); recordRun("authenticate", input, "Error", error); } finally { setBusy(button, false); }
}

document.querySelectorAll(".operation-tab").forEach((tab) => tab.addEventListener("click", () => {
  document.querySelectorAll(".operation-tab").forEach((item) => { const active = item === tab; item.classList.toggle("active", active); item.setAttribute("aria-selected", active); });
  document.querySelectorAll(".panel").forEach((panel) => { const active = panel.id === `${tab.dataset.tab}-panel`; panel.classList.toggle("active", active); panel.hidden = !active; });
}));
document.querySelectorAll(".page-tab").forEach((tab) => tab.addEventListener("click", () => {
  document.querySelectorAll(".page-tab").forEach((item) => { const active = item === tab; item.classList.toggle("active", active); item.setAttribute("aria-selected", active); });
  document.querySelectorAll(".page-view").forEach((view) => { const active = view.id === `${tab.dataset.view}-view`; view.classList.toggle("active", active); view.hidden = !active; });
}));
$("#createButton").addEventListener("click", createPasskey);
$("#authButton").addEventListener("click", authenticatePasskey);
$("#createReset").addEventListener("click", () => setEditor("#createJson", creationExample()));
$("#authReset").addEventListener("click", () => setEditor("#authJson", requestExample()));
$("#addExcluded").addEventListener("click", () => { renderCredentialPicker(); $("#excludePicker").hidden = !$("#excludePicker").hidden; });
$("#applyExcluded").addEventListener("click", applyExcludedCredentials);
$("#addAllowed").addEventListener("click", () => { renderCredentialPicker(); $("#allowPicker").hidden = !$("#allowPicker").hidden; });
$("#applyAllowed").addEventListener("click", applyAllowedCredentials);
$("#clearButton").addEventListener("click", () => { state.lastResult = null; $("#emptyState").hidden = false; $("#resultContent").hidden = true; });
$("#copyButton").addEventListener("click", async () => { if (!state.lastResult) return; await navigator.clipboard.writeText(JSON.stringify(state.lastResult, null, 2)); $("#copyButton").textContent = "Copied!"; setTimeout(() => { $("#copyButton").textContent = "Copy JSON"; }, 1200); });
$("#clearLog").addEventListener("click", () => {
  if (!confirm("Clear every saved test result from all browsers?")) return;
  localStorage.removeItem(ActivityLog.STORAGE_KEY); state.log = []; renderLog();
  fetch("/api/activity", { method: "DELETE" }).catch(() => {});
});
$("#exportLog").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state.log, null, 2)], { type: "application/json" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `passkey-test-log-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(link.href);
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]);
}
function renderLog() {
  const successes = state.log.filter((entry) => entry.outcome === "Success").length;
  const errors = state.log.length - successes;
  $("#logCount").textContent = state.log.length;
  $("#logSummary").innerHTML = `<div><strong>${state.log.length}</strong><span>Total runs</span></div><div><strong>${successes}</strong><span>Successful</span></div><div><strong>${errors}</strong><span>Errors</span></div>`;
  $("#logEmpty").hidden = state.log.length > 0;
  $("#logTableWrap").hidden = state.log.length === 0;
  $("#logRows").innerHTML = state.log.map((entry) => {
    const error = entry.error ? `<strong>${escapeHtml(entry.error.name)}</strong><span>${escapeHtml(entry.error.message)}</span>` : '<span class="muted">—</span>';
    return `<tr><td><time datetime="${escapeHtml(entry.timestamp)}">${escapeHtml(new Date(entry.timestamp).toLocaleString())}</time></td><td class="capitalize">${escapeHtml(entry.operation)}</td><td><span class="run-badge">${escapeHtml(entry.run)}</span></td><td>${escapeHtml(entry.passwordManager)}</td><td>${escapeHtml(entry.browser)}</td><td><span class="outcome ${entry.outcome === "Success" ? "success" : "failure"}">${escapeHtml(entry.outcome)}</span></td><td class="error-cell">${error}</td></tr>`;
  }).join("");
}

(async () => {
  state.log = ActivityLog.read(localStorage);
  state.credentials = CredentialStore.read(localStorage);
  [state.log, state.credentials] = await Promise.all([
    syncCollection("/api/activity", state.log),
    syncCollection("/api/credentials", state.credentials)
  ]);
  try { localStorage.setItem(ActivityLog.STORAGE_KEY, JSON.stringify(state.log)); } catch {}
  try { localStorage.setItem(CredentialStore.STORAGE_KEY, JSON.stringify(state.credentials)); } catch {}
  renderCredentialPicker();
  renderLog();
  setEditor("#createJson", creationExample());
  setEditor("#authJson", requestExample());
  const supported = window.isSecureContext && "PublicKeyCredential" in window;
  let platform = false;
  if (supported && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) platform = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  const support = $("#support"); support.classList.add(supported ? "good" : "bad");
  support.querySelector(".support-icon").textContent = supported ? "✓" : "!";
  support.querySelector("strong").textContent = supported ? "WebAuthn is supported" : "WebAuthn is unavailable";
  support.querySelector("small").textContent = supported ? `${platform ? "Platform authenticator detected" : "Try a security key or password manager"} · ${browser}` : "Open this page on localhost in a modern browser";
  $("#createButton").disabled = !supported; $("#authButton").disabled = !supported;
})();
