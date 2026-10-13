#!/usr/bin/env node
/**
 * Candidates for the home page's Style DNA banner, made with Gemini's image model (paid: about 0.24 USD
 * per 4K picture, 0.134 per 2K). Run only with Tarek's written approval of the spend; the workflow
 * .github/workflows/style-dna-image.yml runs it when .github/style-dna-request.txt changes on main.
 *
 *   GEMINI_API_KEY=... node tools/style-dna-image.mjs <out-dir> [wide-count] [phone-count]
 *
 * Wide: 21:9 at 4K, the man in the left third, the open sunlit wall on the right for the copy.
 * Phone: 4:5 at 2K, the same scene closer, the man centred a little left with wall above for breathing room.
 * Writes <out-dir>/wide-N.jpg, phone-N.jpg and summary.json (model, cost, time per picture).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] ?? "style-dna-candidates";
const WIDE = Math.min(6, Number(process.argv[3] ?? 4));
const PHONE = Math.min(4, Number(process.argv[4] ?? 2));
const KEY = (process.env.GEMINI_API_KEY ?? "").trim();
const API = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image-preview";
const PRICE = { "4K": 0.24, "2K": 0.134 };
if (!KEY) {
  console.error("GEMINI_API_KEY is not set (add it as a GitHub Actions secret).");
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

const SCENE =
  "An editorial fashion photograph for a luxury menswear stylist. One man, early thirties, Mediterranean features, short dark wavy hair, a well kept short beard, natural tanned skin with real texture, calm and confident, looking slightly off camera. " +
  "He wears a relaxed premium ivory linen shirt, top two buttons open, sleeves loosely rolled, the fine slub and soft creases of real linen visible; elegant dark tortoiseshell sunglasses; a slim gold watch. Nothing else is visible below the chest. " +
  "Setting: a warm Mediterranean courtyard, cream and sand coloured limestone walls with fine plaster texture, a soft arched opening, late afternoon sun raking across the wall, crisp palm frond shadows falling on the stone, a little tropical greenery at the edges, slightly out of focus. " +
  "Light and colour: warm natural sunlight, soft champagne, ivory, sand and beige tones with gentle olive greens, no harsh contrast, no colour cast on the skin. Shot on a full frame camera, 50 mm lens, f/2.8, shallow depth of field, photorealistic, natural facial proportions and hands, no retouched plastic skin. " +
  "No text, no logos, no watermark, no other people.";

const SHOTS = {
  wide: { aspectRatio: "21:9", imageSize: "4K", framing: "Wide panoramic composition: the man stands in the left third of the frame, framed from the waist up and turned slightly toward the right, with clear space above his head. The right half of the frame is open, evenly lit sunlit limestone wall with soft palm shadows only near the far right edge, calm and uncluttered so text can sit on it." },
  phone: { aspectRatio: "4:5", imageSize: "2K", framing: "Portrait composition: the same man framed from the chest up, a little left of centre, his whole head and sunglasses well inside the frame with calm wall above him, palm shadows on the wall behind." },
};

async function make(kind, n) {
  const shot = SHOTS[kind];
  const started = Date.now();
  const res = await fetch(`${API}/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `${SCENE} ${shot.framing}` }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: shot.aspectRatio, imageSize: shot.imageSize } },
    }),
  });
  const seconds = Math.round((Date.now() - started) / 100) / 10;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { kind, n, ok: false, status: res.status, error: String(body?.error?.message ?? "").slice(0, 300), seconds, costUsd: 0 };
  const part = (body?.candidates?.[0]?.content?.parts ?? []).find((p) => p?.inlineData?.data);
  if (!part) return { kind, n, ok: false, error: `no picture (${body?.candidates?.[0]?.finishReason ?? "unknown"})`, seconds, costUsd: PRICE[shot.imageSize] };
  const ext = /png/.test(part.inlineData.mimeType) ? "png" : "jpg";
  const file = `${kind}-${n}.${ext}`;
  writeFileSync(join(OUT, file), Buffer.from(part.inlineData.data, "base64"));
  return { kind, n, ok: true, file, seconds, costUsd: PRICE[shot.imageSize] };
}

const results = [];
for (let i = 1; i <= WIDE; i += 1) results.push(await make("wide", i));
for (let i = 1; i <= PHONE; i += 1) results.push(await make("phone", i));
for (const r of results) console.log(`${r.kind} ${r.n}: ${r.ok ? r.file : `failed ${r.status ?? ""} ${r.error}`} in ${r.seconds}s, ${r.costUsd} USD`);
const total = Math.round(results.reduce((s, r) => s + r.costUsd, 0) * 1000) / 1000;
console.log(`model ${MODEL}, total about ${total} USD`);
writeFileSync(join(OUT, "summary.json"), JSON.stringify({ model: MODEL, at: new Date().toISOString(), totalUsd: total, results }, null, 2));
if (!results.some((r) => r.ok)) process.exit(1);
