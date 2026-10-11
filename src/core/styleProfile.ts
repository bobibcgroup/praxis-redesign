/**
 * The Style DNA profile. Every attribute keeps three layers apart: what an analysis estimated, what
 * the customer confirmed, and what the customer corrected. The customer's word always wins, and a new
 * estimate only ever replaces the old estimate, never a correction. Nothing here holds a photo.
 */
import type { AttributeBasis, StyleProfileSummary } from "./contracts";
import { newId } from "./ids";
import type { ColourAnalysis } from "./vision";

export type Undertone = "cool" | "warm" | "neutral";
export type Contrast = "high" | "medium" | "low";
export type Fit = "SLIM" | "REGULAR" | "RELAXED";
export type Week = "OFFICE" | "SOCIAL" | "CASUAL" | "MIXED";

export interface Attribute<T> {
  inferred?: { value: T; source: "sample" | "model"; adapter: string; at: string };
  confirmed?: { value: T; at: string };
  corrected?: { value: T; at: string };
}

export interface StyleProfile {
  profileId: string;
  /** Goes up with every change, so a request can name the exact profile it used. */
  version: number;
  createdAt: string;
  updatedAt: string;
  /** Which photo the colour estimate came from. The photo itself is never stored here. */
  photo: "own" | "sample" | "none";
  undertone: Attribute<Undertone>;
  contrast: Attribute<Contrast>;
  fit: Attribute<Fit>;
  week: Attribute<Week>;
  tastes: string[];
}

export type ColourField = "undertone" | "contrast";
export type EditableField = ColourField | "fit" | "week";

type Values = { undertone: Undertone; contrast: Contrast; fit: Fit; week: Week };

export function valueOf<T>(a: Attribute<T>): T | undefined {
  return a.corrected?.value ?? a.confirmed?.value ?? a.inferred?.value;
}

export function basisOf<T>(a: Attribute<T>): AttributeBasis | null {
  if (a.corrected) return "corrected";
  if (a.confirmed) return "confirmed";
  if (a.inferred) return "inferred";
  return null;
}

function bump(p: StyleProfile, now: Date): StyleProfile {
  return { ...p, version: p.version + 1, updatedAt: now.toISOString() };
}

/** A new profile from the Style DNA answers. Fit and week are the customer's own words, so confirmed. */
export function createProfile(input: { photo: StyleProfile["photo"]; fit: Fit; week: Week; tastes: string[] }, now = new Date()): StyleProfile {
  const at = now.toISOString();
  return {
    profileId: newId("dna"),
    version: 1,
    createdAt: at,
    updatedAt: at,
    photo: input.photo,
    undertone: {},
    contrast: {},
    fit: { confirmed: { value: input.fit, at } },
    week: { confirmed: { value: input.week, at } },
    tastes: [...input.tastes],
  };
}

/**
 * A colour analysis arrives. It replaces the earlier estimate and nothing else: a confirmation or a
 * correction stays. A confirmation of a value the new estimate disagrees with also stays, because it
 * is still the customer's word.
 */
export function applyAnalysis(p: StyleProfile, analysis: ColourAnalysis, photo: StyleProfile["photo"], now = new Date()): StyleProfile {
  if (analysis.status !== "completed") return p;
  const at = now.toISOString();
  const next = { ...p, photo };
  if (analysis.undertone) next.undertone = { ...p.undertone, inferred: { ...analysis.undertone, at } };
  if (analysis.contrast) next.contrast = { ...p.contrast, inferred: { ...analysis.contrast, at } };
  return bump(next, now);
}

/** The customer says a value is wrong and gives the right one. */
export function correct<F extends EditableField>(p: StyleProfile, field: F, value: Values[F], now = new Date()): StyleProfile {
  const at = now.toISOString();
  const attr = p[field] as Attribute<Values[F]>;
  // Choosing the estimate itself is agreeing with it, not correcting it.
  const next: Attribute<Values[F]> = attr.inferred?.value === value && !attr.corrected ? { inferred: attr.inferred, confirmed: { value, at } } : { inferred: attr.inferred, confirmed: attr.confirmed, corrected: { value, at } };
  return bump({ ...p, [field]: next }, now);
}

/** The customer drops a correction and goes back to the estimate. */
export function clearCorrection(p: StyleProfile, field: EditableField, now = new Date()): StyleProfile {
  const attr = p[field] as Attribute<string>;
  if (!attr.corrected) return p;
  return bump({ ...p, [field]: { inferred: attr.inferred, confirmed: attr.confirmed } }, now);
}

/** "Looks right": every estimate not yet confirmed or corrected becomes confirmed. */
export function confirmEstimates(p: StyleProfile, now = new Date()): StyleProfile {
  const at = now.toISOString();
  let changed = false;
  const confirm = <T>(a: Attribute<T>): Attribute<T> => {
    if (!a.inferred || a.confirmed || a.corrected) return a;
    changed = true;
    return { ...a, confirmed: { value: a.inferred.value, at } };
  };
  const next = { ...p, undertone: confirm(p.undertone), contrast: confirm(p.contrast) };
  return changed ? bump(next, now) : p;
}

