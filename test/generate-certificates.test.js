const assert = require("node:assert/strict");
const { test } = require("node:test");
const { opensslPath } = require("../scripts/generate-certificates");

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
