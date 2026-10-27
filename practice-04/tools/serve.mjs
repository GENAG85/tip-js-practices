import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const portArg = Number(process.argv[2]);
const port = Number.isSafeInteger(portArg) && portArg > 0 ? portArg : 5504;

const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
]);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";

    const requested = path.resolve(root, `.${pathname}`);
    if (!requested.startsWith(root + path.sep) && requested !== root) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    let filePath = requested;
    try {
      const info = await stat(filePath);
      if (info.isDirectory()) filePath = path.join(filePath, "index.html");
    } catch {
      res.writeHead(404).end("Not found");
      return;
    }

    const body = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": types.get(path.extname(filePath)) ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`Server error: ${error.message}`);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`ПР4 запущена: http://127.0.0.1:${port}/`);
  console.log(`Вариант 8: http://127.0.0.1:${port}/index.html?dataset=variant`);
  console.log(`Проверки: http://127.0.0.1:${port}/checks.html`);
});
