import http from "node:http";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "127.0.0.1";
const DEFAULT_PORT = 5506;
const root = await realpath(
  fileURLToPath(new URL("../", import.meta.url)),
);

const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
]);

function allowedFile(name) {
  return [
    "index.html",
    "checks.html",
    "styles.css",
  ].includes(name)
    || name.startsWith("src/")
    || name === "checks/browser.checks.js";
}

function sendText(res, status, message, head = false) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(head ? undefined : message);
}

export function createStaticServer(port = DEFAULT_PORT) {
  return http.createServer(async (req, res) => {
    const head = req.method === "HEAD";

    if (req.method !== "GET" && !head) {
      res.setHeader("Allow", "GET, HEAD");
      sendText(res, 405, "Method not allowed", head);
      return;
    }

    try {
      let pathname;

      try {
        pathname = decodeURIComponent(
          new URL(req.url, `http://${HOST}:${port}`).pathname,
        );
      } catch {
        sendText(res, 400, "Bad request", head);
        return;
      }

      if (
        pathname.includes("\\")
        || pathname.includes("\0")
        || pathname.split("/").some((part) => part.startsWith("."))
      ) {
        sendText(res, 403, "Forbidden", head);
        return;
      }

      const name = pathname === "/"
        ? "index.html"
        : pathname.slice(1);
      const type = types.get(path.extname(name));

      if (!allowedFile(name) || !type) {
        sendText(res, 404, "Not found", head);
        return;
      }

      const filename = await realpath(
        path.join(root, name),
      );
      const relative = path.relative(root, filename);

      if (
        relative.startsWith(`..${path.sep}`)
        || relative === ".."
        || path.isAbsolute(relative)
      ) {
        sendText(res, 403, "Forbidden", head);
        return;
      }

      const content = await readFile(filename);

      res.writeHead(200, {
        "Content-Type": type,
        "Content-Length": content.length,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(head ? undefined : content);
    } catch {
      sendText(res, 404, "Not found", head);
    }
  });
}

export function readWebPort(value) {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_PORT;
  }

  const port = Number(value);

  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new TypeError("Порт сайта должен быть целым числом от 1 до 65535.");
  }

  return port;
}
