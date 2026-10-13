/**
 * outfit_visualization with Gemini's image models ("Nano Banana"): one picture of the Praxis model
 * wearing exactly the pieces of a composed look, built from the pieces' own photographs and attributes.
 *
 * For each request (the spec is already made safe by server/visuals.mjs canonicalSpec):
 * 1. The model's base picture: public/images/model/praxis-model-01.jpg when it is in the build,
 *    otherwise made once from words and kept (VISUALS_DIR), so every look is on the same man.
 * 2. Each piece's picture: a store piece's product photo, fetched from the store's image host; a
 *    reference piece's crop of its Praxis library photograph; the customer's own piece goes by words.
 * 3. One generateContent call with the base picture, the piece pictures and a prompt naming each piece
 *    with its attributes, the layering, the framing (head to shoes, room above and below) and the studio.
 * 4. The picture is checked (server/visual-check.mjs). If a check fails, one more attempt is made with
 *    the failures named; if that fails too, nothing is shown and the reason is returned.
 * 5. A picture that passes is kept and served at /api/visuals/<key>.jpg, marked representative: it shows
 *    these pieces' kind, colour and layering on the model, not proof of the exact product.
 *
 * Paid: Google's image models have no free tier, so the key's Google Cloud project needs billing. This
 * provider is `budgeted`: server/visuals.mjs lets it run only inside the spend Tarek approved
 * (OUTFIT_IMAGE_BUDGET_USD, OUTFIT_IMAGE_DAILY_USD), and stops it when the budget is spent.
 *
 * GEMINI_IMAGE_MODEL names the image model; otherwise the newest Pro image model the key can use is
 * taken (then Flash image). GEMINI_CHECK_MODEL names the model that checks pictures (default: the newest
 * stable Flash). GEMINI_API_BASE points at another endpoint (tests).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalSpec, imageKey, storeImage, visualsDir } from "../visuals.mjs";
import { JUDGE_SCHEMA, checkFile, judgePrompt, verdict } from "../visual-check.mjs";

export const id = "gemini-image";
export const billable = true;
/** Runs within the owner's approved budget (server/visuals.mjs), without ALLOW_BILLABLE_AI. */
export const budgeted = true;
export const SERVICES = ["outfit_visualization"];
const PROMPT_VERSION = "p1";
export const MODEL = (process.env.GEMINI_IMAGE_MODEL ?? "").trim() || "auto";
export const version = `${MODEL}+${PROMPT_VERSION}`;
/** A picture can take a while: up to two generations and two checks. */
export const timeoutMs = 170_000;

