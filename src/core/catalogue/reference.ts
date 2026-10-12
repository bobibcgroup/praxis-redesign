/**
 * The Praxis reference catalogue: every piece worn in the fifteen library photographs
 * (public/images/<occasion>_<tier>_01.jpg), filed one by one with the ontology's attributes. Each
 * piece's picture is its part of that photograph (a crop), so a reference is always shown as worn.
 *
 * A reference piece completes the styling when a store has nothing right for it. It is never priced,
 * never linked and never for sale here (availability "not_for_sale").
 *
 * Filed from what each photograph shows. Two library entries say more than their photograph does
 * (party_sharper_01 lists a knit and a blazer, the photo shows a black shirt; wedding_sharper_01 lists
 * a navy tie, the photo shows none): the catalogue follows the photograph, and the tie is kept without
 * a picture.
 *
 * The photographs are the library images the site already shows. They are Praxis's styling pictures,
 * not product photographs; confirm their licence before any use outside the site (docs/CATALOGUE.md).
 */
import type { Layer, ReferenceImage, Slot } from "../contracts";
import { seasonsOf, type Formality } from "../../shared/ontology.mjs";
import type { CatalogueGarment, ColourFamily, Fit } from "./garment";

/** Where each part of the outfit sits in a library photograph, as fractions of its width and height. */
const REGION: Record<"top" | "bottom" | "shoes" | "belt" | "neck", ReferenceImage["region"]> = {
  top: { x: 0.3, y: 0.12, w: 0.4, h: 0.42 },
  bottom: { x: 0.33, y: 0.42, w: 0.34, h: 0.48 },
  shoes: { x: 0.3, y: 0.84, w: 0.4, h: 0.16 },
  belt: { x: 0.36, y: 0.34, w: 0.28, h: 0.1 },
  neck: { x: 0.4, y: 0.12, w: 0.2, h: 0.2 },
};

const FORMALITY: Record<string, Formality> = {
  "suit-jacket": 5, "suit-trousers": 5, "dress-shoes": 5, tie: 5,
  blazer: 4, trousers: 4, loafers: 4, "chelsea-boots": 4, "dress-shirt": 4,
  knit: 3, shirt: 3, polo: 3, chinos: 3, belt: 3,
  overshirt: 2, jacket: 2, jeans: 2, sneakers: 2,
  "t-shirt": 1,
};

type Row = [part: string, slot: Slot, layer: Layer | null, name: string, subcategory: string, colour: ColourFamily, material: string, fit: Fit, silhouette: string, attrs: string[], region?: keyof typeof REGION | null];

