const http = require("node:http");
const { readFile, rename, writeFile } = require("node:fs/promises");
const { extname, isAbsolute, relative, resolve } = require("node:path");

const port = Number(process.env.PORT) || 4173;
const root = __dirname;
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

function validPasskey(value) {
  return value && typeof value.credentialId === "string" && /^[A-Za-z0-9_-]+$/.test(value.credentialId) &&
    typeof value.aaguid === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.aaguid);
}

function createServer({ dataFile = process.env.PASSKEY_LOG_FILE || resolve(root, "passkeys.json") } = {}) {
  let mutation = Promise.resolve();
  async function readPasskeys() {
    try {
      const values = JSON.parse(await readFile(dataFile, "utf8"));
      return Array.isArray(values) ? values : [];
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }
  async function savePasskeys(values) {
    const temporary = `${dataFile}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(values, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, dataFile);
  }

  return http.createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname === "/api/passkeys" && request.method === "GET") {
      try { json(response, 200, await readPasskeys()); } catch { json(response, 500, { error: "Unable to read passkey log" }); }
      return;
    }
    if (pathname === "/api/passkeys" && request.method === "POST") {
      try {
        const chunks = [];
        let size = 0;
        for await (const chunk of request) {
          size += chunk.length;
          if (size > 64 * 1024) throw Object.assign(new Error("Request too large"), { status: 413 });
          chunks.push(chunk);
        }
        const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!validPasskey(value)) return json(response, 400, { error: "Invalid passkey record" });
        const record = {
          credentialId: value.credentialId,
          aaguid: value.aaguid.toLowerCase(),
          passwordManager: typeof value.passwordManager === "string" && value.passwordManager.trim() ? value.passwordManager.trim().slice(0, 100) : "Unknown authenticator",
          transports: Array.isArray(value.transports) ? value.transports.filter((item) => typeof item === "string") : [],
          createdAt: new Date().toISOString()
        };
        await (mutation = mutation.catch(() => {}).then(async () => {
          const values = await readPasskeys();
          const existing = values.findIndex((item) => item.credentialId === record.credentialId);
          if (existing >= 0) values[existing] = { ...values[existing], ...record };
          else values.push(record);
          await savePasskeys(values);
        }));
        json(response, 201, record);
      } catch (error) { json(response, error.status || 400, { error: error.status ? error.message : "Invalid JSON body" }); }
      return;
    }
    if (pathname === "/api/passkeys" && request.method !== "GET" && request.method !== "POST") {
      response.writeHead(405, { Allow: "GET, POST" }).end(); return;
    }
    const requested = pathname === "/" ? "index.html" : pathname.slice(1);
    const file = resolve(root, requested);
    const relativePath = relative(root, file);

    // `path.relative` understands the host OS's separators. A literal `/` check
    // made every legitimate asset return 403 when this server ran on Windows.
    if (relativePath.startsWith("..") || isAbsolute(relativePath) || file === resolve(dataFile)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    try {
      const body = await readFile(file);
      response.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
      response.end(body);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
    }
  });
}

if (require.main === module) {
  createServer().listen(port, "127.0.0.1", () => {
    console.log(`Passkey Tester running at http://localhost:${port}`);
  });
}

module.exports = { createServer };
