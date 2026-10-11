/**
 * The journey's options (occasions, places, times, feels, budgets, Style DNA choices) and the view
 * model the screens draw. The looks themselves come from the recommendation service (src/core).
 * Nothing here touches production state.
 */
import { OUTFITS, type TierType } from "@/lib/outfitLibrary";
import type { OccasionType } from "@/types/praxis";
import type { Availability, OutfitRole, PriceStatus, PurchaseRoute, RecommendationFactor } from "@/core/contracts";

export type OccasionId = OccasionType;

export interface OccasionOption {
  id: OccasionId;
  label: string;
  hint?: string;
  /** Mood image for the occasion, taken from the catalog. */
  image: string;
}

export const OCCASIONS: readonly OccasionOption[] = [
  { id: "DINNER", label: "Dinner", image: "/images/dinner_sharper_01.jpg" },
  { id: "WORK", label: "Work", image: "/images/work_sharper_01.jpg" },
  { id: "DATE", label: "Date", image: "/images/date_sharper_01.jpg" },
  { id: "WEDDING", label: "Wedding", image: "/images/wedding_sharper_01.jpg" },
  { id: "PARTY", label: "Party", image: "/images/party_sharper_01.jpg" },
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

export type TimeId = "SUNRISE" | "DAY" | "SUNSET" | "NIGHT";
export const TIMES: readonly ChoiceOption<TimeId>[] = [
  { id: "SUNRISE", label: "Sunrise" },
  { id: "DAY", label: "Day" },
  { id: "SUNSET", label: "Early evening" },
  { id: "NIGHT", label: "Night" },
];

/** The times that make sense for each occasion: no sunrise dinner, no sunset at the office. */
const TIME_IDS: Record<OccasionId, readonly TimeId[]> = {
  DINNER: ["SUNSET", "NIGHT"],
  WORK: ["DAY", "NIGHT"],
  DATE: ["DAY", "SUNSET", "NIGHT"],
  WEDDING: ["SUNRISE", "DAY", "SUNSET", "NIGHT"],
  PARTY: ["DAY", "SUNSET", "NIGHT"],
};

export function timesFor(occasion: OccasionId | null): readonly ChoiceOption<TimeId>[] {
  return occasion ? TIMES.filter((t) => TIME_IDS[occasion].includes(t.id)) : TIMES;
}

export type VibeId = "SAFE" | "SHARP" | "RELAXED";
export const VIBES: readonly ChoiceOption<VibeId>[] = [
  { id: "SAFE", label: "Classic", hint: "Always appropriate" },
  { id: "SHARP", label: "Sharp", hint: "Make an impression" },
  { id: "RELAXED", label: "Relaxed", hint: "Easy, still put together" },
];

export type SpendId = "SENSIBLE" | "ELEVATED" | "OPEN";
export const SPEND: readonly ChoiceOption<SpendId>[] = [
  { id: "SENSIBLE", label: "Under $300" },
  { id: "ELEVATED", label: "$300 to $900" },
  { id: "OPEN", label: "No limit" },
];

/**
 * The view model the screens draw: one piece of a look. Built from the recommendation service's
 * response (src/a/lib/looks.ts), never from the catalogue directly.
 */
export interface Piece {
  /** The garment id from the response. */
  id: string;
  slot: "top" | "bottom" | "shoes" | "extras";
  name: string;
  /** The retailer's name, or "Your wardrobe" for an owned piece. */
  vendor: string;
  price: number;
  /** True when this slot is filled by the user's own item. */
  owned?: boolean;
  priceStatus?: PriceStatus;
  availability?: Availability;
  /** From the retailer, when it lists them. */
  sizes?: string[];
  sizeAvailability?: Record<string, Availability>;
  category?: string;
  retailerId?: string;
  /** How it can be bought; absent or "none" means not from here. */
  purchase?: PurchaseRoute;
  deliveryEstimate?: string;
}

/** The view model for one look, with the reasons the service gave for it. */
export interface Look {
  id: string;
  occasion: OccasionId;
  role: OutfitRole;
  title: string;
  image: string;
  /** The stylist's line on why the pieces work together. */
  why: string;
  pieces: Piece[];
  total: number;
  /** 1 is the pick. Absent on looks saved before the service existed. */
  rank?: number;
  /** One sentence tying the look to the brief, from the service. */
  summary?: string;
  factors?: RecommendationFactor[];
  priceStatus?: PriceStatus;
  /** Whether the photo shows these exact pieces or a similar styling. */
  imageFidelity?: "exact" | "representative";
}

/** The occasion's mood picture, then the look for the feel being chosen: a preview while answering, not a recommendation. */
export function moodImage(occasion: OccasionId, vibe: VibeId | null): string | null {
  const tier: TierType | null = vibe === "SHARP" ? "SHARPER" : vibe === "RELAXED" ? "RELAXED" : vibe === "SAFE" ? "SAFEST" : null;
  const entry = tier ? OUTFITS.find((o) => o.occasion === occasion && o.tier === tier) : null;
  return entry?.image_url ?? OCCASIONS.find((o) => o.id === occasion)?.image ?? null;
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
  line: "You have cool tones and strong contrast. Deep navy, charcoal and crisp white should work especially well near your face.",
};
