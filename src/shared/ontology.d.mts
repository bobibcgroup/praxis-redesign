/** Types for ontology.mjs. */
export type OntologySlot = "top" | "bottom" | "shoes" | "extras";
export type OntologyLayer = "outer" | "base";
/** 1 very casual, 2 casual, 3 smart casual, 4 smart, 5 formal. */
export type Formality = 1 | 2 | 3 | 4 | 5;
export type ColourFamily = "white" | "black" | "grey" | "navy" | "blue" | "green" | "beige" | "brown" | "burgundy" | "orange" | "red" | "pink" | "yellow" | "purple";
export type Fit = "slim" | "regular" | "relaxed";
export type Season = "spring" | "summer" | "autumn" | "winter";

export interface Subcategory {
  id: string;
  slot: OntologySlot;
  layer?: OntologyLayer;
  formality: Formality;
  words: RegExp;
}
export const SUBCATEGORIES: readonly Subcategory[];
export const STANDS_IN_FOR: Record<string, readonly string[]>;
export const NEUTRALS: readonly ColourFamily[];
export function classify(text: string, type?: string): { subcategory: string; slot: OntologySlot; layer?: OntologyLayer; formality: Formality } | null;
export function colourOf(text: string): ColourFamily | undefined;
export function materialOf(text: string): string | undefined;
export function fitOf(text: string): Fit | undefined;
export function seasonsOf(material: string | undefined): Season[];
