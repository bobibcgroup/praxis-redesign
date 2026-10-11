/**
 * Personal images, kept apart by what they are for. Each of the four kinds has its own policy: what
 * is asked for and why, whether it leaves the device, how long it is kept, how it is deleted, and
 * which adapter would analyse it. The screens tell the customer exactly this before asking for a
 * photo, and read it from here so the words and the behaviour cannot drift apart.
 *
 * Today nothing is analysed and no photo leaves the device: a photo lives in this tab only
 * (sessionStorage) and is gone when the tab closes, or sooner when the customer deletes it. When a
 * server-side analysis is connected, its policy changes here, and so does what the customer reads.
 *
 * The final consent and privacy wording must be approved by legal counsel before real personal-image
 * processing goes live.
 */
import { readJson, session, local, writeJson } from "./ids";

export type ImageCategory = "face_colour" | "body_fit" | "wardrobe_garment" | "try_on";

export interface ImagePolicy {
  category: ImageCategory;
  /** Why the photo is needed, in the stylist's voice. */
  why: string;
  /** How it is used. */
  use: string;
  /** Where it is processed today. */
  processing: "none" | "on_device" | "server";
  leavesDevice: boolean;
  /** Where it is kept and for how long. */
  retention: { where: "this_tab" | "this_device" | "server"; maxDays?: number };
  /** How the customer deletes it. */
  deletion: string;
  /** Changes when the wording above changes, so consent given to old wording is asked again. */
  consentVersion: string;
  accepts: readonly string[];
  maxBytes: number;
  /** The shorter edge must be at least this many pixels for an analysis to be worth trying. */
  minEdge: number;
  /** Whether Praxis asks for this kind of photo at all right now. */
  status: "collecting" | "not_collected";
  /** The analysis adapter that would read it (see vision.ts). */
  adapter: string;
}

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;

export const IMAGE_POLICIES: Record<ImageCategory, ImagePolicy> = {
  face_colour: {
    category: "face_colour",
    why: "A daylight photo of your face helps me suggest colours for your Style DNA.",
    use: "Colour analysis is in preview, so I don’t read the photo yet. I show it while you build your Style DNA.",
    processing: "none",
    leavesDevice: false,
    retention: { where: "this_tab" },
    deletion: "It’s deleted when you close this tab, or straight away when you delete it.",
    consentVersion: "face-2026-10-11",
    accepts: PHOTO_TYPES,
    maxBytes: 15 * 1024 * 1024,
    minEdge: 320,
    status: "collecting",
    adapter: "colour-analysis",
  },
  body_fit: {
    category: "body_fit",
    why: "A full-length photo would let me judge proportions and fit.",
    use: "Not asked for. Fit comes from what you tell me.",
    processing: "none",
    leavesDevice: false,
    retention: { where: "this_tab" },
    deletion: "Nothing is kept.",
    consentVersion: "body-2026-10-11",
    accepts: PHOTO_TYPES,
    maxBytes: 15 * 1024 * 1024,
    minEdge: 480,
    status: "not_collected",
    adapter: "body-analysis",
  },
  wardrobe_garment: {
    category: "wardrobe_garment",
    why: "A photo of the piece helps me style the looks around it.",
    use: "I don’t read the photo yet. I keep its name and type, and show the photo beside your looks.",
    processing: "none",
    leavesDevice: false,
    retention: { where: "this_tab" },
    deletion: "It’s deleted when you close this tab, or straight away when you remove the piece.",
    consentVersion: "wardrobe-2026-10-11",
    accepts: PHOTO_TYPES,
    maxBytes: 15 * 1024 * 1024,
    minEdge: 240,
    status: "collecting",
    adapter: "garment-recognition",
  },
  try_on: {
    category: "try_on",
    why: "A photo of you would let me show a look on you.",
    use: "Try-on is in preview, so no photo is asked for. Looks are shown on a model.",
    processing: "none",
    leavesDevice: false,
    retention: { where: "this_tab" },
    deletion: "Nothing is kept.",
    consentVersion: "tryon-2026-10-11",
    accepts: PHOTO_TYPES,
    maxBytes: 15 * 1024 * 1024,
    minEdge: 480,
    status: "not_collected",
    adapter: "virtual-try-on",
  },
};

