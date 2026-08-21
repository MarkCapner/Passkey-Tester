const { execFileSync } = require("node:child_process");
const { existsSync, mkdirSync, rmSync, writeFileSync } = require("node:fs");
const { networkInterfaces } = require("node:os");
const { resolve, win32 } = require("node:path");

const root = resolve(__dirname, "..");
const directory = resolve(root, "certs");
const caKey = resolve(directory, "passkey-tester-ca.key");
const caCertificate = resolve(directory, "passkey-tester-ca.crt");
const serverKey = resolve(directory, "passkey-tester.key");
const serverCertificate = resolve(directory, "passkey-tester.crt");
const request = resolve(directory, "passkey-tester.csr");
const extensions = resolve(directory, "extensions.cnf");
const serial = resolve(directory, "passkey-tester-ca.srl");
const force = process.argv.includes("--force");

function opensslPath({ environment = process.env, platform = process.platform, fileExists = existsSync } = {}) {
  if (environment.OPENSSL_PATH) return environment.OPENSSL_PATH;
  if (platform !== "win32") return "openssl";

  const candidates = [
    environment.ProgramFiles && win32.join(environment.ProgramFiles, "Git", "usr", "bin", "openssl.exe"),
    environment["ProgramFiles(x86)"] && win32.join(environment["ProgramFiles(x86)"], "Git", "usr", "bin", "openssl.exe"),
    environment.LOCALAPPDATA && win32.join(environment.LOCALAPPDATA, "Programs", "Git", "usr", "bin", "openssl.exe"),
    environment.ChocolateyInstall && win32.join(environment.ChocolateyInstall, "bin", "openssl.exe")
  ].filter(Boolean);

  return candidates.find(fileExists) || "openssl";
}

function openssl(...arguments_) {
  try {
    execFileSync(opensslPath(), arguments_, { stdio: "inherit" });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    throw new Error([
      "OpenSSL was not found.",
      "Install OpenSSL (Git for Windows includes it), restart your terminal, and run npm start again.",
      "Alternatively, set OPENSSL_PATH to the full path of openssl.exe; for example:",
      '  $env:OPENSSL_PATH = "C:\\Program Files\\Git\\usr\\bin\\openssl.exe"'
    ].join("\n"), { cause: error });
  }
}

function localAddresses() {
  const addresses = new Set(["127.0.0.1"]);
  for (const interfaces of Object.values(networkInterfaces())) {
    for (const address of interfaces || []) {
      if (address.family === "IPv4" && !address.internal) addresses.add(address.address);
    }
  }
  return [...addresses];
}

function generateCertificates() {
  mkdirSync(directory, { recursive: true });

  if (!force && existsSync(caCertificate) && existsSync(serverCertificate) && existsSync(serverKey)) {
    console.log("Using the existing certificates in certs/. Run npm run certificates -- --force after your network address changes.");
    return;
  }

  if (force) {
    for (const path of [caKey, caCertificate, serverKey, serverCertificate]) rmSync(path, { force: true });
  }

  try {
    openssl("req", "-x509", "-newkey", "rsa:2048", "-sha256", "-nodes", "-days", "3650", "-keyout", caKey, "-out", caCertificate, "-subj", "/CN=Passkey Tester Local CA", "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign,cRLSign");
    openssl("req", "-newkey", "rsa:2048", "-sha256", "-nodes", "-keyout", serverKey, "-out", request, "-subj", "/CN=Passkey Tester");

    const subjectAltNames = ["DNS.1 = localhost", ...localAddresses().map((address, index) => `IP.${index + 1} = ${address}`)];
    writeFileSync(extensions, `[server_certificate]\nbasicConstraints = critical,CA:FALSE\nkeyUsage = critical,digitalSignature,keyEncipherment\nextendedKeyUsage = serverAuth\nsubjectAltName = @alt_names\n\n[alt_names]\n${subjectAltNames.join("\n")}\n`);
    openssl("x509", "-req", "-sha256", "-days", "397", "-in", request, "-CA", caCertificate, "-CAkey", caKey, "-CAserial", serial, "-CAcreateserial", "-out", serverCertificate, "-extfile", extensions, "-extensions", "server_certificate");
    console.log(`Created an HTTPS certificate for localhost and ${localAddresses().join(", ")}.`);
    console.log(`Install and trust ${caCertificate} on each device that will use Passkey Tester.`);
  } finally {
    rmSync(request, { force: true });
    rmSync(extensions, { force: true });
    rmSync(serial, { force: true });
  }
}

if (require.main === module) generateCertificates();

module.exports = { opensslPath };
