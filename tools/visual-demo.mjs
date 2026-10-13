#!/usr/bin/env node
/**
 * The three demonstration outfits of the visualization brief, made on a deployed Praxis exactly as the
 * results page asks for a picture (POST /api/ai/outfit_visualization), with their source pictures beside
 * the result:
 *
 *   A  store blazer, reference shirt, store trousers, reference shoes
 *   B  every piece the store can supply (the store sells no shoes, so the shoes are a reference, and the
 *      summary says so)
 *   C  every piece a reference
 *
 * Store pieces are the store's own candidates from the deployed product search; references are Praxis's
 * catalogue ids. This makes paid pictures on the deployed server, inside its approved budget: about 0.14 to
 * 0.28 USD per outfit, and nothing for an outfit already made.
 *
 *   node tools/visual-demo.mjs https://praxis-redesign-production.up.railway.app [out-dir] [A,B,C]
 *
 * Writes <out-dir>/<outfit>/{result.jpg, sheet.jpg, piece-*.jpg} and <out-dir>/summary.{md,json}.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { referencePiece } from "../src/shared/references.mjs";

const BASE = (process.argv[2] ?? process.env.DEMO_URL ?? "").replace(/\/$/, "");
const OUT = process.argv[3] ?? "visual-demo";
const WANT = new Set((process.argv[4] ?? "A,B,C").split(","));
if (!BASE) {
  console.error("Usage: node tools/visual-demo.mjs <url> [out-dir] [A,B,C]");
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

const envelope = (service, payload, n) => ({ requestId: `demo-${n}-${Date.now()}`, service, contractVersion: "ai-2026-10-12", anonymousSessionId: "anon_visual_demo", attempt: 1, createdAt: new Date().toISOString(), payload });
const post = async (service, payload, n) => {
  const res = await fetch(`${BASE}/api/ai/${service}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(envelope(service, payload, n)) });
  return { http: res.status, body: await res.json().catch(() => ({})) };
};

/* ------------------------------------------------------------ the store's candidates */

const WANTED = [
  { garmentId: "want-blazer", slot: "top", layer: "outer", subcategory: "blazer", colour: "navy", formality: 4, name: "Navy wool blazer" },
  { garmentId: "want-jacket", slot: "top", layer: "outer", subcategory: "jacket", colour: "brown", formality: 2, name: "Brown jacket" },
  { garmentId: "want-shirt", slot: "top", layer: "base", subcategory: "shirt", colour: "blue", formality: 3, name: "Blue oxford shirt" },
  { garmentId: "want-trousers", slot: "bottom", subcategory: "trousers", colour: "grey", formality: 4, name: "Grey wool trousers" },
  { garmentId: "want-chinos", slot: "bottom", subcategory: "chinos", colour: "beige", formality: 3, name: "Stone chinos" },
  { garmentId: "want-shoes", slot: "shoes", subcategory: "loafers", colour: "brown", formality: 4, name: "Brown loafers" },
];
const found = await post("product_matching", { garments: WANTED, budget: "ELEVATED", currency: "USD" }, "match");
// In stock first; a picture doesn't need stock, so a sold out piece of the right kind will do.
const first = (id) => {
  const products = ((found.body.result?.matches ?? []).find((m) => m.garmentId === id)?.products ?? []).filter((p) => p.imageUrl);
  return products.find((p) => p.availability !== "out_of_stock") ?? products[0];
};
const store = Object.fromEntries(WANTED.map((w) => [w.garmentId, first(w.garmentId)]));
console.log(`store search: ${found.body.status}; ${Object.entries(store).map(([k, p]) => `${k}=${p ? p.title : "none"}`).join(", ")}`);

