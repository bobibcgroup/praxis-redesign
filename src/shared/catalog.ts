/**
 * Shared representative data for the Praxis design lab.
 * Reuses the real outfit library (read-only) and adds the vendor layer the
 * founder described for V1: catalog pieces from integrated vendors.
 * Nothing here touches production state.
 */
import { OUTFITS, type OutfitEntry, type TierType } from "@/lib/outfitLibrary";
import type { OccasionType } from "@/types/praxis";

export type OccasionId = OccasionType;

export interface OccasionOption {
  id: OccasionId;
  label: string;
  hint: string;
  /** Mood image for the occasion, taken from the catalog. */
  image: string;
}

export const OCCASIONS: readonly OccasionOption[] = [
  { id: "DINNER", label: "Dinner", hint: "Restaurant, drinks after", image: "/images/dinner_sharper_01.jpg" },
  { id: "WORK", label: "Work", hint: "Office, meeting, pitch", image: "/images/work_sharper_01.jpg" },
  { id: "DATE", label: "Date", hint: "First or fiftieth", image: "/images/date_sharper_01.jpg" },
  { id: "WEDDING", label: "Wedding", hint: "Guest, not groom", image: "/images/wedding_sharper_01.jpg" },
  { id: "PARTY", label: "Party", hint: "Night out, birthday, launch", image: "/images/party_sharper_01.jpg" },
] as const;

export interface ChoiceOption<T extends string = string> {
  id: T;
  label: string;
  hint?: string;
}

export const VENUES: Record<OccasionId, readonly ChoiceOption[]> = {
  DINNER: [
    { id: "RESTAURANT", label: "Restaurant" },
    { id: "BAR", label: "Bar" },
    { id: "HOME", label: "Someone's home" },
    { id: "ROOFTOP", label: "Rooftop" },
  ],
  WORK: [
    { id: "OFFICE", label: "Office" },
    { id: "CLIENT", label: "Client meeting" },
    { id: "EVENT", label: "Industry event" },
    { id: "REMOTE", label: "Video call" },
  ],
  DATE: [
    { id: "RESTAURANT", label: "Restaurant" },
    { id: "BAR", label: "Bar" },
    { id: "WALK", label: "Coffee or a walk" },
    { id: "SHOW", label: "A show" },
  ],
  WEDDING: [
    { id: "HOTEL", label: "Hotel" },
    { id: "GARDEN", label: "Garden" },
    { id: "BEACH", label: "Beach" },
    { id: "ESTATE", label: "Private estate" },
  ],
  PARTY: [
    { id: "CLUB", label: "Club" },
    { id: "HOUSE", label: "House party" },
    { id: "ROOFTOP", label: "Rooftop" },
    { id: "LAUNCH", label: "Launch or gallery" },
  ],
};

export type TimeId = "DAY" | "NIGHT";
export const TIMES: readonly ChoiceOption<TimeId>[] = [
  { id: "DAY", label: "Day" },
  { id: "NIGHT", label: "Night" },
];

export type VibeId = "SAFE" | "SHARP" | "RELAXED";
export const VIBES: readonly ChoiceOption<VibeId>[] = [
  { id: "SAFE", label: "Safe", hint: "Always appropriate" },
  { id: "SHARP", label: "Sharp", hint: "Make an impression" },
  { id: "RELAXED", label: "Relaxed", hint: "Easy, still put together" },
];

export type SpendId = "SENSIBLE" | "ELEVATED" | "OPEN";
export const SPEND: readonly ChoiceOption<SpendId>[] = [
  { id: "SENSIBLE", label: "Sensible", hint: "Under $300 for the look" },
  { id: "ELEVATED", label: "Elevated", hint: "$300 to $900" },
  { id: "OPEN", label: "No limit" },
];

/** A single catalog piece from an integrated vendor. */
export interface Piece {
  id: string;
  slot: "top" | "bottom" | "shoes" | "extras";
  name: string;
  vendor: string;
  price: number;
  /** True when this slot is filled by the user's own uploaded item. */
  owned?: boolean;
}

/** A complete look: catalog pieces plus the reason. */
export interface Look {
  id: string;
  occasion: OccasionId;
  tier: TierType;
  role: "hero" | "sharper" | "relaxed";
  title: string;
  image: string;
  reason: string;
  /** One short line, the "why" that teaches something. */
  why: string;
  pieces: Piece[];
  total: number;
}

const VENDORS = ["Atelier Nord", "Harbour & Finch", "Maison Tarek", "Brass Lane", "Studio Oren"] as const;

const PRICE_BY_SLOT: Record<Piece["slot"], number[]> = {
  top: [89, 145, 220, 310],
  bottom: [110, 160, 240],
  shoes: [140, 195, 280, 420],
  extras: [45, 70, 120],
};

function hash(input: string): number {
  return Array.from(input).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
}

function pick<T>(list: readonly T[], seed: string): T {
  return list[hash(seed) % list.length];
}

