/**
 * The production server (Railway runs `npm run start`). It does what `serve -s dist` did, files with
 * the SPA fallback to index.html, plus one thing: it works out the visitor's country and writes it into
 * the page as <meta name="praxis-country">, so the home picks the right occasion photos on first paint
 * with no second request and no swap. See docs/OCCASION-PHOTOS.md.
 *
 * Country, in order: a trusted hosting header, only when COUNTRY_HEADER names one (a proxy such as
 * Cloudflare sets it and strips any copy the visitor sends); then the bundled DB-IP database. The IP is
 * looked up and dropped; it is never logged or stored. The page is personal, so it is sent
 * `private, no-cache` and no shared cache can hand one country's page to another. Static files are
 * the same for everyone and cache hard.
 */
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { countryForIp, geoReady, loadGeo } from "./geo.mjs";

const ROOT = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const PORT = Number(process.env.PORT ?? 3000);
const COUNTRY_HEADER = (process.env.COUNTRY_HEADER ?? "").toLowerCase().trim();

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};
const COMPRESSIBLE = new Set([".html", ".js", ".mjs", ".css", ".json", ".svg", ".txt", ".md", ".webmanifest"]);

const INDEX = readFileSync(join(ROOT, "index.html"), "utf8");

const valid = (cc) => (typeof cc === "string" && /^[A-Z]{2}$/.test(cc) && cc !== "XX" && cc !== "ZZ" && cc !== "T1" ? cc : null);

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  const first = typeof fwd === "string" ? fwd.split(",")[0].trim() : "";
  const real = req.headers["x-real-ip"];
  return first || (typeof real === "string" ? real.trim() : "") || req.socket.remoteAddress || "";
}

export function resolveCountry(req) {
  if (COUNTRY_HEADER) {
    const raw = req.headers[COUNTRY_HEADER];
    const cc = valid(typeof raw === "string" ? raw.trim().toUpperCase() : null);
    if (cc) return { countryCode: cc, source: "hosting" };
  }
  const cc = valid(countryForIp(clientIp(req)));
  return cc ? { countryCode: cc, source: "ip" } : { countryCode: null, source: "default" };
}

function send(req, res, status, headers, body) {
  const accepts = /\bgzip\b/.test(req.headers["accept-encoding"] ?? "");
  let out = typeof body === "string" ? Buffer.from(body) : body;
  if (accepts && out.length > 1024) {
    out = gzipSync(out);
    headers["Content-Encoding"] = "gzip";
  }
  headers["Vary"] = "Accept-Encoding";
  headers["Content-Length"] = out.length;
  res.writeHead(status, headers);
  res.end(req.method === "HEAD" ? undefined : out);
}

function page(req, res) {
  const { countryCode, source } = resolveCountry(req);
  const meta = countryCode ? `<meta name="praxis-country" content="${countryCode}" data-source="${source}" />` : "";
  const html = meta ? INDEX.replace("</head>", `    ${meta}\n  </head>`) : INDEX;
  send(req, res, 200, { "Content-Type": TYPES[".html"], "Cache-Control": "private, no-cache" }, html);
}

function file(req, res, path, stat) {
  const ext = extname(path).toLowerCase();
  const type = TYPES[ext] ?? "application/octet-stream";
  const rel = path.slice(ROOT.length).split(sep).join("/");
  const cache = rel.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "public, max-age=604800";
  const headers = { "Content-Type": type, "Cache-Control": cache, "Last-Modified": stat.mtime.toUTCString(), "Accept-Ranges": "bytes" };
  if (req.headers["if-modified-since"] && new Date(req.headers["if-modified-since"]) >= new Date(stat.mtime.toUTCString())) {
    res.writeHead(304, headers);
    return res.end();
  }
  if (COMPRESSIBLE.has(ext)) return send(req, res, 200, headers, readFileSync(path));
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : stat.size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : stat.size - 1;
    start = Math.max(0, start);
    end = Math.min(end, stat.size - 1);
    if (start > end) {
      res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
      return res.end();
    }
    res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": end - start + 1 });
    if (req.method === "HEAD") return res.end();
    return createReadStream(path, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, "Content-Length": stat.size });
  if (req.method === "HEAD") return res.end();
  createReadStream(path).pipe(res);
}

export const server = createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end();
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  } catch {
    res.writeHead(400);
    return res.end();
  }
  if (pathname === "/api/country") {
    const body = JSON.stringify({ ...resolveCountry(req), ready: geoReady() });
    return send(req, res, 200, { "Content-Type": TYPES[".json"], "Cache-Control": "private, no-store" }, body);
  }
  const path = normalize(join(ROOT, pathname));
  if (path !== ROOT && !path.startsWith(ROOT + sep)) {
    res.writeHead(403);
    return res.end();
  }
  if (path !== ROOT && pathname !== "/index.html" && existsSync(path)) {
    const stat = statSync(path);
    if (stat.isFile()) return file(req, res, path, stat);
  }
  /* Asset-looking paths that are missing get a real 404, so a lost image falls back instead of rendering HTML. */
  if (extname(pathname) && extname(pathname) !== ".html") {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" });
    return res.end("Not found");
  }
  page(req, res);
});

server.listen(PORT, () => console.log(`Praxis on :${PORT}`));
loadGeo().then(
  (n) => console.log(`Country tables ready (${n.v4} IPv4, ${n.v6} IPv6 ranges)`),
  (err) => console.error("Country tables failed to load; every visitor gets the default photos.", err),
);