/** Google's list prices per picture at 1K (USD), and per check call (a few thousand input tokens). */
export const PRICES = [
  [/^gemini-3(\.\d+)?-pro-image/, 0.134],
  [/nano-banana-2\.1/, 0.0336],
  [/^gemini-3\.1-flash-lite-image/, 0.0336],
  [/^gemini-3\.1-flash-image/, 0.067],
  [/^gemini-2\.5-flash-image/, 0.039],
];
export const CHECK_COST_USD = 0.003;
export const priceOf = (model) => PRICES.find(([re]) => re.test(model))?.[1] ?? 0.134;
/** The most one request can cost: a base picture, two attempts at the dearest model, two checks. */
export const maxCostPerRequestUsd = 0.134 * 3 + CHECK_COST_USD * 2;
export let costPerImageUsd = 0.134;

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = normalize(join(HERE, "..", ".."));
const API = () => (process.env.GEMINI_API_BASE ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
const KEY = () => (process.env.GEMINI_API_KEY ?? "").trim();

let sharpModule = null;
async function sharpLib() {
  if (!sharpModule) sharpModule = (await import("sharp")).default;
  return sharpModule;
}

/* ------------------------------------------------------------ models */

/** The image model to use from Google's list: Pro image first (best fidelity with many references), then Flash image. */
export function pickImageModel(models) {
  const names = (Array.isArray(models) ? models : [])
    .filter((m) => Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"))
    .map((m) => String(m.name ?? "").replace(/^models\//, ""));
  const order = [/^gemini-3(\.\d+)?-pro-image/, /^gemini-3\.1-flash-image/, /nano-banana-2\.1/, /^gemini-2\.5-flash-image/];
  for (const re of order) {
    const hits = names.filter((n) => re.test(n)).sort((a, b) => (/preview/.test(a) ? 1 : 0) - (/preview/.test(b) ? 1 : 0) || b.localeCompare(a));
    if (hits.length) return hits[0];
  }
  return null;
}
/** The model that checks pictures: the newest stable Flash that reads images (not Lite, not an image model). */
export function pickCheckModel(models) {
  const names = (Array.isArray(models) ? models : [])
    .filter((m) => Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"))
    .map((m) => String(m.name ?? "").replace(/^models\//, ""))
    .filter((n) => /^gemini-\d+(\.\d+)?-flash$|^gemini-\d+(\.\d+)?-flash-latest$|^gemini-flash-latest$/.test(n));
  const v = (n) => Number(/^gemini-(\d+(?:\.\d+)?)/.exec(n)?.[1] ?? 99);
  return names.sort((a, b) => v(b) - v(a))[0] ?? null;
}

let listed = null;
export function resetModels() {
  listed = null;
}
async function modelList(fetcher) {
  if (!listed) {
    listed = (async () => {
      const res = await fetcher(`${API()}/models?pageSize=200`, { headers: { "x-goog-api-key": KEY() } });
      if (!res.ok) throw Object.assign(new Error(`Google listed models with ${res.status}.`), { status: res.status });
      return (await res.json())?.models ?? [];
    })();
    listed.catch(() => (listed = null));
  }
  return listed;
}
async function imageModel(fetcher) {
  if (MODEL !== "auto") return MODEL;
  const name = pickImageModel(await modelList(fetcher));
  if (!name) throw Object.assign(new Error("No Gemini image model is available to this key."), { code: "not_connected" });
  return name;
}
async function checkModel(fetcher) {
  const named = (process.env.GEMINI_CHECK_MODEL ?? "").trim();
  if (named) return named;
  return pickCheckModel(await modelList(fetcher)) ?? "gemini-flash-latest";
}

/* ------------------------------------------------------------ pictures in */

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/** A store's product photo, fetched from its image host (canonicalSpec allowed it), as a 1024 px JPEG. */
async function storePhoto(url, fetcher, signal) {
  const res = await fetcher(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000), headers: { Accept: "image/*" }, redirect: "error" });
  if (!res.ok || !String(res.headers.get("content-type") ?? "").startsWith("image/")) throw new Error(`photo ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_PHOTO_BYTES) throw new Error("photo too large");
  const sharp = await sharpLib();
  return sharp(buf).rotate().resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
}

/** A file of the site's own (a library photograph), from the build or the source folder. */
function siteFile(file) {
  for (const base of ["dist", "public"]) {
    const path = normalize(join(ROOT, base, file));
    if (path.startsWith(join(ROOT, base)) && existsSync(path)) return readFileSync(path);
  }
  return null;
}

/** A reference piece: its crop of the library photograph, with a little room around it. */
async function referencePhoto(photo) {
  const buf = siteFile(photo.file);
  if (!buf) throw new Error("library photo missing");
  const sharp = await sharpLib();
  const meta = await sharp(buf).metadata();
  const pad = 0.04;
  const x = Math.max(0, photo.region.x - pad), y = Math.max(0, photo.region.y - pad);
  const w = Math.min(1 - x, photo.region.w + 2 * pad), h = Math.min(1 - y, photo.region.h + 2 * pad);
  return sharp(buf).extract({ left: Math.round(x * meta.width), top: Math.round(y * meta.height), width: Math.round(w * meta.width), height: Math.round(h * meta.height) }).jpeg({ quality: 90 }).toBuffer();
}

/** Each piece's picture, in wearing order; a piece whose photo can't be had goes by words, and says so. */
export async function piecePictures(canonical, { fetcher = fetch, signal } = {}) {
  const out = [];
  for (const g of canonical.garments) {
    try {
      if (g.source === "shopify" && g.imageUrl) out.push({ garment: g, image: await storePhoto(g.imageUrl, fetcher, signal), from: "store photo" });
      else if (g.source === "reference" && g.photo) out.push({ garment: g, image: await referencePhoto(g.photo), from: "reference photo" });
      else out.push({ garment: g, image: null, from: g.source === "wardrobe" ? "words (the customer's own piece)" : "words" });
    } catch {
      out.push({ garment: g, image: null, from: "words (photo unavailable)" });
    }
  }
  return out;
}

/* ------------------------------------------------------------ the model's base picture */

export const BASE_MODEL = {
  id: "praxis-model-01@1",
  file: "/images/model/praxis-model-01.jpg",
  words:
    "A full length studio fashion photograph of one man, early thirties, short dark brown hair neatly styled, light stubble, athletic slim build, about 185 cm tall, calm natural expression, looking at the camera. He stands straight, facing the camera, arms relaxed at his sides, feet slightly apart on the floor. He wears a plain fitted white crew neck t-shirt, plain light grey trousers and plain white leather sneakers. Plain warm beige studio wall and floor, soft warm studio light, gentle shadow at his feet. Portrait 3:4, the whole man in frame with room above his head and below his shoes. No text, no logos.",
};

let baseCache = null;
/** The base picture: from the build, else kept from a first making, else made now (and its cost counted). */
async function basePicture(model, fetcher, signal, spend) {
  if (baseCache) return baseCache;
  const built = siteFile(BASE_MODEL.file);
  if (built) return (baseCache = built);
  const kept = join(visualsDir(), `base-${BASE_MODEL.id.replace(/[^a-z0-9-]/gi, "_")}.jpg`);
  if (existsSync(kept)) return (baseCache = readFileSync(kept));
  const made = await generate(model, { contents: [{ role: "user", parts: [{ text: BASE_MODEL.words }] }], generationConfig: imageConfig() }, fetcher, signal);
  spend(priceOf(model));
  const sharp = await sharpLib();
  const jpeg = await sharp(made).jpeg({ quality: 92 }).toBuffer();
  try {
    writeFileSync(kept, jpeg);
  } catch {
    /* memory only */
  }
  return (baseCache = jpeg);
}
export function resetBase() {
  baseCache = null;
}

/* ------------------------------------------------------------ the request */

const imageConfig = () => ({ responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "3:4", imageSize: "1K" } });
const inline = (buf) => ({ inlineData: { mimeType: "image/jpeg", data: buf.toString("base64") } });

function describe(g) {
  const a = g.attributes ?? {};
  const words = [a.colour, a.material, a.subcategory?.replace(/-/g, " ")].filter(Boolean).join(" ");
  const more = [a.silhouette, a.fit ? `${a.fit} fit` : null].filter(Boolean).join(", ");
  return `${g.name}${words ? ` (${words})` : ""}${more ? `, ${more}` : ""}`;
}
const ROLE = (g) => (g.slot === "top" ? (g.layer === "outer" ? "outer layer, worn open over the base layer" : g.layer === "base" ? "base layer, worn under the outer layer" : "top") : g.slot === "bottom" ? "trousers" : g.slot === "shoes" ? "shoes" : "accessory");

/**
 * The generateContent request for one outfit: the base picture first (the man to keep), then each
 * piece's picture, each named in the prompt by its number, then the outfit in words. `fix` names what
 * the last attempt got wrong.
 */
export function buildImageRequest(pictures, base, fix = []) {
  const parts = [];
  const lines = [
    "Make one photograph for a menswear stylist's lookbook.",
    "Image 1 is the model. Keep him exactly: the same face, hair, skin, build and height, the same plain warm beige studio, the same soft warm light and the same relaxed standing pose facing the camera. Ignore the clothes he wears in image 1.",
    "Dress him in exactly this outfit and nothing else:",
  ];
  parts.push({ text: "" });
  parts.push(inline(base));
  let n = 1;
  for (const p of pictures) {
    const g = p.garment;
    if (p.image) {
      n += 1;
      parts.push(inline(p.image));
      lines.push(`- ${ROLE(g)}: ${describe(g)}. This is the piece in image ${n}: copy its exact colour, fabric, texture, pattern, collar or lapels, buttons, pockets and proportions. Use only that piece from image ${n}; ignore any person, other clothes or background in it.`);
    } else {
      lines.push(`- ${ROLE(g)}: ${describe(g)}.`);
    }
  }
  lines.push(
    "Layering: tops are worn in the order listed, the outer layer open over the base so both show. Trousers full length with a clean break over the shoes.",
    "Framing: portrait 3:4, the whole man from the top of his head to the soles of his shoes, centred, with clear space above his head and below his shoes. Nothing cropped.",
    "A real photograph: natural proportions and hands, sharp focus on the clothes, no text, no logos, no watermark, no other people, no props.",
  );
  if (fix.length) lines.push(`The last attempt got these wrong; fix them: ${fix.join("; ")}.`);
  parts[0] = { text: lines.join("\n") };
  return { contents: [{ role: "user", parts }], generationConfig: imageConfig() };
}

/* ------------------------------------------------------------ calls */

/** Google's refusal in plain terms; "billing_required" when the key's project has no billing for images. */
async function googleError(res) {
  let message = "";
  try {
    message = String((await res.json())?.error?.message ?? "");
  } catch {
    /* none */
  }
  const billing = /billing|limit: 0|free[_ ]tier|FreeTier/i.test(message) || res.status === 402;
  const code = billing ? "billing_required" : res.status === 429 ? "rate_limited" : res.status === 400 ? "validation_error" : "provider_error";
  return Object.assign(new Error(billing ? "Image generation needs billing on the key's Google Cloud project." : `Google answered ${res.status}: ${message.slice(0, 160)}`), { code, retryable: res.status === 429 && !billing ? true : res.status >= 500 });
}

async function generate(model, request, fetcher, signal) {
  const res = await fetcher(`${API()}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", "x-goog-api-key": KEY() },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw await googleError(res);
  const body = await res.json();
  const cand = body?.candidates?.[0];
  const part = (cand?.content?.parts ?? []).find((p) => p?.inlineData?.data || p?.inline_data?.data);
  if (!part) {
    const why = cand?.finishReason ?? body?.promptFeedback?.blockReason ?? "no picture";
    throw Object.assign(new Error(`No picture came back (${why}).`), { code: /SAFETY|PROHIBITED|BLOCK/i.test(String(why)) ? "provider_refused" : "provider_error", retryable: !/SAFETY|PROHIBITED|BLOCK/i.test(String(why)) });
  }
  return Buffer.from((part.inlineData ?? part.inline_data).data, "base64");
}

async function judge(model, base, picture, garments, fetcher, signal) {
  const res = await fetcher(`${API()}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", "x-goog-api-key": KEY() },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: judgePrompt(garments) }, inline(base), inline(picture)] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: JUDGE_SCHEMA, temperature: 0 },
    }),
  });
  if (!res.ok) throw await googleError(res);
  const text = (await res.json())?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return JSON.parse(text);
}

/* ------------------------------------------------------------ run */

export async function run(request, { signal, visual, fetcher = (...a) => fetch(...a) } = {}) {
  const canonical = visual?.canonical ?? canonicalSpec(request?.payload);
  if (!canonical) return { status: "failed", error: { code: "validation_error", message: "Not an outfit I can picture.", retryable: false } };
  if (!KEY()) return { status: "disabled", error: { code: "not_connected", message: "No Gemini key.", retryable: false } };
  const key = visual?.key ?? imageKey(canonical, { id, version });
  let costUsd = 0;
  let attempts = 0;
  const spend = (usd) => (costUsd = Math.round((costUsd + usd) * 10000) / 10000);
  const failed = (code, message, retryable, checks) => ({ status: "failed", error: { code, message, retryable }, ...(checks ? { result: { outfitId: canonical.outfitId, checks } } : {}), metadata: { costUsd, attempts } });
  try {
    const sharp = await sharpLib();
    const model = await imageModel(fetcher);
    costPerImageUsd = priceOf(model);
    const checker = await checkModel(fetcher);
    const base = await basePicture(model, fetcher, signal, spend);
    const pictures = await piecePictures(canonical, { fetcher, signal });
    let fix = [];
    let last = null;
    for (attempts = 1; attempts <= 2; attempts += 1) {
      const made = await generate(model, buildImageRequest(pictures, base, fix), fetcher, signal);
      spend(priceOf(model));
      const jpeg = await sharp(made).jpeg({ quality: 90 }).toBuffer();
      const file = await checkFile(sharp, jpeg);
      if (!file.ok) {
        last = file.checks;
        fix = file.checks.filter((c) => !c.ok).map((c) => c.check);
        continue;
      }
      const judged = await judge(checker, base, jpeg, canonical.garments, fetcher, signal);
      spend(CHECK_COST_USD);
      const v = await verdict(sharp, jpeg, canonical.garments, judged, file);
      const checks = [...file.checks, ...v.checks, ...pictures.map((p) => ({ check: `${p.garment.name.toLowerCase()}: drawn from`, ok: true, note: p.from }))];
      if (v.ok) {
        const imageUrl = storeImage(key, jpeg);
        return { status: "succeeded", result: { outfitId: canonical.outfitId, imageUrl, fidelity: "representative", generated: true, checks }, metadata: { costUsd, attempts, model, checkModel: checker } };
      }
      last = checks;
      fix = v.fix;
    }
    return failed("validation_error", "The picture didn’t pass its checks.", true, last);
  } catch (e) {
    if (signal?.aborted) throw e;
    return failed(e?.code ?? "provider_error", String(e?.message ?? "The picture could not be made.").slice(0, 200), e?.retryable ?? false);
  }
}