/**
 * The customer answers the Style DNA questions again: fit and week take the new answers as confirmed
 * (a correction stays on top), tastes are replaced, and the colours are left as they are.
 */
export function updateAnswers(p: StyleProfile, input: { fit: Fit; week: Week; tastes: string[] }, now = new Date()): StyleProfile {
  const at = now.toISOString();
  return bump({ ...p, fit: { ...p.fit, confirmed: { value: input.fit, at } }, week: { ...p.week, confirmed: { value: input.week, at } }, tastes: [...input.tastes] }, now);
}

export function setTastes(p: StyleProfile, tastes: string[], now = new Date()): StyleProfile {
  return bump({ ...p, tastes: [...tastes] }, now);
}

/** Whether anything on the profile is still only an estimate. */
export function hasEstimates(p: StyleProfile): boolean {
  return basisOf(p.undertone) === "inferred" || basisOf(p.contrast) === "inferred";
}

/** How the profile is named in a styling request: its id and version. */
export function profileRef(p: StyleProfile): string {
  return `${p.profileId}_v${p.version}`;
}

export function summarize(p: StyleProfile): StyleProfileSummary {
  const field = <T>(a: Attribute<T>) => {
    const value = valueOf(a);
    const basis = basisOf(a);
    return value !== undefined && basis ? { value, basis } : undefined;
  };
  return { undertone: field(p.undertone), contrast: field(p.contrast), fit: field(p.fit), week: field(p.week), tastes: [...p.tastes] };
}

/* ------------------------------------------------------------ colours */

export interface ColourGuide {
  palette: string[];
  avoid: string[];
  line: string;
}

const PALETTES: Record<Undertone, { palette: string[]; avoid: string[]; line: string }> = {
  cool: {
    palette: ["#1F2A44", "#5B5F66", "#E8E4DC", "#7A1F2B", "#2E4A62"],
    avoid: ["#D9A441", "#C97B4A"],
    line: "Cool shades should suit you: navy, charcoal, crisp white and deep red.",
  },
  warm: {
    palette: ["#3B2F2A", "#6B5B3E", "#EFE6D2", "#9A4A2E", "#B08A5A"],
    avoid: ["#C9D3E6", "#E7B8D0"],
    line: "Warm shades should suit you: chocolate, olive, cream, rust and camel.",
  },
  neutral: {
    palette: ["#2B3A4A", "#6E6A62", "#ECE8E1", "#5E6B4E", "#7D2E3A"],
    avoid: ["#E9E36A", "#FF7A3D"],
    line: "Most shades can work for you. Navy, taupe, off white, sage and berry are easy places to start.",
  },
};

const CONTRAST_LINE: Record<Contrast, string> = {
  high: "Strong contrast works, so put a dark piece next to a light one near your face.",
  medium: "Mid tones together look natural on you; keep the very dark and very light apart.",
  low: "Keep the tones close to each other near your face, and soften black with charcoal or navy.",
};

export function colourGuide(undertone: Undertone | undefined, contrast: Contrast | undefined): ColourGuide | null {
  if (!undertone) return null;
  const base = PALETTES[undertone];
  return { palette: base.palette, avoid: base.avoid, line: contrast ? `${base.line} ${CONTRAST_LINE[contrast]}` : base.line };
}

export const UNDERTONE_LABEL: Record<Undertone, string> = { cool: "Cool", warm: "Warm", neutral: "Neutral" };
export const CONTRAST_LABEL: Record<Contrast, string> = { high: "High", medium: "Medium", low: "Low" };

/* ------------------------------------------------------------ legacy */

/** A Style DNA saved by an earlier build: its colours were a fixed sample, so they become an estimate. */
export interface LegacyDna {
  createdAt: string;
  tones?: { undertone?: Undertone; contrast?: Contrast };
  fit: Fit | null;
  lifestyle: Week | null;
  presetIds?: string[];
  portrait?: string;
}

export function fromLegacy(d: LegacyDna): StyleProfile {
  const at = d.createdAt;
  const p: StyleProfile = {
    profileId: newId("dna"),
    version: 1,
    createdAt: at,
    updatedAt: at,
    photo: d.portrait && d.portrait.startsWith("data:") ? "own" : "sample",
    undertone: d.tones?.undertone ? { inferred: { value: d.tones.undertone, source: "sample", adapter: "legacy-sample", at } } : {},
    contrast: d.tones?.contrast ? { inferred: { value: d.tones.contrast, source: "sample", adapter: "legacy-sample", at } } : {},
    fit: d.fit ? { confirmed: { value: d.fit, at } } : {},
    week: d.lifestyle ? { confirmed: { value: d.lifestyle, at } } : {},
    tastes: d.presetIds ?? [],
  };
  return p;
}

export function isProfile(v: unknown): v is StyleProfile {
  return Boolean(v && typeof v === "object" && typeof (v as StyleProfile).profileId === "string" && typeof (v as StyleProfile).version === "number");
}
