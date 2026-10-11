/**
 * Moving what a guest saved onto their account when they sign in. Pure functions, so the rules are
 * testable on their own: a guest's looks and feedback take the account's id, the same look saved
 * twice is kept once (the newest), and anything that belongs to another account on this device is
 * left alone. The caller writes the result in one go and keeps the old state if that fails.
 */
import type { OutfitFeedback } from "./contracts";

export interface Owner {
  anonymousSessionId: string;
  userId?: string;
}

export interface OwnedLook {
  id: string;
  savedAt: string;
  owner?: Owner;
  /** Identifies the look for de-duplication: the outfit, the brief it answered and any owned piece. */
  dedupeKey: string;
}

/** Whether a saved look shows for this person: their account's, or a guest's on this device. */
export function visibleTo(look: { owner?: Owner }, userId: string | undefined): boolean {
  const owner = look.owner?.userId;
  return owner === undefined || owner === userId;
}

export interface LookMigration<T> {
  looks: T[];
  /** Guest looks now on the account. */
  moved: number;
  /** Copies dropped because the account already had the same look. */
  duplicates: number;
}

export function migrateLooks<T extends OwnedLook>(looks: readonly T[], userId: string, anonymousSessionId: string): LookMigration<T> {
  let moved = 0;
  const claimed = looks.map((l) => {
    if (l.owner?.userId) return l;
    moved += 1;
    return { ...l, owner: { anonymousSessionId: l.owner?.anonymousSessionId ?? anonymousSessionId, userId } };
  });
  // Newest first, so the first of each key is the one kept.
  const ordered = [...claimed].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  const seen = new Set<string>();
  const keep = new Set<string>();
  let duplicates = 0;
  for (const l of ordered) {
    if (l.owner?.userId !== userId) {
      keep.add(l.id);
      continue;
    }
    if (seen.has(l.dedupeKey)) {
      duplicates += 1;
      continue;
    }
    seen.add(l.dedupeKey);
    keep.add(l.id);
  }
  return { looks: ordered.filter((l) => keep.has(l.id)), moved, duplicates };
}

export interface FeedbackMigration {
  records: OutfitFeedback[];
  moved: number;
}

/** Gives this browser's guest feedback the account's id, dropping exact repeats. */
export function migrateFeedback(records: readonly OutfitFeedback[], userId: string, anonymousSessionId: string): FeedbackMigration {
  let moved = 0;
  const seen = new Set<string>();
  const out: OutfitFeedback[] = [];
  for (const r of records) {
    const mine = !r.userId && r.anonymousSessionId === anonymousSessionId;
    const next = mine ? { ...r, userId } : r;
    if (mine) moved += 1;
    const key = [next.userId ?? next.anonymousSessionId, next.recommendationId, next.outfitId, next.feedback, next.reason ?? "", next.garmentId ?? ""].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
  }
  return { records: out, moved };
}
