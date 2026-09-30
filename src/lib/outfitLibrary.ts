import type { OccasionType, OutfitLabel, LocationType, TimeType, SettingType, BudgetType, PriorityType } from '@/types/praxis';

// ============= LOCKED OUTFIT LIBRARY =============
// CRITICAL: Each outfit is a PERMANENTLY PAIRED unit.
// The image_url and all text fields describe THE EXACT SAME outfit.
// NO mismatches allowed.

export type TierType = 'SAFEST' | 'SHARPER' | 'RELAXED';

export interface OutfitEntry {
  id: string;
  occasion: OccasionType;
  tier: TierType;
  location: LocationType[];
  time: TimeType[];
  setting: SettingType[];
  budget: BudgetType[];
  priority_fit: PriorityType[];
  image_url: string;
  title: string;
  items: {
    top: string;
    bottom: string;
    shoes: string;
    extras?: string;
  };
  reason: string;
}

export const OUTFITS: OutfitEntry[] = [
  // -------------------------
  // DATE
  // -------------------------
  {
    id: "date_safest_01",
    occasion: "DATE",
    tier: "SAFEST",
    location: ["RESTAURANT", "BAR"],
    time: ["NIGHT"],
    setting: ["INDOOR", "BOTH"],
    budget: ["EVERYDAY", "MID_RANGE"],
    priority_fit: ["COMFORT", "SIMPLE"],
    image_url: "/images/date_safest_01.jpg",
    title: "Clean and Relaxed",
    items: {
      top: "Neutral overshirt with a plain t-shirt",
      bottom: "Dark straight jeans",
      shoes: "Clean white sneakers",
    },
    reason: "A safe, confident look that feels natural for a date night.",
  },
  {
    id: "date_sharper_01",
    occasion: "DATE",
    tier: "SHARPER",
    location: ["RESTAURANT", "BAR"],
    time: ["NIGHT"],
    setting: ["INDOOR", "BOTH"],
    budget: ["MID_RANGE", "PREMIUM"],
    priority_fit: ["SHARP", "IMPRESSION"],
    image_url: "/images/date_sharper_01.jpg",
    title: "Smart Casual",
    items: {
      top: "Navy blazer over a fine knit top",
      bottom: "Tailored chinos",
      shoes: "Loafers",
    },
    reason: "More polished without looking like you tried too hard.",
  },
  {
    id: "date_relaxed_01",
    occasion: "DATE",
    tier: "RELAXED",
    location: ["RESTAURANT", "BAR", "HOME"],
    time: ["DAY", "NIGHT"],
    setting: ["INDOOR", "BOTH"],
    budget: ["EVERYDAY"],
    priority_fit: ["COMFORT"],
    image_url: "/images/date_relaxed_01.jpg",
    title: "Easy Weekend",
    items: {
      top: "Plain t-shirt with a light jacket",
      bottom: "Slim dark jeans",
      shoes: "Casual sneakers",
    },
    reason: "Comfort-first while still looking put together.",
  },

  // -------------------------
  // WORK
  // -------------------------
  {
    id: "work_safest_01",
    occasion: "WORK",
    tier: "SAFEST",
    location: ["OFFICE", "MEETING"],
    time: ["DAY"],
    setting: ["INDOOR"],
    budget: ["MID_RANGE"],
    priority_fit: ["SIMPLE", "SHARP"],
    image_url: "/images/work_safest_01.jpg",
    title: "Professional Standard",
    items: {
      top: "Button-down shirt",
      bottom: "Tailored trousers",
      shoes: "Leather lace-up shoes",
    },
    reason: "A safe professional look that works in any office.",
  },
  {
    id: "work_sharper_01",
    occasion: "WORK",
    tier: "SHARPER",
    location: ["OFFICE", "MEETING", "CONFERENCE"],
    time: ["DAY"],
    setting: ["INDOOR"],
    budget: ["MID_RANGE", "PREMIUM"],
    priority_fit: ["SHARP", "IMPRESSION"],
    image_url: "/images/work_sharper_01.jpg",
    title: "Sharp Professional",
    items: {
      top: "Blazer over a crisp shirt",
      bottom: "Tailored trousers",
      shoes: "Oxfords",
    },
    reason: "Sharper choice when you want to look in control.",
  },
  {
    id: "work_relaxed_01",
    occasion: "WORK",
    tier: "RELAXED",
    location: ["OFFICE", "MEETING"],
    time: ["DAY"],
    setting: ["INDOOR"],
    budget: ["EVERYDAY", "MID_RANGE"],
    priority_fit: ["COMFORT", "SIMPLE"],
    image_url: "/images/work_relaxed_01.jpg",
    title: "Modern Workwear",
    items: {
      top: "Knit polo or fine sweater",
      bottom: "Chinos",
      shoes: "Loafers",
    },
    reason: "Comfortable while still looking professional.",
  },

  // -------------------------
  // DINNER
  // -------------------------
  {
    id: "dinner_safest_01",
    occasion: "DINNER",
    tier: "SAFEST",
    location: ["RESTAURANT", "HOME", "HOTEL"],
    time: ["NIGHT"],
    setting: ["INDOOR", "BOTH"],
    budget: ["EVERYDAY", "MID_RANGE"],
    priority_fit: ["SIMPLE", "COMFORT"],
    image_url: "/images/dinner_safest_01.jpg",
    title: "Polished Casual",
    items: {
      top: "Dark knit top",
      bottom: "Clean chinos",
      shoes: "Leather sneakers",
    },
    reason: "Simple and polished for a dinner without overdoing it.",
  },
  {
    id: "dinner_sharper_01",
    occasion: "DINNER",
    tier: "SHARPER",
    location: ["RESTAURANT", "HOTEL"],
    time: ["NIGHT"],
    setting: ["INDOOR", "BOTH"],
    budget: ["MID_RANGE", "PREMIUM"],
    priority_fit: ["SHARP", "IMPRESSION"],
    image_url: "/images/dinner_sharper_01.jpg",
    title: "Elevated Dinner",
    items: {
      top: "Blazer over a fitted knit",
      bottom: "Tailored trousers",
      shoes: "Chelsea boots",
    },
    reason: "A sharper option that looks intentional and clean.",
  },
  {
    id: "dinner_relaxed_01",
    occasion: "DINNER",
    tier: "RELAXED",
    location: ["RESTAURANT", "HOME"],
    time: ["NIGHT"],
    setting: ["INDOOR", "BOTH"],
    budget: ["EVERYDAY"],
    priority_fit: ["COMFORT"],
    image_url: "/images/dinner_relaxed_01.jpg",
    title: "Relaxed Clean",
    items: {
      top: "Plain t-shirt with a light overshirt",
      bottom: "Dark jeans",
      shoes: "Clean sneakers",
    },
    reason: "Relaxed choice that still looks neat for dinner.",
  },

  // -------------------------
  // PARTY
  // -------------------------
  {
    id: "party_safest_01",
    occasion: "PARTY",
    tier: "SAFEST",
    location: ["BAR", "HOME", "HOTEL"],
    time: ["NIGHT"],
    setting: ["INDOOR", "BOTH"],
    budget: ["EVERYDAY", "MID_RANGE"],
    priority_fit: ["SIMPLE", "COMFORT"],
    image_url: "/images/party_safest_01.jpg",
    title: "Night Out Basic",
    items: {
      top: "Black t-shirt with a clean jacket",
      bottom: "Dark jeans",
      shoes: "Leather sneakers",
    },
    reason: "Safe night-out look that always works.",
  },
  {
    id: "party_sharper_01",
    occasion: "PARTY",
    tier: "SHARPER",
    location: ["BAR", "CLUB", "HOTEL"],
    time: ["NIGHT"],
    setting: ["INDOOR"],
    budget: ["MID_RANGE", "PREMIUM"],
    priority_fit: ["IMPRESSION", "SHARP"],
    image_url: "/images/party_sharper_01.jpg",
    title: "Sharp Statement",
    items: {
      top: "Black shirt or fitted knit with a blazer",
      bottom: "Slim dark trousers",
      shoes: "Chelsea boots",
    },
    reason: "Sharper choice if you want to stand out in a clean way.",
  },
  {
    id: "party_relaxed_01",
    occasion: "PARTY",
    tier: "RELAXED",
    location: ["BAR", "HOME"],
    time: ["NIGHT"],
    setting: ["INDOOR", "BOTH"],
    budget: ["EVERYDAY"],
    priority_fit: ["COMFORT"],
    image_url: "/images/party_relaxed_01.jpg",
    title: "Relaxed Street",
    items: {
      top: "Bomber jacket over a plain t-shirt",
      bottom: "Dark jeans",
      shoes: "Casual sneakers",
    },
    reason: "Comfortable option that still fits a party vibe.",
  },

  // -------------------------
  // WEDDING
  // -------------------------
  {
    id: "wedding_safest_01",
    occasion: "WEDDING",
    tier: "SAFEST",
    location: ["HOTEL", "OUTDOOR_VENUE"],
    time: ["DAY", "NIGHT"],
    setting: ["INDOOR", "OUTDOOR", "BOTH"],
    budget: ["MID_RANGE", "PREMIUM"],
    priority_fit: ["SIMPLE", "SHARP"],
    image_url: "/images/wedding_safest_01.jpg",
    title: "Classic Formal",
    items: {
      top: "Navy suit with a white shirt",
      bottom: "Matching suit trousers",
      shoes: "Black oxfords",
    },
    reason: "A classic wedding look that is always appropriate.",
  },
  {
    id: "wedding_sharper_01",
    occasion: "WEDDING",
    tier: "SHARPER",
    location: ["HOTEL", "OUTDOOR_VENUE"],
    time: ["DAY", "NIGHT"],
    setting: ["INDOOR", "OUTDOOR", "BOTH"],
    budget: ["PREMIUM"],
    priority_fit: ["IMPRESSION", "SHARP"],
    image_url: "/images/wedding_sharper_01.jpg",
    title: "Sharp Formal",
    items: {
      top: "Charcoal suit with a crisp shirt",
      bottom: "Matching suit trousers",
      shoes: "Black leather shoes",
      extras: "Tie (optional)",
    },
    reason: "Sharper option if you want a more serious formal presence.",
  },
  {
    id: "wedding_relaxed_01",
    occasion: "WEDDING",
    tier: "RELAXED",
    location: ["HOTEL", "OUTDOOR_VENUE"],
    time: ["DAY", "NIGHT"],
    setting: ["INDOOR", "OUTDOOR", "BOTH"],
    budget: ["MID_RANGE"],
    priority_fit: ["COMFORT"],
    image_url: "/images/wedding_relaxed_01.jpg",
    title: "Relaxed Elegant",
    items: {
      top: "Light blazer with an open-collar shirt",
      bottom: "Tailored trousers",
      shoes: "Loafers",
    },
    reason: "Elegant but more relaxed for a comfortable wedding look.",
  },
];

// ============= VALIDATION GUARD =============
export function getValidOutfits(): OutfitEntry[] {
  return OUTFITS.filter(outfit => 
    outfit.image_url && 
    outfit.items?.top && 
    outfit.items?.bottom && 
    outfit.items?.shoes &&
    outfit.title &&
    outfit.reason &&
    outfit.occasion &&
    outfit.tier
  );
}

export function getOutfitsByOccasion(occasion: OccasionType): OutfitEntry[] {
  return getValidOutfits().filter(outfit => outfit.occasion === occasion);
}

export function getTierLabel(tier: TierType): OutfitLabel {
  const labelMap: Record<TierType, OutfitLabel> = {
    SAFEST: 'Safest choice',
    SHARPER: 'Sharper choice',
    RELAXED: 'More relaxed choice',
  };
  return labelMap[tier];
}
