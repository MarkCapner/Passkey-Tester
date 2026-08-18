const $ = (selector) => document.querySelector(selector);
const state = { credential: null, lastResult: null };

function randomBytes(length = 32) { return crypto.getRandomValues(new Uint8Array(length)); }
function toBase64Url(value) {
  const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
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

async function createPasskey() {
  const button = $("#createButton"); setBusy(button, true);
  try {
    const userId = randomBytes(32);
    const publicKey = {
      challenge: randomBytes(), rp: { name: "Local Passkey Tester", id: location.hostname },
      user: { id: userId, name: $("#username").value.trim(), displayName: $("#displayName").value.trim() },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }, { type: "public-key", alg: -8 }], timeout: 60000,
      authenticatorSelection: { residentKey: $("#residentKey").value, userVerification: $("#createVerification").value },
      attestation: $("#attestation").value
    };
    const attachment = $("#attachment").value;
    if (attachment) publicKey.authenticatorSelection.authenticatorAttachment = attachment;
    if (state.credential && $("#excludeExisting").checked) publicKey.excludeCredentials = [{ type: "public-key", id: state.credential.rawId, transports: transportInfo(state.credential.response) }];
    const credential = await navigator.credentials.create({ publicKey });
    state.credential = credential;
    $("#savedHint").textContent = `Ready to authenticate credential ${credential.id.slice(0, 18)}…`;
    showResult("Passkey created successfully", { request: { rpId: publicKey.rp.id, username: publicKey.user.name, authenticatorSelection: publicKey.authenticatorSelection, attestation: publicKey.attestation }, credential: serializedCredential(credential, "create") });
  } catch (error) { showError(error); } finally { setBusy(button, false); }
}

async function authenticatePasskey() {
  const button = $("#authButton"); setBusy(button, true);
  try {
    const publicKey = { challenge: randomBytes(), rpId: location.hostname, timeout: 60000, userVerification: $("#authVerification").value };
    if ($("#credentialSelection").value === "saved") {
      if (!state.credential) throw new Error("Create a passkey first, or choose any discoverable credential.");
      publicKey.allowCredentials = [{ type: "public-key", id: state.credential.rawId, transports: transportInfo(state.credential.response) }];
    }
    const credential = await navigator.credentials.get({ publicKey });
    showResult("Authentication completed successfully", { request: { rpId: publicKey.rpId, userVerification: publicKey.userVerification, credentialSelection: publicKey.allowCredentials ? "saved" : "discoverable" }, credential: serializedCredential(credential, "authenticate") });
  } catch (error) { showError(error); } finally { setBusy(button, false); }
}

document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach((item) => { const active = item === tab; item.classList.toggle("active", active); item.setAttribute("aria-selected", active); });
  document.querySelectorAll(".panel").forEach((panel) => { const active = panel.id === `${tab.dataset.tab}-panel`; panel.classList.toggle("active", active); panel.hidden = !active; });
}));
$("#createButton").addEventListener("click", createPasskey);
$("#authButton").addEventListener("click", authenticatePasskey);
$("#clearButton").addEventListener("click", () => { state.lastResult = null; $("#emptyState").hidden = false; $("#resultContent").hidden = true; });
$("#copyButton").addEventListener("click", async () => { if (!state.lastResult) return; await navigator.clipboard.writeText(JSON.stringify(state.lastResult, null, 2)); $("#copyButton").textContent = "Copied!"; setTimeout(() => { $("#copyButton").textContent = "Copy JSON"; }, 1200); });

(async () => {
  const supported = window.isSecureContext && "PublicKeyCredential" in window;
  let platform = false;
  if (supported && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) platform = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  const support = $("#support"); support.classList.add(supported ? "good" : "bad");
  support.querySelector(".support-icon").textContent = supported ? "✓" : "!";
  support.querySelector("strong").textContent = supported ? "WebAuthn is supported" : "WebAuthn is unavailable";
  support.querySelector("small").textContent = supported ? `${platform ? "Platform authenticator detected" : "Try a security key or password manager"} · ${navigator.userAgentData?.brands?.[0]?.brand || navigator.userAgent.split(" ").at(-1)}` : "Open this page on localhost in a modern browser";
  $("#createButton").disabled = !supported; $("#authButton").disabled = !supported;
})();
