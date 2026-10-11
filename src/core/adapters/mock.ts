/**
 * The mock recommendation adapter. It is not intelligent and does not pretend to be: it ranks the
 * fifteen curated outfits in src/lib/outfitLibrary.ts with fixed, written-down rules, and writes its
 * explanations from the same rules, so every reason it gives is the reason it actually used. Same
 * request, same answer. Its job is to prove that every input, explanation, look and piece travels
 * through the contracts the real engine will use; it says nothing about how good that engine's
 * styling will be. Responses are marked "demonstration".
 *
 * The rules:
 * - The occasion picks the three outfits (one per tier).
 * - The feel picks the tier: Classic, Sharp or Relaxed (+4).
 * - The place must be one the outfit is tagged for (+2), and nudges formality: a casual place
 *   favours the relaxed look, a formal one the sharper look (+1).
 * - The time of day must match the outfit's day or night tag (+1, or -1 when it does not).
 * - The budget favours outfits tagged for that spend (+1); every example price is drawn from the band.
 * - A piece the customer owns replaces that slot in every look. The photo still shows the original.
 */
import { OUTFITS, type OutfitEntry, type TierType } from "../../lib/outfitLibrary";
import type { BudgetType, LocationType, TimeType } from "../../types/praxis";
import { OCCASIONS, SPEND, TIMES, VIBES } from "../../shared/catalog";
import { CONTRACT_VERSION, type BudgetBand, type Garment, type OutfitRecommendation, type OutfitRole, type RecommendationFactor, type Slot, type StylingRequest, type StylingResponse, type Vibe } from "../contracts";
import type { RecommendationAdapter } from "../service";

export const MOCK_ADAPTER = { id: "mock", version: "1.0.0" } as const;

/* --------------------------------------------------------------- the rules */

/** Where each answer sits among the library's place tags. Proxies are deliberate and listed here. */
const VENUE_TAGS: Record<string, readonly LocationType[]> = {
  RESTAURANT: ["RESTAURANT"],
  BAR: ["BAR"],
  HOME: ["HOME"],
  ROOFTOP: ["BAR", "HOTEL"],
  OFFICE: ["OFFICE"],
  CLIENT: ["MEETING"],
  EVENT: ["CONFERENCE"],
  REMOTE: ["OFFICE"],
  WALK: ["HOME"],
  SHOW: ["RESTAURANT", "BAR"],
  HOTEL: ["HOTEL"],
  GARDEN: ["OUTDOOR_VENUE"],
  BEACH: ["OUTDOOR_VENUE"],
  ESTATE: ["OUTDOOR_VENUE", "HOTEL"],
  CLUB: ["CLUB"],
  HOUSE: ["HOME"],
  LAUNCH: ["BAR", "HOTEL"],
};

type Formality = "casual" | "smart" | "formal";
const VENUE_FORMALITY: Record<string, Formality> = {
  HOME: "casual",
  REMOTE: "casual",
  WALK: "casual",
  BEACH: "casual",
  HOUSE: "casual",
  CLIENT: "formal",
  HOTEL: "formal",
  ESTATE: "formal",
};

const TIME_TAG: Record<StylingRequest["timeOfDay"], TimeType> = { SUNRISE: "DAY", DAY: "DAY", SUNSET: "NIGHT", NIGHT: "NIGHT" };
const BUDGET_TAGS: Record<BudgetBand, readonly BudgetType[]> = { SENSIBLE: ["EVERYDAY"], ELEVATED: ["MID_RANGE"], OPEN: ["PREMIUM", "MID_RANGE"] };
const TIER_FOR_VIBE: Record<Vibe, TierType> = { SAFE: "SAFEST", SHARP: "SHARPER", RELAXED: "RELAXED" };
const ROLE_FOR_TIER: Record<TierType, OutfitRole> = { SAFEST: "classic", SHARPER: "sharper", RELAXED: "relaxed" };
const TIER_ORDER: readonly TierType[] = ["SAFEST", "SHARPER", "RELAXED"];

interface Scored {
  entry: OutfitEntry;
  score: number;
  feel: boolean;
  place: boolean;
  time: boolean;
  bothTimes: boolean;
}

function score(entry: OutfitEntry, req: StylingRequest): Scored {
  const feel = entry.tier === TIER_FOR_VIBE[req.preferredVibe];
  const place = (VENUE_TAGS[req.venue.type] ?? []).some((tag) => entry.location.includes(tag));
  const formality = VENUE_FORMALITY[req.venue.type] ?? "smart";
  const nudged = (formality === "casual" && entry.tier === "RELAXED") || (formality === "formal" && entry.tier === "SHARPER");
  const time = entry.time.includes(TIME_TAG[req.timeOfDay]);
  const budget = BUDGET_TAGS[req.budget.band].some((tag) => entry.budget.includes(tag));
  const total = (feel ? 4 : 0) + (place ? 2 : 0) + (nudged ? 1 : 0) + (time ? 1 : -1) + (budget ? 1 : 0);
  return { entry, score: total, feel, place, time, bothTimes: entry.time.includes("DAY") && entry.time.includes("NIGHT") };
}

