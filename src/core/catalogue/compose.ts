/**
 * Outfit composition: the recommendation decides what should be worn (the styling spec); this file
 * decides which catalogue fills each part. Store first when the store's piece is genuinely right,
 * the Praxis reference otherwise; the customer's own piece always keeps its place.
 *
 * Order of what matters, as the brief set it: styling suitability, then how the pieces go together,
 * then the customer's answers and budget, then availability, then the store. In practice:
 * - A store piece must be the same kind (or a close stand-in), within one step of formality, and of a
 *   matching colour family, in stock or of unknown stock, with a real price. Below the bar, the
 *   reference piece stays: a weaker store piece is never put in just to sell it.
 * - The finished look is checked as a whole: no more than two accent colours, formality within two
 *   steps, an outer layer only over a base, the pieces to buy inside the budget. A store piece that
 *   breaks a rule goes back to its reference.
 * - Every part the look needs must be filled. If one can't be, the look is partial and says which.
 *
 * Pure and deterministic: the same spec and candidates always give the same look.
 */
import type { Garment, GarmentAttributes, Layer, OutfitRecommendation, ReferenceGarment, RetailGarment, Slot, WardrobeGarment } from "../contracts";
import { classify, NEUTRALS, colourOf } from "../../shared/ontology.mjs";
import { purchasable, standsIn, type CatalogueGarment, type ColourFamily, type Formality } from "./garment";
import { referenceOutfit } from "./reference";

/** One thing the look needs: the reference piece the stylist chose, and what any substitute must match. */
export interface StylingPart {
  /** Unique within the look: outer, base, bottom, shoes, belt, tie. */
  partId: string;
  slot: Slot;
  layer?: Layer;
  subcategory: string;
  colour?: ColourFamily;
  formality: Formality;
  /** Must be filled for the look to stand: the base top, the bottom, the shoes, and an outer layer the look was built on. */
  required: boolean;
  /** The Praxis reference piece for this part; null when the engine named a part the catalogue doesn't hold. */
  reference: CatalogueGarment | null;
  /** What the engine called it, for the store search. */
  name: string;
}

export interface StylingSpec {
  outfitId: string;
  parts: StylingPart[];
  /** Pieces the customer owns, each holding the part it fills. */
  owned: { partId: string; garment: WardrobeGarment }[];
}

export type PickKind = "shopify" | "reference" | "wardrobe" | "missing";
export interface Pick {
  part: StylingPart;
  kind: PickKind;
  garment?: CatalogueGarment;
  owned?: WardrobeGarment;
  /** How well the store piece fits the part (0 to 100), when one was chosen or considered. */
  score?: number;
  /** Why this source, in a few words, for the record. */
  reason: string;
}

export interface ComposedLook {
  outfitId: string;
  picks: Pick[];
  status: "complete" | "partial" | "unavailable";
  issues: string[];
}

/** A store piece needs this score to take a reference's place. */
export const STORE_BAR = 75;
const PART_ORDER = ["outer", "base", "top", "bottom", "shoes", "belt", "tie", "extras"];

/* ------------------------------------------------------------ the spec */

/** The spec for a recommended look: its reference pieces when the look comes from the library, else read from the pieces' names. */
export function specFromLook(o: OutfitRecommendation): StylingSpec {
  const refs = referenceOutfit(o.outfitId);
  const parts: StylingPart[] = refs.length
    ? refs.map((r) => ({
        partId: r.id.slice(`ref_${o.outfitId}_`.length),
        slot: r.slot,
        ...(r.layer ? { layer: r.layer } : {}),
        subcategory: r.subcategory,
        colour: r.colour,
        formality: r.formality,
        required: r.slot !== "extras",
        reference: r,
        name: r.name,
      }))
    : o.garments.flatMap((g): StylingPart[] => {
        if (g.source === "wardrobe") return [];
        const kind = classify(g.name);
        if (!kind) return [];
        return [{ partId: g.layer ?? g.slot, slot: g.slot, ...(kind.layer ? { layer: kind.layer } : {}), subcategory: kind.subcategory, colour: colourOf(g.name), formality: kind.formality, required: g.slot !== "extras", reference: null, name: g.name }];
      });
  // A piece the customer owns fills the part of its kind: its layer when its name says, else the outer layer of a top.
  const owned = o.garments.flatMap((g) => {
    if (g.source !== "wardrobe") return [];
    const kind = classify(g.name);
    const inSlot = parts.filter((p) => p.slot === g.slot);
    const part = inSlot.find((p) => kind?.layer && p.layer === kind.layer) ?? inSlot.find((p) => p.layer === "outer") ?? inSlot[0];
    return part ? [{ partId: part.partId, garment: g }] : [];
  });
  return { outfitId: o.outfitId, parts, owned };
}

