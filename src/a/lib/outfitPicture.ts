/**
 * The picture of a composed look on the Praxis model, made for exactly the pieces listed beside it.
 *
 * A look composed from a store and my references arrives with its visualization "pending" (see
 * src/core/catalogue/hybrid.ts): its photo is still the library photograph, which shows other pieces.
 * When that look is on screen, this asks the server's image provider for its picture, built from the
 * look's own garments (visualizationSpec), and follows it: working, ready, or failed with a reason.
 * Only the look being shown is made, so switching looks never pays for pictures nobody saw; a picture
 * already made for the same composition comes back from the cache.
 *
 * With no image provider on the server, the look keeps its library photograph and says plainly that it
 * is a reference photo, not these pieces.
 */
import { useCallback, useEffect, useState } from "react";
import type { OutfitRecommendation, VisualizationCheck } from "../../core/contracts";
import { anonymousId } from "../../core/identity";
import { visualizationProviderInUse, visualizationSpec, visualize, type OutfitVisualizationProvider, type VisualizationOutcome } from "../../core/catalogue/visualize";

export type OutfitPicture =
  /** Not a composed look: its photo is its own. */
  | { state: "none" }
  /** No image provider: the library photograph stands in, labelled as a reference. */
  | { state: "reference" }
  | { state: "working"; key: string }
  | { state: "ready"; key: string; url: string; checks?: VisualizationCheck[] }
  | { state: "failed"; key: string; message: string };

type Settled = Extract<OutfitPicture, { state: "ready" | "failed" | "reference" }>;

/* Shared across screens and remounts: what each composition came to, and what is on its way. */
const settled = new Map<string, Settled>();
const pending = new Map<string, Promise<Settled>>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

/** Forget every picture's state (tests, sign out). */
export function resetOutfitPictures(): void {
  settled.clear();
  pending.clear();
  notify();
}

function settle(out: VisualizationOutcome, key: string): Settled {
  if (out.status === "ready" && out.imageUrl) return { state: "ready", key, url: out.imageUrl, checks: out.checks };
  if (out.status === "mock") return { state: "reference" };
  return { state: "failed", key, message: messageFor(out) };
}

/** What the customer reads when a picture couldn't be made: the reason in plain words, never the provider's. */
function messageFor(out: VisualizationOutcome): string {
  const e = (out.error ?? "").toLowerCase();
  if (/budget|daily|too many|ceiling|rate/.test(e)) return "I’ve made as many pictures as I can for now.";
  if (/switched off|billing|not connected|disabled/.test(e)) return "Pictures of these pieces aren’t switched on yet.";
  if (/check|didn’t pass|did not pass/.test(e)) return "The picture didn’t show these pieces faithfully, so I won’t show it.";
  return "I couldn’t make the picture of these pieces this time.";
}

let providerFor: Promise<OutfitVisualizationProvider> | null = null;
function provider(userId?: string): Promise<OutfitVisualizationProvider> {
  if (!providerFor) providerFor = visualizationProviderInUse({ anonymousSessionId: anonymousId(), userId });
  return providerFor;
}

async function make(outfit: OutfitRecommendation, userId?: string): Promise<{ key: string; done: Promise<Settled> } | null> {
  const p = await provider(userId);
  if (p.id === "mock-visualization") return null;
  const spec = visualizationSpec(outfit, p);
  const key = spec.cacheKey;
  if (!settled.has(key) && !pending.has(key)) {
    const job = visualize(spec, p)
      .then((out) => settle(out, key))
      .catch((): Settled => ({ state: "failed", key, message: "I couldn’t make the picture of these pieces this time." }))
      .then((s) => {
        settled.set(key, s);
        pending.delete(key);
        notify();
        return s;
      });
    pending.set(key, job);
  }
  return { key, done: pending.get(key) ?? Promise.resolve(settled.get(key)!) };
}

/** The picture for the look on screen, and a way to ask again after a failure. */
export function useOutfitPicture(outfit: OutfitRecommendation | null, userId?: string): OutfitPicture & { retry: () => void } {
  const wanted = outfit?.visualization.status === "pending";
  const [key, setKey] = useState<string | null>(null);
  const [none, setNone] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    const on = () => tick((n) => n + 1);
    listeners.add(on);
    return () => void listeners.delete(on);
  }, []);

  const run = useCallback(() => {
    if (!outfit || !wanted) return;
    let live = true;
    setKey(null);
    setNone(false);
    make(outfit, userId).then((m) => {
      if (!live) return;
      if (!m) setNone(true);
      else setKey(m.key);
    });
    return () => {
      live = false;
    };
  }, [outfit, wanted, userId]);

  useEffect(() => run(), [run]);

  const retry = useCallback(() => {
    if (key && settled.get(key)?.state === "failed") {
      settled.delete(key);
      notify();
    }
    run();
  }, [key, run]);

  if (!outfit || !wanted) return { state: "none", retry };
  if (none) return { state: "reference", retry };
  if (!key) return { state: "working", key: "", retry };
  const s = settled.get(key);
  return s ? { ...s, retry } : { state: "working", key, retry };
}
