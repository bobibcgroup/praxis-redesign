/**
 * Outfit pictures on the server, whatever provider makes them (server/ai.mjs calls these around
 * outfit_visualization):
 *
 * - The spec. A browser's spec is never trusted as sent: canonicalSpec keeps only known fields, takes a
 *   reference piece's picture from Praxis's own catalogue by id (src/shared/references.mjs), accepts a
 *   store photo only from the store's own image hosts, and fixes the model and render settings here.
 * - The cache. A picture is kept under a key the server works out from that canonical spec and the
 *   provider's version, so the same composition is never made, or paid for, twice, and no request can
 *   put its picture under another composition's name. Pictures are kept on disk (VISUALS_DIR) and
 *   served at /api/visuals/<key>.jpg.
 * - The money. A paid provider marked `budgeted` runs only inside an approved budget: the total
 *   (OUTFIT_IMAGE_BUDGET_USD, default the 20 USD Tarek approved on 2026-10-12 for testing) and a daily
 *   ceiling (OUTFIT_IMAGE_DAILY_USD, default 6). The most a request can cost is set aside before it runs,
 *   so two at once can't pass the budget together. Spend is written to disk after every call. Each
 *   visitor also has a daily ceiling of new pictures (VISUALIZATION_DAILY_CAP, default 12), and so does each
 *   network address (VISUALIZATION_ADDRESS_DAILY_CAP, default 30), since a visitor's id is the browser's own
 *   word; addresses are kept only as a hash, in memory, for the day.
 * - The ledger counts requests, cache hits, refusals, failures and cost; each call is logged with its
 *   cost and nothing about the person.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { referencePiece } from "../src/shared/references.mjs";

/** Tarek's written approval in the project thread, 2026-10-12: "a small budget of 10 to 25 USD". */
export const APPROVED_BUDGET_USD = 20;
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 500;
const IMAGE_KEY = /^img_[0-9a-f]{24}$/;

const num = (v, fallback) => {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) && n >= 0 ? n : fallback;
};
export const budgetUsd = () => num(process.env.OUTFIT_IMAGE_BUDGET_USD, APPROVED_BUDGET_USD);
const dailyUsd = () => num(process.env.OUTFIT_IMAGE_DAILY_USD, 6);
const dailyCap = () => num(process.env.VISUALIZATION_DAILY_CAP, 12);
const addressCap = () => num(process.env.VISUALIZATION_ADDRESS_DAILY_CAP, 30);

/** Where pictures and the spend are kept: a mounted volume when there is one, else the temp folder. */
export function visualsDir() {
  const dir = process.env.VISUALS_DIR || (process.env.RAILWAY_VOLUME_MOUNT_PATH ? join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "visuals") : join(tmpdir(), "praxis-visuals"));
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    /* read only: pictures stay in memory */
  }
  return dir;
}

const cache = new Map();
const images = new Map();
const perVisitor = new Map();
const perAddress = new Map();
let reserved = 0;
export const ledger = { requests: 0, cacheHits: 0, refused: 0, failures: 0, costUsd: 0, spentUsd: 0, day: "", dayUsd: 0 };

function loadSpend() {
  try {
    const saved = JSON.parse(readFileSync(join(visualsDir(), "spend.json"), "utf8"));
    ledger.spentUsd = num(saved.spentUsd, 0);
    ledger.day = String(saved.day ?? "");
    ledger.dayUsd = num(saved.dayUsd, 0);
  } catch {
    /* nothing spent yet */
  }
}
loadSpend();
function saveSpend() {
  try {
    writeFileSync(join(visualsDir(), "spend.json"), JSON.stringify({ spentUsd: ledger.spentUsd, day: ledger.day, dayUsd: ledger.dayUsd, at: new Date().toISOString() }));
  } catch {
    /* kept in memory */
  }
}

export function resetVisuals() {
  cache.clear();
  images.clear();
  perVisitor.clear();
  perAddress.clear();
  reserved = 0;
  Object.assign(ledger, { requests: 0, cacheHits: 0, refused: 0, failures: 0, costUsd: 0, spentUsd: 0, day: "", dayUsd: 0 });
}

const today = (now) => new Date(now).toISOString().slice(0, 10);

/** Whether a paid provider may run one more request now, and how much of the budget is left. */
export function approval(engine, now = Date.now()) {
  if (!engine?.billable) return { approved: true, remainingUsd: Infinity };
  if (!engine.budgeted) return { approved: process.env.ALLOW_BILLABLE_AI === "true", remainingUsd: Infinity };
  const most = num(engine.maxCostPerRequestUsd, 1);
  const day = ledger.day === today(now) ? ledger.dayUsd : 0;
  const remainingUsd = Math.max(0, Math.min(budgetUsd() - ledger.spentUsd, dailyUsd() - day) - reserved);
  return { approved: remainingUsd >= most, remainingUsd: Math.round(remainingUsd * 100) / 100 };
}

/* ------------------------------------------------------------ the spec */

