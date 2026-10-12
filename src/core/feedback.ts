/**
 * Feedback on looks ("More like this", "Not for me" and why) and the preference store built from it.
 * Each record is tied to the customer (anonymous or signed in), the request, the recommendation, the
 * look, the piece when one was named, and the adapter that made the look. The preference snapshot
 * goes out with every styling request so a real engine can use it; the mock adapter does not, and
 * nothing in the app claims that it learns.
 */
import type { FeedbackKind, FeedbackReason, OutfitFeedback, PreferenceSnapshot } from "./contracts";
import { local, newId, readJson, writeJson } from "./ids";

const KEY = "praxis_feedback";
const LIMIT = 300;

export const FEEDBACK_REASONS: readonly { id: FeedbackReason; label: string }[] = [
  { id: "too_formal", label: "Too formal" },
  { id: "too_casual", label: "Too casual" },
  { id: "wrong_colours", label: "Wrong colours" },
  { id: "wrong_fit", label: "Not my fit" },
  { id: "too_expensive", label: "Too expensive" },
];

type Listener = () => void;

export interface FeedbackInput {
  anonymousSessionId: string;
  userId?: string;
  recommendationId: string;
  requestId: string;
  outfitId: string;
  garmentId?: string;
  feedback: FeedbackKind;
  reason?: FeedbackReason;
  adapter: { id: string; version: string };
}

export interface FeedbackStore {
  all(): OutfitFeedback[];
  record(input: FeedbackInput, now?: Date): OutfitFeedback;
  /** The latest word on one look in one recommendation, which is what the screen shows. */
  latestFor(recommendationId: string, outfitId: string, owner?: FeedbackOwner): OutfitFeedback | null;
  /** Takes back the latest word on a look ("Undo"). */
  withdraw(eventId: string): void;
  replaceAll(records: OutfitFeedback[]): boolean;
  subscribe(listener: Listener): () => void;
}

export interface FeedbackOwner {
  anonymousSessionId: string;
  userId?: string;
}

/** Signed in: this account's words only. A guest: this browser's words that belong to no account. */
function ownedBy(r: OutfitFeedback, owner: FeedbackOwner): boolean {
  return owner.userId ? r.userId === owner.userId : !r.userId && r.anonymousSessionId === owner.anonymousSessionId;
}

export function createFeedbackStore(storage: () => Storage | undefined = local): FeedbackStore {
  let memory: OutfitFeedback[] | null = null;
  const listeners = new Set<Listener>();
  const read = () => memory ?? (memory = readJson<OutfitFeedback[]>(storage(), KEY) ?? []);
  const write = (records: OutfitFeedback[]) => {
    const ok = writeJson(storage(), KEY, records);
    memory = records;
    listeners.forEach((l) => l());
    return ok;
  };
  return {
    all: () => read(),
    record(input, now = new Date()) {
      const entry: OutfitFeedback = { eventId: newId("fb"), ...input, createdAt: now.toISOString() };
      if (!entry.userId) delete entry.userId;
      if (!entry.garmentId) delete entry.garmentId;
      if (!entry.reason) delete entry.reason;
      write([entry, ...read()].slice(0, LIMIT));
      return entry;
    },
    latestFor(recommendationId, outfitId, owner) {
      return read().find((f) => f.recommendationId === recommendationId && f.outfitId === outfitId && (!owner || ownedBy(f, owner))) ?? null;
    },
    withdraw(eventId) {
      write(read().filter((f) => f.eventId !== eventId));
    },
    replaceAll: (records) => write(records),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const feedbackStore = createFeedbackStore();

/**
 * What the feedback adds up to, for the engine. The newest word on each look wins, so a look first
 * rejected and later liked counts as liked.
 */
export function preferenceSnapshot(records: readonly OutfitFeedback[], owner: FeedbackOwner): PreferenceSnapshot {
  const mine = records.filter((r) => ownedBy(r, owner));
  const latest = new Map<string, OutfitFeedback>();
  // Records are stored newest first.
  for (const r of mine) if (!latest.has(r.outfitId)) latest.set(r.outfitId, r);
  const snapshot: PreferenceSnapshot = { likedOutfitIds: [], rejectedOutfitIds: [], reasonCounts: {}, dislikedGarmentIds: [] };
  for (const r of latest.values()) {
    if (r.feedback === "more_like_this") snapshot.likedOutfitIds.push(r.outfitId);
    else snapshot.rejectedOutfitIds.push(r.outfitId);
  }
  for (const r of mine) {
    if (r.feedback !== "not_for_me") continue;
    if (r.reason) snapshot.reasonCounts[r.reason] = (snapshot.reasonCounts[r.reason] ?? 0) + 1;
    if (r.garmentId && !snapshot.dislikedGarmentIds.includes(r.garmentId)) snapshot.dislikedGarmentIds.push(r.garmentId);
  }
  return snapshot;
}
