/**
 * Turns the recommendation service's response into the looks the screens draw. The screens never
 * rank, price or explain a look themselves; they show what the response says, in its order.
 */
import { OCCASIONS, moodImage, type Look, type OccasionId } from "../../shared/catalog";
import type { OutfitRecommendation, OutfitRole, StylingResponse } from "../../core/contracts";
import type { Answers, Slot } from "./journeyContext";

export const SAMPLE_ITEMS: Record<Slot, string> = {
  top: "Your navy overshirt",
  bottom: "Your charcoal trousers",
  shoes: "Your black loafers",
  extras: "Your steel watch",
};

export function toLook(o: OutfitRecommendation, occasion: OccasionId): Look {
  return {
    id: o.outfitId,
    occasion,
    role: o.role,
    title: o.title,
    image: o.visualization.url,
    why: o.rationale,
    rank: o.rank,
    summary: o.explanation.summary,
    factors: o.explanation.contributingFactors,
    priceStatus: o.pricing.status,
    imageFidelity: o.visualization.fidelity,
    total: o.pricing.total,
    pieces: o.garments.map((g) =>
      g.source === "wardrobe"
        ? { id: g.garmentId, slot: g.slot, name: g.name, vendor: "Your wardrobe", price: 0, owned: true }
        : { id: g.garmentId, slot: g.slot, name: g.name, vendor: g.product.retailerName, price: g.product.price, priceStatus: g.product.priceStatus, availability: g.product.availability },
    ),
  };
}

export interface ResolvedLooks {
  /** In the service's order: the pick first. The order never changes while browsing. */
  looks: Look[];
  hero: Look;
}

/** The looks of a response, with the one in the URL in front (or the pick). */
export function resolveFromResponse(response: StylingResponse | null, occasion: OccasionId | null, heroId: string | null): ResolvedLooks | null {
  if (!response || !occasion || response.outfits.length === 0) return null;
  const looks = response.outfits.map((o) => toLook(o, occasion));
  return { looks, hero: looks.find((l) => l.id === heroId) ?? looks[0] };
}

export function occasionLabel(id: Answers["occasion"]): string {
  return OCCASIONS.find((o) => o.id === id)?.label ?? "";
}

/** "for dinner", "for work", "for a date". */
export function forOccasion(id: Answers["occasion"]): string {
  const label = occasionLabel(id).toLowerCase();
  return id === "WORK" || id === "DINNER" ? `for ${label}` : `for a ${label}`;
}

/** The picture beside a question: the occasion's mood, then the feel being chosen. A preview, not a look. */
export function canvasImage(answers: Answers): string | null {
  return answers.occasion ? moodImage(answers.occasion, answers.vibe) : null;
}

export function money(n: number): string {
  return n === 0 ? "Owned" : `$${n.toLocaleString("en-US")}`;
}

export const ROLE_LABEL: Record<OutfitRole, string> = { classic: "Classic", sharper: "Sharper", relaxed: "Relaxed" };
export const SLOT_LABEL: Record<Slot, string> = { top: "Top", bottom: "Bottom", shoes: "Shoes", extras: "Accessory" };