const fromStore = (want, p, id) => {
  if (!p) return null;
  const a = p.attributes ?? {};
  return {
    garmentId: id,
    source: "shopify",
    slot: want.slot,
    ...(want.layer ? { layer: want.layer } : {}),
    name: p.title,
    attributes: { subcategory: a.subcategory ?? want.subcategory, colour: a.colour ?? want.colour, ...(a.material ? { material: a.material } : {}), ...(a.fit ? { fit: a.fit } : {}) },
    imageUrl: p.imageUrl,
    retailerProductId: p.productId,
    ...(p.variantId ? { retailerVariantId: p.variantId } : {}),
  };
};
const fromReference = (referenceId, id) => {
  const r = referencePiece(referenceId);
  return { garmentId: id, source: "reference", slot: r.slot, ...(r.layer ? { layer: r.layer } : {}), name: r.name, referenceId };
};
const W = Object.fromEntries(WANTED.map((w) => [w.garmentId, w]));

const notes = { A: [], B: [], C: [] };
const OUTFITS = {
  A: [fromStore(W["want-blazer"], store["want-blazer"], "a-blazer"), fromReference("ref_work_safest_01_base", "a-shirt"), fromStore(W["want-trousers"], store["want-trousers"], "a-trousers"), fromReference("ref_work_relaxed_01_shoes", "a-shoes")],
  B: [
    fromStore(W["want-jacket"], store["want-jacket"], "b-jacket"),
    fromStore(W["want-shirt"], store["want-shirt"], "b-shirt"),
    fromStore(W["want-chinos"], store["want-chinos"], "b-chinos"),
    fromStore(W["want-shoes"], store["want-shoes"], "b-shoes") ?? (notes.B.push("The store sells no shoes, so the shoes are a Praxis reference."), fromReference("ref_wedding_relaxed_01_shoes", "b-shoes")),
  ],
  C: ["outer", "base", "bottom", "shoes"].map((part) => fromReference(`ref_date_safest_01_${part}`, `c-${part}`)),
};
for (const [k, list] of Object.entries(OUTFITS)) {
  const missing = list.filter((g) => !g).length;
  if (missing) notes[k].push(`${missing} store piece${missing > 1 ? "s" : ""} not found in the store search; left out.`);
  OUTFITS[k] = list.filter(Boolean);
}

/* ------------------------------------------------------------ pictures */

async function sourcePicture(g) {
  if (g.source === "shopify") {
    const res = await fetch(g.imageUrl);
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  }
  const r = referencePiece(g.referenceId);
  const res = await fetch(`${BASE}${r.src}`);
  if (!res.ok || !r.region) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const m = await sharp(buf).metadata();
  const { x, y, w, h } = r.region;
  return sharp(buf).extract({ left: Math.round(x * m.width), top: Math.round(y * m.height), width: Math.round(w * m.width), height: Math.round(h * m.height) }).jpeg().toBuffer();
}

/** One sheet: the source pictures on the left, labelled, the made picture (or a note) on the right. */
async function sheet(pieces, result) {
  const H = 1024, cellW = 300, cellH = Math.floor(H / Math.max(4, pieces.length));
  const W2 = result ? 768 : 600;
  const layers = [];
  for (const [i, p] of pieces.entries()) {
    if (p.image) layers.push({ input: await sharp(p.image).resize(cellW - 16, cellH - 44, { fit: "contain", background: "#efe2cc" }).toBuffer(), left: 8, top: i * cellH + 8 });
    const label = `${p.g.source === "shopify" ? "STORE" : "REFERENCE"}: ${p.g.name}`.replace(/[<&>]/g, "").slice(0, 44);
    layers.push({ input: Buffer.from(`<svg width="${cellW}" height="30"><text x="8" y="20" font-family="sans-serif" font-size="13" fill="#2b241d">${label}</text></svg>`), left: 0, top: (i + 1) * cellH - 34 });
  }
  layers.push({ input: result ? await sharp(result).resize(W2, H, { fit: "contain", background: "#efe2cc" }).toBuffer() : Buffer.from(`<svg width="${W2}" height="${H}"><rect width="100%" height="100%" fill="#e1caa8"/><text x="40" y="${H / 2}" font-family="sans-serif" font-size="28" fill="#2b241d">integration-pending: no picture made</text></svg>`), left: cellW, top: 0 });
  return sharp({ create: { width: cellW + W2, height: H, channels: 3, background: "#efe2cc" } }).composite(layers).jpeg({ quality: 88 }).toBuffer();
}

