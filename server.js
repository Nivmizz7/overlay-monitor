const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 3000;
const README_PATH =
  process.env.TARGET_README ||
  path.resolve(__dirname, "../tarkov-data-overlay-niv/README.md");
const PUBLIC_DIR = path.resolve(__dirname, "public");

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function safeJoin(base, requestPath) {
  const normalized = path.normalize(path.join(base, requestPath));
  if (!normalized.startsWith(base)) {
    return null;
  }
  return normalized;
}

function serveStatic(res, requestPath) {
  const filePath = safeJoin(PUBLIC_DIR, requestPath);
  if (!filePath) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, "Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      ext === ".html"
        ? "text/html; charset=utf-8"
        : ext === ".css"
          ? "text/css; charset=utf-8"
          : ext === ".js"
            ? "application/javascript; charset=utf-8"
            : "application/octet-stream";

    send(res, 200, data, contentType);
  });
}

const server = http.createServer((req, res) => {
  if (!req.url || !req.method) {
    send(res, 400, "Bad request");
    return;
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = requestUrl.pathname;

  if (req.method !== "GET") {
    send(res, 405, "Method not allowed");
    return;
  }

  if (pathname === "/readme") {
    fs.readFile(README_PATH, "utf8", (readErr, content) => {
      if (readErr) {
        send(res, 500, "Unable to read README");
        return;
      }

      fs.stat(README_PATH, (statErr, stats) => {
        const payload = {
          content,
          mtimeMs: statErr ? Date.now() : stats.mtimeMs,
          path: README_PATH,
        };
        send(res, 200, JSON.stringify(payload), "application/json; charset=utf-8");
      });
    });
    return;
  }

  const filePath = pathname === "/" ? "/index.html" : pathname;
  serveStatic(res, filePath);
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Overlay monitor running at http://localhost:${PORT}`);
});