/** Outfit by outfit, as photographed. */
const ROWS: Record<string, Row[]> = {
  date_relaxed_01: [
    ["outer", "top", "outer", "Light blue bomber jacket", "jacket", "blue", "cotton", "regular", "short, ribbed hem", ["casual", "clean"]],
    ["base", "top", "base", "Grey crew neck t-shirt", "t-shirt", "grey", "cotton", "regular", "crew neck", ["casual", "essential"]],
    ["bottom", "bottom", null, "Dark indigo slim jeans", "jeans", "navy", "denim", "slim", "slim, straight leg", ["casual", "dark wash"]],
    ["shoes", "shoes", null, "White leather sneakers", "sneakers", "white", "leather", "regular", "low top", ["clean", "minimal"]],
  ],
  date_safest_01: [
    ["outer", "top", "outer", "Navy overshirt", "overshirt", "navy", "wool", "regular", "boxy, patch pocket", ["smart casual", "layering"]],
    ["base", "top", "base", "White crew neck t-shirt", "t-shirt", "white", "cotton", "regular", "crew neck", ["essential", "clean"]],
    ["bottom", "bottom", null, "Charcoal straight jeans", "jeans", "grey", "denim", "regular", "straight leg", ["casual", "dark"]],
    ["shoes", "shoes", null, "White leather sneakers", "sneakers", "white", "leather", "regular", "low top", ["clean", "minimal"]],
  ],
  date_sharper_01: [
    ["outer", "top", "outer", "Navy blazer", "blazer", "navy", "wool", "slim", "single breasted, notch lapel", ["tailored", "evening"]],
    ["base", "top", "base", "Grey fine knit crew neck", "knit", "grey", "merino", "slim", "fine gauge, crew neck", ["refined", "layering"]],
    ["bottom", "bottom", null, "Charcoal tailored trousers", "trousers", "grey", "wool", "slim", "tapered", ["tailored"]],
    ["shoes", "shoes", null, "Brown leather loafers", "loafers", "brown", "leather", "regular", "penny loafer", ["polished", "warm"]],
  ],
  dinner_relaxed_01: [
    ["outer", "top", "outer", "Light blue overshirt", "overshirt", "blue", "cotton", "relaxed", "open front, two pockets", ["relaxed", "layering"]],
    ["base", "top", "base", "Grey t-shirt", "t-shirt", "grey", "cotton", "regular", "crew neck", ["casual", "essential"]],
    ["bottom", "bottom", null, "Dark indigo jeans", "jeans", "navy", "denim", "slim", "straight leg", ["casual", "dark wash"]],
    ["shoes", "shoes", null, "White leather sneakers", "sneakers", "white", "leather", "regular", "low top", ["clean", "minimal"]],
  ],
  dinner_safest_01: [
    ["base", "top", "base", "Navy merino crew neck", "knit", "navy", "merino", "regular", "fine gauge, crew neck", ["refined", "quiet"]],
    ["bottom", "bottom", null, "Charcoal chinos", "chinos", "grey", "cotton", "slim", "tapered, turned hem", ["smart casual"]],
    ["shoes", "shoes", null, "Grey suede sneakers", "sneakers", "grey", "suede", "regular", "low top", ["smart casual", "soft"]],
  ],
  dinner_sharper_01: [
    ["outer", "top", "outer", "Charcoal tweed blazer", "blazer", "grey", "tweed", "slim", "single breasted, notch lapel", ["tailored", "texture"]],
    ["base", "top", "base", "Navy fitted knit", "knit", "navy", "merino", "slim", "fine gauge, crew neck", ["refined", "layering"]],
    ["bottom", "bottom", null, "Black tailored trousers", "trousers", "black", "wool", "slim", "straight", ["tailored", "evening"]],
    ["shoes", "shoes", null, "Black leather Chelsea boots", "chelsea-boots", "black", "leather", "regular", "elastic side", ["sharp", "evening"]],
  ],
  party_relaxed_01: [
    ["outer", "top", "outer", "Olive field jacket", "jacket", "green", "cotton", "regular", "four pocket, shirt collar", ["relaxed", "utility"]],
    ["base", "top", "base", "Grey t-shirt", "t-shirt", "grey", "cotton", "regular", "crew neck", ["casual", "essential"]],
    ["bottom", "bottom", null, "Dark indigo jeans", "jeans", "navy", "denim", "regular", "straight leg", ["casual", "dark wash"]],
    ["shoes", "shoes", null, "White sneakers", "sneakers", "white", "leather", "regular", "low top", ["casual", "clean"]],
  ],
  party_safest_01: [
    ["outer", "top", "outer", "Black zip jacket", "jacket", "black", "cotton", "regular", "short, point collar", ["clean", "evening"]],
    ["base", "top", "base", "Charcoal t-shirt", "t-shirt", "grey", "cotton", "regular", "crew neck", ["essential", "dark"]],
    ["bottom", "bottom", null, "Charcoal jeans", "jeans", "grey", "denim", "slim", "straight leg", ["casual", "dark"]],
    ["shoes", "shoes", null, "Grey suede sneakers", "sneakers", "grey", "suede", "regular", "low top", ["smart casual", "soft"]],
  ],
  party_sharper_01: [
    ["base", "top", "base", "Black fitted shirt", "shirt", "black", "cotton", "slim", "point collar", ["sharp", "evening", "monochrome"]],
    ["bottom", "bottom", null, "Black slim trousers", "trousers", "black", "wool", "slim", "slim, straight", ["tailored", "evening"]],
    ["shoes", "shoes", null, "Black leather Chelsea boots", "chelsea-boots", "black", "leather", "regular", "elastic side", ["sharp", "evening"]],
  ],
  work_relaxed_01: [
    ["base", "top", "base", "Navy knit polo", "polo", "navy", "cotton", "slim", "short sleeve, fine knit", ["smart casual", "refined"]],
    ["bottom", "bottom", null, "Grey trousers", "trousers", "grey", "wool", "slim", "tapered", ["tailored", "office"]],
    ["shoes", "shoes", null, "Dark brown leather loafers", "loafers", "brown", "leather", "regular", "penny loafer", ["polished"]],
    ["belt", "extras", null, "Brown leather belt", "belt", "brown", "leather", "regular", "slim buckle", ["finishing"], "belt"],
  ],
  work_safest_01: [
    ["base", "top", "base", "White button-down shirt", "shirt", "white", "cotton", "regular", "button-down collar", ["office", "crisp"]],
    ["bottom", "bottom", null, "Charcoal tailored trousers", "trousers", "grey", "wool", "regular", "straight", ["tailored", "office"]],
    ["shoes", "shoes", null, "Black leather lace-up shoes", "dress-shoes", "black", "leather", "regular", "derby", ["polished", "office"]],
  ],
  work_sharper_01: [
    ["outer", "top", "outer", "Charcoal blazer", "blazer", "grey", "wool", "slim", "single breasted, notch lapel", ["tailored", "office"]],
    ["base", "top", "base", "White shirt", "dress-shirt", "white", "cotton", "slim", "point collar", ["crisp", "office"]],
    ["bottom", "bottom", null, "Charcoal tailored trousers", "trousers", "grey", "wool", "slim", "straight", ["tailored", "office"]],
    ["shoes", "shoes", null, "Black leather oxfords", "dress-shoes", "black", "leather", "regular", "cap toe oxford", ["formal", "polished"]],
  ],
  wedding_relaxed_01: [
    ["outer", "top", "outer", "Light grey blazer", "blazer", "grey", "wool", "regular", "single breasted, soft shoulder", ["tailored", "daytime"]],
    ["base", "top", "base", "White open-collar shirt", "shirt", "white", "cotton", "regular", "open collar", ["relaxed", "crisp"]],
    ["bottom", "bottom", null, "Navy tailored trousers", "trousers", "navy", "wool", "slim", "tapered", ["tailored"]],
    ["shoes", "shoes", null, "Tan leather loafers", "loafers", "brown", "leather", "regular", "penny loafer", ["warm", "daytime"]],
  ],
  wedding_safest_01: [
    ["outer", "top", "outer", "Navy suit jacket", "suit-jacket", "navy", "wool", "slim", "single breasted, notch lapel", ["formal", "suit"]],
    ["base", "top", "base", "White dress shirt", "dress-shirt", "white", "cotton", "slim", "point collar", ["formal", "crisp"]],
    ["bottom", "bottom", null, "Navy suit trousers", "suit-trousers", "navy", "wool", "slim", "straight", ["formal", "suit"]],
    ["shoes", "shoes", null, "Black leather oxfords", "dress-shoes", "black", "leather", "regular", "cap toe oxford", ["formal", "polished"]],
  ],
  wedding_sharper_01: [
    ["outer", "top", "outer", "Charcoal suit jacket", "suit-jacket", "grey", "wool", "slim", "single breasted, notch lapel", ["formal", "suit"]],
    ["base", "top", "base", "White dress shirt", "dress-shirt", "white", "cotton", "slim", "point collar", ["formal", "crisp"]],
    ["bottom", "bottom", null, "Charcoal suit trousers", "suit-trousers", "grey", "wool", "slim", "straight", ["formal", "suit"]],
    ["shoes", "shoes", null, "Black leather shoes", "dress-shoes", "black", "leather", "regular", "plain toe", ["formal", "polished"]],
    ["tie", "extras", null, "Navy silk tie", "tie", "navy", "silk", "regular", "classic width", ["formal", "finishing"], null],
  ],
};

