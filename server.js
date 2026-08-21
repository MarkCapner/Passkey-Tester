const http = require("node:http");
const https = require("node:https");
const { readFile } = require("node:fs/promises");
const { networkInterfaces } = require("node:os");
const { extname, isAbsolute, relative, resolve } = require("node:path");
const { createMetadataService } = require("./metadata-service");
const { createSharedStore } = require("./shared-store");

const port = Number(process.env.PORT) || 443;
const host = process.env.HOST || "0.0.0.0";
const root = __dirname;
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

async function jsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error("Request body is too large");
  }
  return JSON.parse(body || "{}");
}

function requestHandler({ metadataService, sharedStore }) {
  return async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const collection = { "/api/activity": "activity", "/api/credentials": "credentials" }[pathname];
    if (collection) {
      try {
        if (request.method === "GET") return sendJson(response, 200, await sharedStore.list(collection));
        if (request.method === "POST") {
          const body = await jsonBody(request);
          const records = Array.isArray(body) ? body : [body];
          if (records.some((record) => !record || typeof record.id !== "string")) return sendJson(response, 400, { error: "Every record must have an id" });
          return sendJson(response, 200, await sharedStore.merge(collection, records));
        }
        if (request.method === "DELETE" && collection === "activity") return sendJson(response, 200, await sharedStore.clearActivity());
        return sendJson(response, 405, { error: "Method not allowed" });
      } catch (error) {
        return sendJson(response, error instanceof SyntaxError ? 400 : 500, { error: error.message });
      }
    }
    const metadataMatch = pathname.match(/^\/api\/metadata\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
    if (metadataMatch) {
      try {
        const metadata = await metadataService.find(metadataMatch[1]);
        // An unknown AAGUID is a successful lookup with no result, not a
        // missing HTTP resource. Returning JSON null also avoids reporting an
        // expected metadata miss as a failed request in browser developer
        // tools.
        response.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          // A missing AAGUID may appear in a later MDS release. Do not let a
          // browser's disk cache preserve that transient negative result.
          "Cache-Control": metadata ? "public, max-age=86400" : "no-store"
        });
        response.end(JSON.stringify(metadata));
      } catch (error) {
        response.writeHead(502, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
        response.end(JSON.stringify({ error: "FIDO metadata BLOB unavailable" }));
      }
      return;
    }
    const requested = pathname === "/" ? "index.html" : pathname.slice(1);
    const file = resolve(root, requested);
    const relativePath = relative(root, file);

    // `path.relative` understands the host OS's separators. A literal `/` check
    // made every legitimate asset return 403 when this server ran on Windows.
    if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
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
  };
}

function createServer({ metadataService = createMetadataService(), sharedStore = createSharedStore(resolve(root, "data", "shared-state.json")), tls } = {}) {
  const handler = requestHandler({ metadataService, sharedStore });
  return tls ? https.createServer(tls, handler) : http.createServer(handler);
}

function networkUrls(listenPort) {
  const addresses = new Set(["passkey-tester.com", "localhost"]);
  for (const interfaces of Object.values(networkInterfaces())) {
    for (const address of interfaces || []) {
      if (address.family === "IPv4" && !address.internal) addresses.add(address.address);
    }
  }
  const portSuffix = listenPort === 443 ? "" : `:${listenPort}`;
  return [...addresses].map((address) => `https://${address}${portSuffix}`);
}

if (require.main === module) {
  Promise.all([
    readFile(resolve(root, "certs", "passkey-tester.key")),
    readFile(resolve(root, "certs", "passkey-tester.crt"))
  ]).then(([key, cert]) => {
    createServer({ tls: { key, cert } }).listen(port, host, () => {
      console.log(`Passkey Tester is available at:\n${networkUrls(port).map((url) => `  ${url}`).join("\n")}`);
    });
  }).catch((error) => {
    console.error(`Unable to start HTTPS: ${error.message}\nRun \"npm run certificates\" to create the local certificates.`);
    process.exitCode = 1;
  });
}

module.exports = { createServer, networkUrls };