/* ------------------------------------------------------------ scoring */

const neutral = (c?: ColourFamily) => !!c && NEUTRALS.includes(c);

/** How well a store piece fills a part, 0 to 100; null when it can't fill it at all. */
export function scoreFor(part: StylingPart, g: CatalogueGarment): number | null {
  if (g.slot !== part.slot || (g.layer ?? null) !== (part.layer ?? null)) return null;
  if (!purchasable(g)) return null;
  const kind = standsIn(part.subcategory, g.subcategory);
  if (!kind) return null;
  const gap = Math.abs(g.formality - part.formality);
  if (gap > 1) return null;
  let s = (kind === "same" ? 40 : 25) + (gap === 0 ? 25 : 12);
  if (!part.colour) s += 12;
  else if (!g.colour) s += 5;
  else if (g.colour === part.colour) s += 25;
  else if (neutral(g.colour) && neutral(part.colour)) s += 10;
  else s -= 20;
  s += g.product?.availability === "in_stock" ? 10 : -5;
  return Math.max(0, Math.min(100, s));
}

/* ------------------------------------------------------------ composing */

export interface ComposeOptions {
  /** The most the pieces to buy may cost together. */
  budgetMax?: number;
}

/** Fills each part of the spec, then checks the look as a whole. */
export function compose(spec: StylingSpec, candidates: Readonly<Record<string, readonly CatalogueGarment[]>>, options: ComposeOptions = {}): ComposedLook {
  const picks: Pick[] = spec.parts.map((part) => {
    const owned = spec.owned.find((o) => o.partId === part.partId);
    if (owned) return { part, kind: "wardrobe", owned: owned.garment, reason: "Yours" };
    const ranked = (candidates[part.partId] ?? [])
      .map((g) => ({ g, s: scoreFor(part, g) }))
      .filter((x): x is { g: CatalogueGarment; s: number } => x.s !== null)
      .sort((a, b) => b.s - a.s || (a.g.product?.price ?? 0) - (b.g.product?.price ?? 0) || a.g.id.localeCompare(b.g.id));
    const best = ranked[0];
    if (best && best.s >= STORE_BAR) return { part, kind: "shopify", garment: best.g, score: best.s, reason: "Store piece fits the look" };
    if (part.reference) return { part, kind: "reference", garment: part.reference, ...(best ? { score: best.s } : {}), reason: best ? "Store piece not close enough" : "Nothing right in the store" };
    return { part, kind: "missing", reason: "No piece for this part" };
  });

  const back = (p: Pick, reason: string) => {
    const i = picks.indexOf(p);
    picks[i] = p.part.reference ? { part: p.part, kind: "reference", garment: p.part.reference, score: p.score, reason } : { part: p.part, kind: "missing", reason };
  };
  const shop = () => picks.filter((p) => p.kind === "shopify");

  // Colour: two accent colours at most beside the neutrals.
  for (;;) {
    const accents = new Set(picks.map((p) => p.garment?.colour).filter((c): c is ColourFamily => !!c && !neutral(c)));
    if (accents.size <= 2) break;
    const worst = shop().filter((p) => p.garment?.colour && !neutral(p.garment.colour)).sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
    if (!worst) break;
    back(worst, "Too many colours together");
  }
  // Formality: the pieces within two steps of each other (accessories aside).
  for (;;) {
    const worn = picks.filter((p) => p.garment && p.part.slot !== "extras");
    const levels = worn.map((p) => p.garment!.formality);
    if (!levels.length || Math.max(...levels) - Math.min(...levels) <= 2) break;
    const mean = spec.parts.reduce((s, p) => s + p.formality, 0) / spec.parts.length;
    const worst = shop().filter((p) => p.part.slot !== "extras").sort((a, b) => Math.abs(b.garment!.formality - mean) - Math.abs(a.garment!.formality - mean))[0];
    if (!worst) break;
    back(worst, "Too formal or too casual beside the rest");
  }
  // Budget: the pieces to buy, together, inside the customer's limit; the dearest goes back first.
  if (options.budgetMax !== undefined) {
    for (;;) {
      const total = shop().reduce((s, p) => s + (p.garment!.product?.price ?? 0), 0);
      if (total <= options.budgetMax) break;
      const dearest = shop().sort((a, b) => (b.garment!.product?.price ?? 0) - (a.garment!.product?.price ?? 0))[0];
      if (!dearest) break;
      back(dearest, "Over your budget");
    }
  }

  const issues: string[] = [];
  for (const p of picks) if (p.kind === "missing" && p.part.required) issues.push(`missing_${p.part.partId}`);
  const has = (partId: string) => picks.some((p) => p.part.partId === partId && p.kind !== "missing");
  if (has("outer") && spec.parts.some((p) => p.partId === "base") && !has("base")) issues.push("outer_without_base");
  const filled = picks.filter((p) => p.kind !== "missing").length;
  const status = filled === 0 ? "unavailable" : issues.length ? "partial" : "complete";
  picks.sort((a, b) => PART_ORDER.indexOf(a.part.partId) - PART_ORDER.indexOf(b.part.partId));
  return { outfitId: spec.outfitId, picks, status, issues };
}