/* ------------------------------------------------------- the sample pieces */

/** Invented houses and example prices for the demonstration. Nothing here is a real retailer. */
const HOUSES = ["Atelier Nord", "Harbour & Finch", "Maison Tarek", "Brass Lane", "Studio Oren"] as const;

/** Example prices per budget, so every total lands inside the range the customer chose. */
const PRICE_BY_BAND: Record<BudgetBand, Record<Slot, number[]>> = {
  SENSIBLE: { top: [49, 69, 89], bottom: [45, 59, 79], shoes: [65, 85, 99], extras: [19, 25, 29] },
  ELEVATED: { top: [145, 195, 240], bottom: [110, 160, 195], shoes: [140, 195, 260], extras: [70, 95, 120] },
  OPEN: { top: [310, 420, 560], bottom: [240, 320, 410], shoes: [280, 420, 560], extras: [120, 180, 240] },
};

function seeded(input: string): number {
  return Array.from(input).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
}

function pick<T>(list: readonly T[], seed: string): T {
  return list[seeded(seed) % list.length];
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** The stylist's line on why the pieces work together, true to each photograph. */
const RATIONALE: Record<string, string> = {
  date_safest_01: "Easy and confident, so nothing here looks like you tried too hard.",
  date_sharper_01: "The blazer lifts it, and the knit keeps it from feeling like work.",
  date_relaxed_01: "A light jacket over a plain t-shirt feels easy and still looks put together.",
  work_safest_01: "A clean shirt and tailored trousers are right in any office.",
  work_sharper_01: "A blazer over a crisp shirt says you’re in charge of the room.",
  work_relaxed_01: "A fine knit polo is comfortable all day and still looks professional.",
  dinner_safest_01: "A dark knit and clean chinos look polished without overdoing it.",
  dinner_sharper_01: "A blazer over a fitted knit looks intentional, and the boots finish it.",
  dinner_relaxed_01: "An overshirt over a plain t-shirt keeps it relaxed and still neat.",
  party_safest_01: "Black and a clean jacket work in any room after dark.",
  party_sharper_01: "All black with a blazer stands out in a clean way.",
  party_relaxed_01: "A bomber over a plain t-shirt is easy to move in and right for the night.",
  wedding_safest_01: "A navy suit and a white shirt are always right at a wedding.",
  wedding_sharper_01: "Charcoal and a tie give you a more serious presence.",
  wedding_relaxed_01: "An open collar under a light blazer is elegant without feeling stiff.",
};

function garments(entry: OutfitEntry, req: StylingRequest): Garment[] {
  const slots: Array<[Slot, string | undefined]> = [
    ["top", entry.items.top],
    ["bottom", entry.items.bottom],
    ["shoes", entry.items.shoes],
    ["extras", entry.items.extras],
  ];
  return slots
    .filter((s): s is [Slot, string] => Boolean(s[1]))
    .map(([slot, name]): Garment => {
      const owned = req.wardrobeItems.find((w) => w.slot === slot);
      if (owned) return { garmentId: `${entry.id}_${slot}_owned`, slot, name: owned.label, source: "wardrobe", wardrobeItemId: owned.wardrobeItemId };
      const house = pick(HOUSES, `${entry.id}${slot}`);
      return {
        garmentId: `${entry.id}_${slot}`,
        slot,
        name,
        source: "retail",
        product: {
          productId: `sample_${entry.id}_${slot}`,
          retailerId: slug(house),
          retailerName: house,
          price: pick(PRICE_BY_BAND[req.budget.band][slot], `${entry.id}${slot}p`),
          currency: "USD",
          priceStatus: "example",
          availability: "unknown",
        },
      };
    });
}

/* --------------------------------------------------- the written reasons */

const OCCASION_PHRASE: Record<StylingRequest["occasion"], string> = { DINNER: "dinner", WORK: "work", DATE: "a date", WEDDING: "a wedding", PARTY: "a party" };
const VENUE_AT: Record<string, string> = {
  RESTAURANT: "at a restaurant",
  BAR: "at a bar",
  HOME: "at someone’s home",
  ROOFTOP: "on a rooftop",
  OFFICE: "at the office",
  CLIENT: "with a client",
  EVENT: "at an industry event",
  REMOTE: "on a video call",
  WALK: "over coffee or a walk",
  SHOW: "at a show",
  HOTEL: "at a hotel",
  GARDEN: "in a garden",
  BEACH: "on a beach",
  ESTATE: "at a private estate",
  CLUB: "at a club",
  HOUSE: "at a house party",
  LAUNCH: "at a launch or gallery",
};
const VENUE_NOUN: Record<string, string> = {
  RESTAURANT: "a restaurant",
  BAR: "a bar",
  HOME: "someone’s home",
  ROOFTOP: "a rooftop",
  OFFICE: "the office",
  CLIENT: "a client meeting",
  EVENT: "an industry event",
  REMOTE: "a video call",
  WALK: "coffee or a walk",
  SHOW: "a show",
  HOTEL: "a hotel",
  GARDEN: "a garden",
  BEACH: "a beach",
  ESTATE: "a private estate",
  CLUB: "a club",
  HOUSE: "a house party",
  LAUNCH: "a launch or gallery",
};
const TIME_AT: Record<StylingRequest["timeOfDay"], string> = { SUNRISE: "at sunrise", DAY: "in the day", SUNSET: "at sunset", NIGHT: "at night" };
const FEEL_WORD: Record<Vibe, string> = { SAFE: "Classic", SHARP: "Sharp", RELAXED: "Relaxed" };
const ALTERNATIVE: Record<TierType, string> = { SAFEST: "A classic alternative", SHARPER: "A sharper alternative", RELAXED: "A more relaxed alternative" };

function label<T extends string>(list: readonly { id: T; label: string }[], id: T): string {
  return list.find((o) => o.id === id)?.label ?? id;
}

function explain(s: Scored, req: StylingRequest): OutfitRecommendation["explanation"] {
  const at = VENUE_AT[req.venue.type] ?? "";
  const context = `for ${OCCASION_PHRASE[req.occasion]} ${at} ${TIME_AT[req.timeOfDay]}`.replace(/\s+/g, " ").trim();
  const lead = s.feel ? `${FEEL_WORD[req.preferredVibe]}, as you asked, ${context}.` : `${ALTERNATIVE[s.entry.tier]} ${context}.`;
  const noun = VENUE_NOUN[req.venue.type] ?? req.venue.label.toLowerCase();
  const caveats = [!s.place ? `Less usual for ${noun}.` : "", !s.time ? (TIME_TAG[req.timeOfDay] === "NIGHT" ? "More of a daytime look." : "More of an evening look.") : ""].filter(Boolean);

  const tag = TIME_TAG[req.timeOfDay];
  const factors: RecommendationFactor[] = [
    { factor: "occasion", value: label(OCCASIONS, req.occasion), influence: `One of my ${label(OCCASIONS, req.occasion).toLowerCase()} looks` },
    { factor: "venue", value: req.venue.label, influence: s.place ? `Right for ${noun}` : `Less usual for ${noun}` },
    {
      factor: "time",
      value: label(TIMES, req.timeOfDay),
      influence: s.bothTimes ? "Works day or night" : s.time ? (tag === "NIGHT" ? "Made for the evening" : "Made for the day") : tag === "NIGHT" ? "More of a daytime look" : "More of an evening look",
    },
    {
      factor: "style",
      value: label(VIBES, req.preferredVibe),
      influence: s.feel ? `The ${label(VIBES, req.preferredVibe).toLowerCase()} feel you asked for` : ALTERNATIVE[s.entry.tier],
    },
    {
      factor: "budget",
      value: label(SPEND, req.budget.band),
      influence: req.budget.band === "OPEN" ? "Example prices, with no limit set" : "Example prices inside your budget",
    },
    ...req.wardrobeItems.map((w): RecommendationFactor => ({ factor: "wardrobe", value: w.label, influence: "Kept in the look. The photo shows a similar piece." })),
  ];
  return { summary: [lead, ...caveats].join(" "), contributingFactors: factors, source: "mock_rules" };
}

/* ---------------------------------------------------------- the answer */

/** Pure and deterministic: the same request always gives the same response. */
export function mockRecommend(req: StylingRequest): StylingResponse {
  const ranked = OUTFITS.filter((o) => o.occasion === req.occasion)
    .map((entry) => score(entry, req))
    .sort((a, b) => b.score - a.score || TIER_ORDER.indexOf(a.entry.tier) - TIER_ORDER.indexOf(b.entry.tier));

  const outfits = ranked.map((s, i): OutfitRecommendation => {
    const pieces = garments(s.entry, req);
    return {
      outfitId: s.entry.id,
      rank: i + 1,
      role: ROLE_FOR_TIER[s.entry.tier],
      title: s.entry.title,
      rationale: RATIONALE[s.entry.id] ?? s.entry.reason,
      explanation: explain(s, req),
      garments: pieces,
      visualization: {
        imageId: `img_${s.entry.id}`,
        outfitId: s.entry.id,
        kind: "styled_visualization",
        url: s.entry.image_url,
        provider: "praxis-library",
        fidelity: "representative",
        sourceGarmentIds: pieces.map((g) => g.garmentId),
        status: "ready",
        width: 1024,
        height: 1024,
      },
      pricing: { total: pieces.reduce((sum, g) => sum + (g.source === "retail" ? g.product.price : 0), 0), currency: "USD", status: "example" },
    };
  });

  return {
    recommendationId: `rec_${req.requestId.replace(/^req_/, "")}`,
    requestId: req.requestId,
    inputKey: req.inputKey,
    contractVersion: CONTRACT_VERSION,
    adapter: { ...MOCK_ADAPTER },
    mode: "demonstration",
    status: outfits.length === 0 ? "empty" : "completed",
    outfits,
    createdAt: req.generatedAt,
  };
}

export function createMockAdapter(): RecommendationAdapter {
  return {
    ...MOCK_ADAPTER,
    async recommend(request) {
      return mockRecommend(request);
    },
  };
}