const summary = [];
for (const [k, garments] of Object.entries(OUTFITS)) {
  if (!WANT.has(k)) continue;
  const dir = join(OUT, k);
  mkdirSync(dir, { recursive: true });
  const pieces = [];
  for (const [i, g] of garments.entries()) {
    const image = await sourcePicture(g).catch(() => null);
    if (image) writeFileSync(join(dir, `piece-${i + 1}-${g.source}.jpg`), image);
    pieces.push({ g, image });
  }
  const started = Date.now();
  const { http, body } = await post("outfit_visualization", { outfitId: `demo_${k.toLowerCase()}`, garmentIds: garments.map((g) => g.garmentId), spec: { garments } }, k);
  const seconds = Math.round((Date.now() - started) / 100) / 10;
  let result = null;
  if (body.status === "succeeded" && body.result?.imageUrl) {
    const res = await fetch(`${BASE}${body.result.imageUrl}`);
    if (res.ok) result = Buffer.from(await res.arrayBuffer());
    if (result) writeFileSync(join(dir, "result.jpg"), result);
  }
  writeFileSync(join(dir, "sheet.jpg"), await sheet(pieces, result));
  const row = {
    outfit: k,
    status: result ? "made and checked" : "integration-pending",
    http,
    answer: body.status,
    error: body.error ?? null,
    seconds,
    costUsd: body.metadata?.costUsd ?? null,
    cached: Boolean(body.metadata?.cached),
    model: body.metadata?.model ?? null,
    attempts: body.metadata?.attempts ?? null,
    imageUrl: body.result?.imageUrl ?? null,
    pieces: garments.map((g) => ({ source: g.source, slot: g.slot, layer: g.layer ?? null, name: g.name, ...(g.source === "shopify" ? { productId: g.retailerProductId, variantId: g.retailerVariantId ?? null, photo: g.imageUrl } : { referenceId: g.referenceId }) })),
    checks: body.result?.checks ?? [],
    notes: notes[k],
  };
  summary.push(row);
  console.log(`${k}: ${row.status} (${body.status}${body.error ? `, ${body.error.code}: ${body.error.message}` : ""}) in ${seconds}s, cost ${row.costUsd}`);
}

writeFileSync(join(OUT, "summary.json"), JSON.stringify({ site: BASE, at: new Date().toISOString(), outfits: summary }, null, 2));
const md = [`# Visualization demo against ${BASE}`, "", `Run ${new Date().toISOString()}.`, ""];
for (const r of summary) {
  md.push(`## Outfit ${r.outfit}: ${r.status}`, "", `Answer ${r.answer}${r.error ? ` (${r.error.code}: ${r.error.message})` : ""}, ${r.seconds} s, cost ${r.costUsd ?? "?"} USD${r.cached ? " (from the cache)" : ""}, model ${r.model ?? "?"}, attempts ${r.attempts ?? "?"}.`, "");
  for (const p of r.pieces) md.push(`- ${p.source === "shopify" ? "Store" : "Reference"} ${p.slot}${p.layer ? ` (${p.layer})` : ""}: ${p.name} ${p.source === "shopify" ? `[${p.productId}${p.variantId ? ` variant ${p.variantId}` : ""}]` : `[${p.referenceId}]`}`);
  for (const n of r.notes) md.push(`- Note: ${n}`);
  if (r.checks.length) md.push("", "Checks:", ...r.checks.map((c) => `- ${c.ok ? "pass" : "FAIL"} ${c.check}${c.note ? ` (${c.note})` : ""}`));
  md.push("");
}
writeFileSync(join(OUT, "summary.md"), md.join("\n"));
console.log(md.join("\n"));