const ATTRIBUTION = "Praxis look library photograph";
const RIGHTS = "Praxis styling image, shown on Praxis only; not a product photograph";

function toGarment(outfitId: string, row: Row): CatalogueGarment {
  const [part, slot, layer, name, subcategory, colour, material, fit, silhouette, attrs, region] = row;
  const src = `/images/${outfitId}.jpg`;
  const area = region === null ? null : REGION[region ?? (slot === "extras" ? "neck" : (slot as "top" | "bottom" | "shoes"))];
  return {
    id: `ref_${outfitId}_${part}`,
    source: "reference",
    slot,
    ...(layer ? { layer } : {}),
    subcategory,
    name,
    colour,
    material,
    fit,
    silhouette,
    formality: FORMALITY[subcategory] ?? 3,
    seasons: seasonsOf(material),
    styleAttributes: attrs,
    ...(area ? { imageUrl: src, image: { src, region: area } } : {}),
    availability: "not_for_sale",
    attribution: ATTRIBUTION,
    usageRights: RIGHTS,
  };
}

/** Every reference piece, by id. */
export const REFERENCE_CATALOGUE: ReadonlyMap<string, CatalogueGarment> = new Map(
  Object.entries(ROWS).flatMap(([outfitId, rows]) => rows.map((r) => toGarment(outfitId, r))).map((g) => [g.id, g]),
);

/** The reference pieces of one library outfit, in the order they are worn (outer, base, bottom, shoes, extras). */
export function referenceOutfit(outfitId: string): CatalogueGarment[] {
  return (ROWS[outfitId] ?? []).map((r) => REFERENCE_CATALOGUE.get(`ref_${outfitId}_${r[0]}`)!);
}

/** The reference pieces that could fill a part: same slot and layer, the same or a close subcategory. */
export function referenceFor(want: { slot: Slot; layer?: Layer; subcategory: string }): CatalogueGarment[] {
  return [...REFERENCE_CATALOGUE.values()].filter((g) => g.slot === want.slot && g.layer === want.layer && g.subcategory === want.subcategory);
}
