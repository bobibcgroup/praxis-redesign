/** Derives the three looks (stable order) and the hero for the current answers. Pure. */
import { OCCASIONS, STAND_IN_PORTRAIT, getLooks, withOwnedItem, type Look, type VibeId } from "../../shared/catalog";
import type { Answers, OwnedItem, Slot } from "./journeyContext";

export const SAMPLE_ITEMS: Record<Slot, string> = {
  top: "Your navy overshirt",
  bottom: "Your charcoal trousers",
  shoes: "Your black loafers",
  extras: "Your steel watch",
};

export interface ResolvedLooks {
  /** Safe, sharper, relaxed, always in this order so the thumbnails never move. */
  looks: Look[];
  hero: Look;
}

export function defaultHeroId(looks: Look[], vibe: VibeId | null): string | null {
  const wanted = vibe === "SHARP" ? "SHARPER" : vibe === "RELAXED" ? "RELAXED" : "SAFEST";
  return looks.find((l) => l.tier === wanted)?.id ?? looks[0]?.id ?? null;
}

export function resolveLooks(answers: Answers, ownedItem: OwnedItem | null): ResolvedLooks | null {
  if (!answers.occasion) return null;
  const base = getLooks(answers.occasion);
  const looks = answers.item && ownedItem ? base.map((l) => withOwnedItem(l, ownedItem.slot, ownedItem.name)) : base;
  if (looks.length === 0) return null;
  const hero = looks.find((l) => l.id === answers.hero) ?? looks.find((l) => l.id === defaultHeroId(looks, answers.vibe)) ?? looks[0];
  return { looks, hero };
}

export function occasionLabel(id: Answers["occasion"]): string {
  return OCCASIONS.find((o) => o.id === id)?.label ?? "";
}

/** The image the canvas shows for the answers so far: mood, then the chosen tier. */
export function canvasImage(answers: Answers, resolved: ResolvedLooks | null): string | null {
  if (!answers.occasion) return null;
  if (answers.hero && resolved) return resolved.hero.image;
  if (answers.vibe && resolved) return resolved.hero.image;
  return OCCASIONS.find((o) => o.id === answers.occasion)?.image ?? null;
}

export function portraitFor(face: Answers["face"], faceImage: string | null, dnaPortrait?: string): string | null {
  if (face === "own" && faceImage) return faceImage;
  if (face) return STAND_IN_PORTRAIT;
  return dnaPortrait ?? null;
}

/** The shared stand-in is a full-length photo; tighten it to the face when it stands for "you". */
export function faceCropStyle(src: string | null): { transform: string; transformOrigin: string } | undefined {
  return src === STAND_IN_PORTRAIT ? { transform: "scale(2)", transformOrigin: "50% 4%" } : undefined;
}

export function money(n: number): string {
  return n === 0 ? "Owned" : `$${n.toLocaleString("en-US")}`;
}

export const ROLE_LABEL: Record<Look["role"], string> = { hero: "Safe", sharper: "Sharper", relaxed: "Relaxed" };
export const SLOT_LABEL: Record<Slot, string> = { top: "Top", bottom: "Bottom", shoes: "Shoes", extras: "Extras" };
