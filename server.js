const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 3000;
const TARGET_FILE =
  process.env.TARGET_FILE ||
  path.resolve(__dirname, "../tarkov-data-overlay-niv/dist/overlay.json");
const PUBLIC_DIR = path.resolve(__dirname, "public");
const MAX_CHANGES = Number(process.env.MAX_CHANGES) || 500;

let lastSnapshot = null;
let lastChanges = [];
let lastUpdatedAt = null;
let lastError = null;
let lastTruncated = false;
let isReading = false;
let pendingRead = false;
const clients = new Set();

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

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function deepEqual(a, b) {
  if (a === b) {
    return true;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  if (isObject(a) && isObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) {
      return false;
    }
    return keysA.every((key) => deepEqual(a[key], b[key]));
  }

  return false;
}

function recordChange(changes, type, pathParts, oldValue, newValue) {
  if (changes.length >= MAX_CHANGES) {
    lastTruncated = true;
    return;
  }
  changes.push({
    type,
    path: pathParts.join(""),
    oldValue,
    newValue,
  });
}

function diffValues(oldValue, newValue, pathParts, changes) {
  if (deepEqual(oldValue, newValue)) {
    return;
  }

  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    const max = Math.max(oldValue.length, newValue.length);
    for (let i = 0; i < max; i += 1) {
      const nextPath = pathParts.concat(`[${i}]`);
      if (i >= oldValue.length) {
        recordChange(changes, "added", nextPath, null, newValue[i]);
      } else if (i >= newValue.length) {
        recordChange(changes, "removed", nextPath, oldValue[i], null);
      } else {
        diffValues(oldValue[i], newValue[i], nextPath, changes);
      }
    }
    return;
  }

  if (isObject(oldValue) && isObject(newValue)) {
    const keys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);
    keys.forEach((key) => {
      const nextPath = pathParts.concat(pathParts.length ? `.${key}` : key);
      if (!(key in oldValue)) {
        recordChange(changes, "added", nextPath, null, newValue[key]);
      } else if (!(key in newValue)) {
        recordChange(changes, "removed", nextPath, oldValue[key], null);
      } else {
        diffValues(oldValue[key], newValue[key], nextPath, changes);
      }
    });
    return;
  }

  recordChange(changes, "changed", pathParts, oldValue, newValue);
}

function getState() {
  return {
    filePath: TARGET_FILE,
    updatedAt: lastUpdatedAt,
    changes: lastChanges,
    truncated: lastTruncated,
    error: lastError,
  };
}

function broadcast(event, payload) {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  clients.forEach((client) => {
    client.write(message);
  });
}

async function refreshSnapshot() {
  if (isReading) {
    pendingRead = true;
    return;
  }

  isReading = true;
  try {
    const [raw, stats] = await Promise.all([
      fs.promises.readFile(TARGET_FILE, "utf8"),
      fs.promises.stat(TARGET_FILE),
    ]);
    const parsed = JSON.parse(raw);

    if (!lastSnapshot) {
      const changes = [];
      lastTruncated = false;
      diffValues({}, parsed, [], changes);
      lastSnapshot = parsed;
      lastChanges = changes;
      lastUpdatedAt = stats.mtime.toISOString();
      lastError = null;
      broadcast("state", getState());
      return;
    }

    const changes = [];
    lastTruncated = false;
    diffValues(lastSnapshot, parsed, [], changes);

    if (changes.length > 0) {
      lastSnapshot = parsed;
      lastChanges = changes;
      lastUpdatedAt = stats.mtime.toISOString();
      lastError = null;
      broadcast("changes", getState());
    }
  } catch (error) {
    lastError = error.message || "Unable to read target file";
    broadcast("error", getState());
  } finally {
    isReading = false;
    if (pendingRead) {
      pendingRead = false;
      refreshSnapshot();
    }
  }
}

fs.watchFile(TARGET_FILE, { interval: 1000 }, (curr, prev) => {
  if (curr.mtimeMs !== prev.mtimeMs) {
    refreshSnapshot();
  }
});

refreshSnapshot();

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

  if (pathname === "/latest") {
    send(
      res,
      200,
      JSON.stringify(getState()),
      "application/json; charset=utf-8",
    );
    return;
  }

  if (pathname === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    });
    res.write(`event: state\ndata: ${JSON.stringify(getState())}\n\n`);
    clients.add(res);
    const keepAlive = setInterval(() => {
      res.write(": keep-alive\n\n");
    }, 15000);
    req.on("close", () => {
      clearInterval(keepAlive);
      clients.delete(res);
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
