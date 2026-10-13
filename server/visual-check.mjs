/**
 * Checks a generated outfit picture before anyone sees it (server/providers/gemini-image.mjs runs it on
 * every picture). Three layers:
 *
 * 1. The file: a real JPEG, PNG or WebP, at least 600 px wide, about 3:4, not blank (sharp).
 * 2. A look by a vision model (Gemini, text out): is it one man, full length, head and shoes in frame,
 *    the same man as the base picture, plausible anatomy, no severe defects; and for each piece of the
 *    outfit, is it there, what kind of garment it is, what colour, and where (a box).
 * 3. Measured colour: inside each piece's box the pixels are averaged and named as a colour family,
 *    and compared with the piece's own colour. A piece passes when either the measured colour or the
 *    vision model's colour agrees (lighting shifts one or the other).
 *
 * Kinds are compared through the shared ontology (classify, STANDS_IN_FOR), so "chinos" for chinos
 * passes and "boots" for loafers does not. The picture passes only when every check does. Even then it
 * is "representative" (illustrative): nothing here proves the exact product, only the right kind,
 * colour and layering on the right man.
 */
import { STANDS_IN_FOR, classify, colourOf } from "../src/shared/ontology.mjs";

/** Colour families close enough under studio light to count as the same piece. */
const NEAR = {
  black: ["grey", "navy"],
  grey: ["black", "white", "beige"],
  navy: ["black", "blue"],
  blue: ["navy"],
  white: ["grey", "beige"],
  beige: ["white", "brown", "grey"],
  brown: ["beige", "burgundy", "orange"],
  burgundy: ["brown", "red"],
  green: [],
  red: ["burgundy", "orange"],
  orange: ["brown", "red"],
};
export const coloursAgree = (want, got) => !want || !got || want === got || (NEAR[want] ?? []).includes(got);

/** A colour family for an average colour, in the ontology's families. */
export function familyOf(r, g, b) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === R ? 60 * (((G - B) / d) % 6) : max === G ? 60 * ((B - R) / d + 2) : 60 * ((R - G) / d + 4);
  if (h < 0) h += 360;
  if (h >= 195 && h <= 255 && s > 0.18 && l < 0.42) return "navy";
  if (l < 0.13) return "black";
  if (s < 0.12 || (l < 0.25 && s < 0.2)) return l > 0.82 ? "white" : l < 0.18 ? "black" : "grey";
  if (h >= 195 && h <= 255) return l < 0.4 ? "navy" : "blue";
  if (h >= 70 && h < 170) return "green";
  if (h >= 15 && h < 50) return l > 0.62 && s < 0.55 ? "beige" : s > 0.65 && l > 0.45 ? "orange" : "brown";
  if (h >= 50 && h < 70) return l > 0.6 ? "beige" : "green";
  if (h >= 255 && h < 320) return "purple";
  if (h >= 320 && h < 345) return "pink";
  return l < 0.38 ? "burgundy" : "red";
}

/** Whether the piece the judge saw is of the kind the outfit needs. Unknown words decide nothing. */
export function kindsAgree(want, seen) {
  const w = want ? (classify(String(want).replace(/-/g, " "))?.subcategory ?? String(want)) : undefined;
  const got = classify(String(seen ?? ""))?.subcategory;
  if (!w || !got) return true;
  return w === got || (STANDS_IN_FOR[w] ?? []).includes(got) || (STANDS_IN_FOR[got] ?? []).includes(w);
}

/** The file itself: format, size, shape, not blank. */
export async function checkFile(sharp, buffer) {
  const checks = [];
  let meta = null;
  let stats = null;
  try {
    const img = sharp(buffer);
    meta = await img.metadata();
    stats = await img.stats();
  } catch {
    return { ok: false, checks: [{ check: "picture file", ok: false, note: "not a picture" }] };
  }
  const ratio = meta.width && meta.height ? meta.width / meta.height : 0;
  checks.push({ check: "picture file", ok: ["jpeg", "png", "webp"].includes(meta.format) });
  checks.push({ check: "size", ok: (meta.width ?? 0) >= 600, note: `${meta.width}x${meta.height}` });
  checks.push({ check: "portrait shape", ok: ratio >= 0.68 && ratio <= 0.82, note: ratio ? ratio.toFixed(2) : undefined });
  const spread = stats.channels.slice(0, 3).reduce((s, c) => s + c.stdev, 0) / 3;
  checks.push({ check: "not blank", ok: spread > 8 });
  return { ok: checks.every((c) => c.ok), checks, width: meta.width, height: meta.height };
}

/** What the vision model is asked, and the answer's shape. */
export function judgePrompt(garments) {
  return [
    "You check fashion pictures for a menswear stylist. Image 1 is the reference model. Image 2 is a generated picture that should show the same man wearing exactly this outfit:",
    ...garments.map((g) => `- id ${g.garmentId}: ${g.name}${g.attributes?.colour ? `, colour ${g.attributes.colour}` : ""}${g.attributes?.subcategory ? `, kind ${g.attributes.subcategory}` : ""}${g.layer ? `, worn as the ${g.layer} layer` : ""}`),
    "Judge image 2 only. Be strict and literal. For each id say if that piece is visibly worn, what kind of garment it is in one or two words, its main colour in one word, and its box as [ymin, xmin, ymax, xmax] on a 0 to 1000 scale.",
    "Also say: is it one man shown full length; is the whole head in frame with space above it; are both shoes fully in frame; is he the same man as image 1 (face, hair, build); are hands, limbs and face anatomically plausible; list only severe defects (extra or missing limbs, melted or garbled clothing, text or watermarks other than a tiny corner mark, a second person); list any clothing worn that is not in the outfit.",
  ].join("\n");
}