const str = (v, max) => (typeof v === "string" && v.trim() && v.length <= max ? v.trim() : undefined);
const SLOTS = ["top", "bottom", "shoes", "extras"];
const SOURCES = ["shopify", "reference", "wardrobe"];

/** The store's own image hosts: Shopify's CDN, the configured store, and any listed in VISUAL_PHOTO_HOSTS. */
export function photoHostAllowed(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const store = (process.env.RETAIL_SHOPIFY_STORE ?? "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "").toLowerCase();
  const extra = (process.env.VISUAL_PHOTO_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  const host = u.hostname.toLowerCase();
  return host === "cdn.shopify.com" || host.endsWith(".myshopify.com") || (store && (host === store || host.endsWith(`.${store}`))) || extra.includes(host);
}

function attributes(v) {
  if (!v || typeof v !== "object") return undefined;
  const out = {};
  for (const k of ["subcategory", "colour", "material", "fit", "silhouette"]) {
    const t = str(v[k], 60);
    if (t) out[k] = t;
  }
  if (Number.isInteger(v.formality) && v.formality >= 1 && v.formality <= 5) out.formality = v.formality;
  return Object.keys(out).length ? out : undefined;
}

/**
 * The spec as the server will render it, or null when it isn't one. Only known fields of up to six
 * pieces survive; a reference piece is replaced by Praxis's own record of it; a store piece keeps its
 * photo only when it comes from the store's hosts; the customer's own piece goes by words only.
 */
export function canonicalSpec(payload) {
  const spec = payload?.spec;
  const outfitId = str(payload?.outfitId, 120);
  if (!spec || typeof spec !== "object" || !outfitId || !Array.isArray(spec.garments) || spec.garments.length === 0 || spec.garments.length > 6) return null;
  const garments = [];
  for (const g of spec.garments) {
    if (!g || typeof g !== "object" || !SOURCES.includes(g.source) || !SLOTS.includes(g.slot)) return null;
    const garmentId = str(g.garmentId, 200);
    const name = str(g.name, 80);
    if (!garmentId || !name) return null;
    const layer = g.layer === "outer" || g.layer === "base" ? g.layer : undefined;
    if (g.source === "reference") {
      const ref = referencePiece(g.referenceId);
      if (!ref) return null;
      garments.push({ garmentId, source: "reference", slot: ref.slot, ...(ref.layer ? { layer: ref.layer } : {}), name: ref.name, attributes: { subcategory: ref.subcategory, colour: ref.colour, material: ref.material, fit: ref.fit, silhouette: ref.silhouette, formality: ref.formality }, referenceId: ref.id, ...(ref.region ? { photo: { file: ref.src, region: ref.region } } : {}) });
      continue;
    }
    const base = { garmentId, source: g.source, slot: g.slot, ...(layer ? { layer } : {}), name, ...(attributes(g.attributes) ? { attributes: attributes(g.attributes) } : {}) };
    if (g.source === "wardrobe") {
      garments.push(base);
      continue;
    }
    const photo = str(g.imageUrl, 1000);
    garments.push({ ...base, ...(photo && photoHostAllowed(photo) ? { imageUrl: photo } : {}), ...(str(g.retailerProductId, 200) ? { retailerProductId: str(g.retailerProductId, 200) } : {}), ...(str(g.retailerVariantId, 80) ? { retailerVariantId: str(g.retailerVariantId, 80) } : {}) });
  }
  const slots = new Set(garments.map((g) => g.slot));
  if (!slots.has("top") || !slots.has("bottom")) return null;
  return { outfitId, garments, render: { aspectRatio: "3:4", imageSize: "1K" } };
}

/** The server's own name for a composition with a provider: what the picture is kept and served under. */
export function imageKey(canonical, engine) {
  const h = createHash("sha256").update(JSON.stringify({ canonical, provider: `${engine?.id}@${engine?.version}`, model: engine?.modelSetup ?? null })).digest("hex");
  return `img_${h.slice(0, 24)}`;
}

/** The money so far, for the health check: no addresses, no pictures, no visitors. */
export function pictureSpend(now = Date.now()) {
  return {
    budgetUsd: budgetUsd(),
    dailyUsd: dailyUsd(),
    spentUsd: ledger.spentUsd,
    todayUsd: ledger.day === today(now) ? ledger.dayUsd : 0,
    made: ledger.requests,
    cacheHits: ledger.cacheHits,
    refused: ledger.refused,
    failures: ledger.failures,
    keptOnVolume: Boolean(process.env.VISUALS_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH),
  };
}

/* ------------------------------------------------------------ pictures */

/** Keeps a picture made for a key, on disk when it can; returns where it is served. */
export function storeImage(key, buffer) {
  if (!IMAGE_KEY.test(key)) throw new Error("bad picture key");
  if (images.size >= 60) images.delete(images.keys().next().value);
  images.set(key, buffer);
  try {
    writeFileSync(join(visualsDir(), `${key}.jpg`), buffer);
  } catch {
    /* memory only */
  }
  return `/api/visuals/${key}.jpg`;
}

/** A kept picture, or null. */
export function readImage(key) {
  if (!IMAGE_KEY.test(key)) return null;
  if (images.has(key)) return images.get(key);
  const file = join(visualsDir(), `${key}.jpg`);
  if (!existsSync(file)) return null;
  try {
    return readFileSync(file);
  } catch {
    return null;
  }
}

/** GET /api/visuals/<key>.jpg */
export function handleVisual(req, res, key) {
  const buf = readImage(key);
  if (!buf) {
    res.writeHead(404, { "Cache-Control": "no-store" });
    return res.end();
  }
  res.writeHead(200, { "Content-Type": "image/jpeg", "Content-Length": buf.length, "Cache-Control": "public, max-age=604800, immutable", "X-Content-Type-Options": "nosniff" });
  return res.end(req.method === "HEAD" ? undefined : buf);
}

/* ------------------------------------------------------------ around each call */

/**
 * Before calling the provider: a cached answer, a refusal, or { go } with the canonical spec, its key
 * and the money set aside. Call settle(go) once the provider has answered.
 */
export function beforeVisual(body, engine = null, now = Date.now(), address = "") {
  const canonical = canonicalSpec(body?.payload);
  if (!canonical) {
    ledger.refused += 1;
    return { answer: { status: "failed", error: { code: "validation_error", message: "The outfit to picture isn't one I can make.", retryable: false } } };
  }
  const key = imageKey(canonical, engine);
  const hit = cache.get(key);
  if (hit && now - hit.at < KEEP_MS && readImage(key)) {
    ledger.cacheHits += 1;
    return { answer: { ...hit.answer, metadata: { ...(hit.answer.metadata ?? {}), cached: true, costUsd: 0 } } };
  }
  const who = String(body?.anonymousSessionId ?? "");
  const day = today(now);
  const seen = perVisitor.get(who);
  const count = seen && seen.day === day ? seen.count : 0;
  const where = address ? createHash("sha256").update(`${day}:${address}`).digest("hex").slice(0, 16) : "";
  const fromHere = where && perAddress.get(where)?.day === day ? perAddress.get(where).count : 0;
  if (count >= dailyCap() || fromHere >= addressCap()) {
    ledger.refused += 1;
    return { answer: { status: "failed", error: { code: "rate_limited", message: "Enough pictures for today.", retryable: false } } };
  }
  const allowed = approval(engine, now);
  if (!allowed.approved) {
    ledger.refused += 1;
    return { answer: { status: "failed", error: { code: "budget_reached", message: "The approved budget for pictures is spent.", retryable: false } } };
  }
  perVisitor.set(who, { day, count: count + 1 });
  if (where) {
    if (perAddress.size > 5000) perAddress.clear();
    perAddress.set(where, { day, count: fromHere + 1 });
  }
  const hold = engine?.billable ? num(engine.maxCostPerRequestUsd, 1) : 0;
  reserved += hold;
  return { go: { canonical, key, hold } };
}

/** After the provider answers: the picture must be for this outfit; records the real cost and keeps it for the same composition. */
export function afterVisual(body, engine, out, go = null, now = Date.now()) {
  if (go) reserved = Math.max(0, reserved - go.hold);
  ledger.requests += 1;
  const reported = Number(out?.metadata?.costUsd);
  const costUsd = Number.isFinite(reported) && reported >= 0 ? reported : out?.status === "succeeded" ? Number(engine?.costPerImageUsd) || 0 : 0;
  if (costUsd > 0) {
    const day = today(now);
    if (ledger.day !== day) Object.assign(ledger, { day, dayUsd: 0 });
    ledger.dayUsd = Math.round((ledger.dayUsd + costUsd) * 10000) / 10000;
    ledger.spentUsd = Math.round((ledger.spentUsd + costUsd) * 10000) / 10000;
    saveSpend();
  }
  ledger.costUsd = Math.round((ledger.costUsd + costUsd) * 10000) / 10000;
  const ok = (out?.status === "succeeded" || out?.status === "partial") && out.result?.outfitId === body.payload.outfitId;
  console.log(`visual ${body.requestId} ${engine?.id ?? "unknown"} ${ok ? "ok" : (out?.error?.code ?? out?.status ?? "failed")} cost=${costUsd} spent=${ledger.spentUsd} budget=${budgetUsd()} hits=${ledger.cacheHits}`);
  if (!ok) {
    ledger.failures += 1;
    if (out?.status === "succeeded") return { status: "failed", error: { code: "validation_error", message: "The picture was for another outfit.", retryable: false }, metadata: { costUsd } };
    return { ...out, metadata: { ...(out?.metadata ?? {}), costUsd } };
  }
  const answer = { ...out, metadata: { ...(out.metadata ?? {}), costUsd } };
  if (go?.key) {
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
    cache.set(go.key, { at: now, answer });
  }
  return answer;
}