function toPieces(entry: OutfitEntry): Piece[] {
  const slots: Array<[Piece["slot"], string | undefined]> = [
    ["top", entry.items.top],
    ["bottom", entry.items.bottom],
    ["shoes", entry.items.shoes],
    ["extras", entry.items.extras],
  ];
  return slots
    .filter((s): s is [Piece["slot"], string] => Boolean(s[1]))
    .map(([slot, name]) => ({
      id: `${entry.id}_${slot}`,
      slot,
      name,
      vendor: pick(VENDORS, `${entry.id}${slot}`),
      price: pick(PRICE_BY_SLOT[slot], `${entry.id}${slot}p`),
    }));
}

const ROLE_BY_TIER: Record<TierType, Look["role"]> = {
  SAFEST: "hero",
  SHARPER: "sharper",
  RELAXED: "relaxed",
};

const WHY_BY_TIER: Record<TierType, string> = {
  SAFEST: "Dark, matched, and quiet. Nothing here can be wrong for the room.",
  SHARPER: "One stronger contrast at the face. That is what people remember.",
  RELAXED: "Softer shoulder, easier shoe. Still finished, less effort on show.",
};

function toLook(entry: OutfitEntry): Look {
  const pieces = toPieces(entry);
  return {
    id: entry.id,
    occasion: entry.occasion,
    tier: entry.tier,
    role: ROLE_BY_TIER[entry.tier],
    title: entry.title,
    image: entry.image_url,
    reason: entry.reason,
    why: WHY_BY_TIER[entry.tier],
    pieces,
    total: pieces.reduce((sum, p) => sum + p.price, 0),
  };
}

/** Returns hero, sharper, relaxed in that order for the occasion. */
export function getLooks(occasion: OccasionId): Look[] {
  const order: TierType[] = ["SAFEST", "SHARPER", "RELAXED"];
  return OUTFITS.filter((o) => o.occasion === occasion)
    .map(toLook)
    .sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier));
}

/** Reorders looks so the one matching the chosen vibe is the hero. */
export function orderByVibe(looks: Look[], vibe: VibeId | null): Look[] {
  if (!vibe) return looks;
  const wanted: TierType = vibe === "SHARP" ? "SHARPER" : vibe === "RELAXED" ? "RELAXED" : "SAFEST";
  const hero = looks.find((l) => l.tier === wanted);
  if (!hero) return looks;
  return [hero, ...looks.filter((l) => l.id !== hero.id)];
}

/** Replaces one slot with the user's own item, marking it as owned. */
export function withOwnedItem(look: Look, slot: Piece["slot"], name: string): Look {
  const pieces = look.pieces.map((p) => (p.slot === slot ? { ...p, name, vendor: "Your wardrobe", price: 0, owned: true } : p));
  return { ...look, pieces, total: pieces.reduce((sum, p) => sum + p.price, 0) };
}

/** Stand-in portraits for the "you" frame until a real capture exists. */
export const STAND_IN_PORTRAIT = "/images/dinner_sharper_01.jpg";

/** Inspiration presets from the real style assets. */
export interface StylePreset {
  id: string;
  label: string;
  images: string[];
}

const styleImages = import.meta.glob<{ default: string }>("@/assets/styles/*.jpg", { eager: true });

function styleSet(slug: string): string[] {
  return Object.entries(styleImages)
    .filter(([path]) => path.includes(`/${slug}`))
    .map(([, mod]) => mod.default)
    .sort();
}

export const STYLE_PRESETS: readonly StylePreset[] = [
  { id: "quiet-luxury", label: "Quiet luxury", images: styleSet("quiet-luxury") },
  { id: "smart-casual", label: "Smart casual", images: styleSet("smart-casual") },
  { id: "modern-minimal", label: "Modern minimal", images: styleSet("modern-minimal") },
  { id: "elevated-street", label: "Elevated street", images: styleSet("elevated-street") },
  { id: "classic-tailored", label: "Classic tailored", images: styleSet("classic-tailored") },
  { id: "relaxed-weekend", label: "Relaxed weekend", images: styleSet("relaxed-weekend") },
];

export type LifestyleId = "OFFICE" | "SOCIAL" | "CASUAL" | "MIXED";
export const LIFESTYLES: readonly ChoiceOption<LifestyleId>[] = [
  { id: "OFFICE", label: "Mostly office" },
  { id: "SOCIAL", label: "Out most nights" },
  { id: "CASUAL", label: "Casual, relaxed" },
  { id: "MIXED", label: "A bit of everything" },
];

export type FitId = "SLIM" | "REGULAR" | "RELAXED";
export const FITS: readonly ChoiceOption<FitId>[] = [
  { id: "SLIM", label: "Slim" },
  { id: "REGULAR", label: "Regular" },
  { id: "RELAXED", label: "Relaxed" },
];

/** Plain-language tone result the DNA can show instead of a season label. */
export interface ToneResult {
  undertone: "cool" | "warm" | "neutral";
  contrast: "high" | "medium" | "low";
  palette: string[];
  avoid: string[];
  line: string;
}

export const SAMPLE_TONES: ToneResult = {
  undertone: "cool",
  contrast: "high",
  palette: ["#1F2A44", "#2F3B2F", "#5B5F66", "#E8E4DC", "#7A1F2B"],
  avoid: ["#D9A441", "#C97B4A"],
  line: "Cool undertone, strong contrast. Deep navy and charcoal near the face, white not cream.",
};