export const JUDGE_SCHEMA = {
  type: "OBJECT",
  properties: {
    oneManFullLength: { type: "BOOLEAN" },
    headInFrame: { type: "BOOLEAN" },
    shoesInFrame: { type: "BOOLEAN" },
    sameManAsReference: { type: "BOOLEAN" },
    plausibleAnatomy: { type: "BOOLEAN" },
    severeDefects: { type: "ARRAY", items: { type: "STRING" } },
    extraClothing: { type: "ARRAY", items: { type: "STRING" } },
    garments: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { id: { type: "STRING" }, worn: { type: "BOOLEAN" }, kind: { type: "STRING" }, colour: { type: "STRING" }, box: { type: "ARRAY", items: { type: "NUMBER" } } },
        required: ["id", "worn", "kind", "colour"],
      },
    },
  },
  required: ["oneManFullLength", "headInFrame", "shoesInFrame", "sameManAsReference", "plausibleAnatomy", "severeDefects", "garments"],
};

/** The average colour family inside the middle of a box (0 to 1000 scale). */
async function measuredFamily(sharp, buffer, box, size) {
  if (!Array.isArray(box) || box.length !== 4 || !size.width) return undefined;
  const [y0, x0, y1, x1] = box.map((n) => Math.max(0, Math.min(1000, Number(n) || 0)));
  if (y1 <= y0 || x1 <= x0) return undefined;
  const shrink = 0.3;
  const left = Math.round(((x0 + (x1 - x0) * shrink) / 1000) * size.width);
  const top = Math.round(((y0 + (y1 - y0) * shrink) / 1000) * size.height);
  const width = Math.max(2, Math.round((((x1 - x0) * (1 - 2 * shrink)) / 1000) * size.width));
  const height = Math.max(2, Math.round((((y1 - y0) * (1 - 2 * shrink)) / 1000) * size.height));
  try {
    // stats() reads its input, not the pipeline, so the crop is made first.
    const crop = await sharp(buffer).extract({ left, top, width: Math.min(width, size.width - left), height: Math.min(height, size.height - top) }).toBuffer();
    const { channels } = await sharp(crop).stats();
    return familyOf(channels[0].mean, channels[1].mean, channels[2].mean);
  } catch {
    return undefined;
  }
}

/**
 * The verdict on a picture from the judge's answer and the measured colours: every check, whether it
 * passed, and what to tell the next attempt when it didn't.
 */
export async function verdict(sharp, buffer, garments, judged, size) {
  const checks = [
    { check: "one man, full length", ok: judged?.oneManFullLength === true },
    { check: "head in frame", ok: judged?.headInFrame === true },
    { check: "shoes in frame", ok: judged?.shoesInFrame === true },
    { check: "same model", ok: judged?.sameManAsReference === true },
    { check: "plausible anatomy", ok: judged?.plausibleAnatomy === true },
    { check: "no severe defects", ok: Array.isArray(judged?.severeDefects) && judged.severeDefects.length === 0, note: (judged?.severeDefects ?? []).join("; ").slice(0, 150) || undefined },
  ];
  const seen = new Map((judged?.garments ?? []).map((g) => [String(g.id), g]));
  for (const g of garments) {
    const s = seen.get(g.garmentId);
    const label = g.name.toLowerCase();
    if (!s || s.worn !== true) {
      checks.push({ check: `${label}: worn`, ok: false, note: "missing" });
      continue;
    }
    checks.push({ check: `${label}: kind`, ok: kindsAgree(g.attributes?.subcategory, s.kind), note: String(s.kind ?? "").slice(0, 40) });
    const want = g.attributes?.colour;
    if (want) {
      const measured = await measuredFamily(sharp, buffer, s.box, size);
      const said = colourOf(String(s.colour ?? ""));
      const ok = (measured !== undefined && coloursAgree(want, measured)) || (said !== undefined && coloursAgree(want, said));
      checks.push({ check: `${label}: colour`, ok, note: `wanted ${want}, measured ${measured ?? "unknown"}, seen ${s.colour ?? "unknown"}` });
    }
  }
  // Layering: an outer layer needs its base under it, and both must show.
  const outer = garments.find((g) => g.layer === "outer");
  const base = garments.find((g) => g.layer === "base");
  if (outer && base) checks.push({ check: "layering", ok: seen.get(outer.garmentId)?.worn === true && seen.get(base.garmentId)?.worn === true });
  const ok = checks.every((c) => c.ok);
  const fix = checks.filter((c) => !c.ok).map((c) => `${c.check}${c.note ? ` (${c.note})` : ""}`);
  return { ok, checks, fix };
}
