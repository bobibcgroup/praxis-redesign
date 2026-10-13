import type { Formality } from "./ontology.mjs";
type Slot = "top" | "bottom" | "shoes" | "extras";
type Region = { x: number; y: number; w: number; h: number };
export type ReferenceRow = [part: string, slot: Slot, layer: "outer" | "base" | null, name: string, subcategory: string, colour: string, material: string, fit: string, silhouette: string, attrs: string[], region?: "top" | "bottom" | "shoes" | "belt" | "neck" | null];
export const REFERENCE_REGION: Record<"top" | "bottom" | "shoes" | "belt" | "neck", Region>;
export const REFERENCE_FORMALITY: Record<string, Formality>;
export const REFERENCE_ROWS: Record<string, ReferenceRow[]>;
export interface ReferencePiece { id: string; outfitId: string; part: string; slot: Slot; layer: "outer" | "base" | null; name: string; subcategory: string; colour: string; material: string; fit: string; silhouette: string; attrs: string[]; formality: Formality; src: string; region: Region | null }
export function referencePiece(id: string): ReferencePiece | null;