/** The plain facts the customer reads before giving a photo, from the policy itself. */
export function disclosure(category: ImageCategory): { why: string; use: string; leaves: string; kept: string; deletion: string } {
  const p = IMAGE_POLICIES[category];
  return {
    why: p.why,
    use: p.use,
    leaves: p.leavesDevice ? "It is sent to Praxis to be analysed." : "It stays on this device. Nothing is uploaded.",
    kept: p.retention.where === "this_tab" ? "Kept in this browser tab only." : p.retention.where === "this_device" ? "Kept on this device." : `Kept on Praxis servers${p.retention.maxDays ? ` for up to ${p.retention.maxDays} days` : ""}.`,
    deletion: p.deletion,
  };
}

/* ------------------------------------------------------------- validation */

export type ImageProblem = "not_an_image" | "unsupported_type" | "too_large" | "too_small" | "too_dark" | "too_bright" | "unreadable";

/** Before reading a file: its type and size. */
export function checkFile(file: { type: string; size: number }, category: ImageCategory): ImageProblem | null {
  const p = IMAGE_POLICIES[category];
  if (!file.type.startsWith("image/")) return "not_an_image";
  if (!p.accepts.includes(file.type)) return "unsupported_type";
  if (file.size > p.maxBytes) return "too_large";
  return null;
}

/** After reading it: is it big and bright enough to be worth analysing. Mean brightness is 0 to 255. */
export function checkQuality(stats: { width: number; height: number; meanLuma: number | null }, category: ImageCategory): ImageProblem | null {
  if (!stats.width || !stats.height) return "unreadable";
  if (Math.min(stats.width, stats.height) < IMAGE_POLICIES[category].minEdge) return "too_small";
  if (stats.meanLuma !== null && stats.meanLuma < 40) return "too_dark";
  if (stats.meanLuma !== null && stats.meanLuma > 235) return "too_bright";
  return null;
}

/** What to tell the customer, and what they can do next. */
export const PROBLEM_COPY: Record<ImageProblem, string> = {
  not_an_image: "That file isn’t a photo. Choose a photo instead.",
  unsupported_type: "I can’t open that kind of photo. A JPEG or PNG works best.",
  too_large: "That photo is too large. Choose one under 15 MB.",
  too_small: "That photo is too small for me to see much. Try a larger one.",
  too_dark: "That photo is too dark for me to see your colours. Try again near a window.",
  too_bright: "That photo is too bright for me to see your colours. Try again out of direct sun.",
  unreadable: "I couldn’t read that photo. Try another one.",
};

/* ---------------------------------------------------------------- consent */

export interface ConsentRecord {
  category: ImageCategory;
  version: string;
  grantedAt: string;
}

const CONSENT_KEY = "praxis_image_consent";

export function consentFor(category: ImageCategory, storage: () => Storage | undefined = local): ConsentRecord | null {
  const all = readJson<ConsentRecord[]>(storage(), CONSENT_KEY) ?? [];
  const r = all.find((c) => c.category === category);
  // Consent to older wording does not count.
  return r && r.version === IMAGE_POLICIES[category].consentVersion ? r : null;
}

export function grantConsent(category: ImageCategory, storage: () => Storage | undefined = local, now = new Date()): ConsentRecord {
  const record: ConsentRecord = { category, version: IMAGE_POLICIES[category].consentVersion, grantedAt: now.toISOString() };
  const rest = (readJson<ConsentRecord[]>(storage(), CONSENT_KEY) ?? []).filter((c) => c.category !== category);
  writeJson(storage(), CONSENT_KEY, [...rest, record]);
  return record;
}

/** Withdrawing consent also deletes the photos of that kind. */
export function withdrawConsent(category: ImageCategory, storage: () => Storage | undefined = local): void {
  const rest = (readJson<ConsentRecord[]>(storage(), CONSENT_KEY) ?? []).filter((c) => c.category !== category);
  writeJson(storage(), CONSENT_KEY, rest.length ? rest : null);
  deleteImages(category);
}

/* --------------------------------------------------------------- storage */

/** Where each kind of photo lives in this tab. */
export const IMAGE_KEYS: Record<ImageCategory, string | null> = {
  face_colour: "praxis_lab_a_face",
  body_fit: null,
  wardrobe_garment: "praxis_lab_a_item",
  try_on: null,
};

/** Deletes every stored photo of this kind. Wardrobe entries keep their name; only the photo goes. */
export function deleteImages(category: ImageCategory, tab: () => Storage | undefined = session): void {
  const key = IMAGE_KEYS[category];
  if (!key) return;
  const store = tab();
  if (category === "wardrobe_garment") {
    const item = readJson<{ image?: string | null }>(store, key);
    if (item) writeJson(store, key, { ...item, image: null });
    return;
  }
  writeJson(store, key, null);
}
