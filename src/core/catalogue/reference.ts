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
import type { Layer, Slot } from "../contracts";
import { seasonsOf, type Formality } from "../../shared/ontology.mjs";
import { REFERENCE_FORMALITY, REFERENCE_REGION, REFERENCE_ROWS } from "../../shared/references.mjs";
import type { CatalogueGarment, ColourFamily, Fit } from "./garment";

type Row = [part: string, slot: Slot, layer: Layer | null, name: string, subcategory: string, colour: ColourFamily, material: string, fit: Fit, silhouette: string, attrs: string[], region?: keyof typeof REGION | null];

const REGION = REFERENCE_REGION;
const FORMALITY: Record<string, Formality> = REFERENCE_FORMALITY;
const ROWS = REFERENCE_ROWS as unknown as Record<string, Row[]>;

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
