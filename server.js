const http = require("node:http");
const { readFile } = require("node:fs/promises");
const { extname, isAbsolute, relative, resolve } = require("node:path");

const port = Number(process.env.PORT) || 4173;
const root = __dirname;
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

function createServer() {
  return http.createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
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
  });
}

if (require.main === module) {
  createServer().listen(port, "127.0.0.1", () => {
    console.log(`Passkey Tester running at http://localhost:${port}`);
  });
}

module.exports = { createServer };