/* ------------------------------------------------------------ back to the contract */

/** The look with its composed pieces: store pieces as retail garments, references as reference garments, owned pieces as they were. */
/** A catalogue piece's attributes as the look carries them, for its picture and the picture's checks. */
function attributesOf(g: CatalogueGarment): GarmentAttributes {
  return {
    subcategory: g.subcategory,
    ...(g.colour ? { colour: g.colour } : {}),
    ...(g.material ? { material: g.material } : {}),
    ...(g.fit ? { fit: g.fit } : {}),
    ...(g.silhouette ? { silhouette: g.silhouette } : {}),
    formality: g.formality,
  };
}

export function toOutfit(o: OutfitRecommendation, look: ComposedLook): OutfitRecommendation {
  const garments: Garment[] = look.picks.flatMap((p): Garment[] => {
    const garmentId = `${o.outfitId}_${p.part.partId}`;
    const layer = p.part.layer ? { layer: p.part.layer } : {};
    if (p.kind === "wardrobe" && p.owned) return [{ ...p.owned, ...layer }];
    if (p.kind === "shopify" && p.garment?.product) {
      const g = p.garment;
      return [{ garmentId, slot: p.part.slot, ...layer, name: g.name, attributes: attributesOf(g), source: "retail", product: g.product!, ...(g.retailerVariantId ? { retailerVariantId: g.retailerVariantId } : {}) } satisfies RetailGarment];
    }
    if (p.kind === "reference" && p.garment) {
      const g = p.garment;
      return [{ garmentId, slot: p.part.slot, ...layer, name: g.name, attributes: attributesOf(g), source: "reference", referenceId: g.id, description: [g.silhouette, g.material].filter(Boolean).join(", "), ...(g.image ? { image: g.image } : {}) } satisfies ReferenceGarment];
    }
    return [];
  });
  const toBuy = garments.filter((g): g is RetailGarment => g.source === "retail");
  const total = Math.round(toBuy.reduce((s, g) => s + g.product.price, 0) * 100) / 100;
  const live = toBuy.length > 0 && toBuy.every((g) => g.product.priceStatus === "live");
  const refs = garments.filter((g) => g.source === "reference").length;
  const budgetLine = toBuy.length === 0 ? "Nothing to buy here yet; the pieces are styling references" : `Real prices, $${Math.round(total)} for the ${toBuy.length === 1 ? "piece" : `${toBuy.length} pieces`} to buy${refs ? `; ${refs === 1 ? "one reference piece" : `${refs} reference pieces`} not included` : ""}`;
  return {
    ...o,
    garments,
    explanation: { ...o.explanation, contributingFactors: o.explanation.contributingFactors.map((f) => (f.factor === "budget" ? { ...f, influence: budgetLine } : f)) },
    visualization: { ...o.visualization, sourceGarmentIds: garments.map((g) => g.garmentId) },
    pricing: { total, currency: "USD", status: live ? "live" : o.pricing.status },
  };
}
