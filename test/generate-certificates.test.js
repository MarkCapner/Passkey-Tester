const assert = require("node:assert/strict");
const { test } = require("node:test");
const { certificateSubjectAltNames, opensslPath } = require("../scripts/generate-certificates");

test("creates a certificate valid for the public hostname and local development", () => {
  assert.deepEqual(certificateSubjectAltNames(["127.0.0.1", "192.0.2.10"]), [
    "DNS.1 = passkey-tester.com",
    "DNS.2 = localhost",
    "IP.1 = 127.0.0.1",
    "IP.2 = 192.0.2.10"
  ]);
});

test("uses an explicitly configured OpenSSL executable", () => {
  assert.equal(opensslPath({ environment: { OPENSSL_PATH: "D:\\OpenSSL\\openssl.exe" }, platform: "win32" }), "D:\\OpenSSL\\openssl.exe");
});

test("finds the OpenSSL executable bundled with Git for Windows", () => {
  const expected = "C:\\Program Files\\Git\\usr\\bin\\openssl.exe";
  assert.equal(opensslPath({
    environment: { ProgramFiles: "C:\\Program Files" },
    platform: "win32",
    fileExists: (path) => path === expected
  }), expected);
});

test("falls back to the command on PATH", () => {
  assert.equal(opensslPath({ environment: {}, platform: "win32", fileExists: () => false }), "openssl");
  assert.equal(opensslPath({ environment: {}, platform: "linux" }), "openssl");
});
