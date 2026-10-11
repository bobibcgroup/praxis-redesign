/**
 * Saved looks and the saved Style DNA, kept in this browser. Saving needs no account: each look is
 * owned by the anonymous id, and signing in moves the guest's looks onto the account without
 * duplicates (src/core/account.ts). A signed-in person sees their account's looks plus any guest
 * looks on this device; looks of another account stay hidden.
 */
import { useCallback, useMemo, useState } from "react";
import type { Look, ToneResult, FitId, LifestyleId } from "./catalog";
import { migrateLooks, visibleTo, type Owner } from "../core/account";

export interface SavedLook {
  id: string;
  savedAt: string;
  look: Look;
  occasionLabel: string;
  /** Earlier builds saved a stand-in try-on picture here; it is no longer saved or shown. */
  tryOnImage?: string;
  recommendationId?: string;
  requestId?: string;
  inputKey?: string;
  owner?: Owner;
  /** The same look for the same brief has the same key; used to keep one copy at sign-in. */
  dedupeKey: string;
}

export interface SavedDna {
  createdAt: string;
  tones: ToneResult;
  fit: FitId | null;
  lifestyle: LifestyleId | null;
  presetIds: string[];
  portrait?: string;
}

interface LabState {
  looks: SavedLook[];
  dna: SavedDna | null;
}

const EMPTY: LabState = { looks: [], dna: null };

function keyFor(concept: string): string {
  return `praxis_lab_${concept}`;
}

function legacyKey(look: Look, occasionLabel: string): string {
  const owned = look.pieces
    .filter((p) => p.owned)
    .map((p) => `${p.slot}:${p.name}`)
    .join("+");
  return `${look.id}|${occasionLabel}|${owned}`;
}

/** Brings looks saved by earlier builds up to date: role names, keys, and no stand-in try-on picture. */
function normalise(s: SavedLook): SavedLook {
  const role = (s.look.role as string) === "hero" ? "classic" : s.look.role;
  const { tryOnImage: _dropped, ...rest } = s;
  void _dropped;
  return { ...rest, look: { ...s.look, role }, dedupeKey: s.dedupeKey ?? legacyKey(s.look, s.occasionLabel) };
}

function read(concept: string): LabState {
  try {
    const raw = localStorage.getItem(keyFor(concept));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<LabState>;
    return { looks: (parsed.looks ?? []).map(normalise), dna: parsed.dna ?? null };
  } catch {
    return EMPTY;
  }
}

function write(concept: string, state: LabState): boolean {
  try {
    localStorage.setItem(keyFor(concept), JSON.stringify(state));
    return true;
  } catch {
    // Storage unavailable; the prototype still works for the session.
    return false;
  }
}

export interface SaveMeta {
  owner: Owner;
  recommendationId?: string;
  requestId?: string;
  inputKey?: string;
}

export function useLabStore(concept: string, userId?: string) {
  // Read on the first render, so nothing (a styling request, the gate's steps) ever sees an empty store
  // before the saved Style DNA arrives.
  const [state, setState] = useState<LabState>(() => read(concept));

  const update = useCallback(
    (fn: (prev: LabState) => LabState) => {
      setState((prev) => {
        const next = fn(prev);
        write(concept, next);
        return next;
      });
    },
    [concept],
  );

  const saveLook = useCallback(
    (look: Look, occasionLabel: string, meta: SaveMeta) => {
      const entry: SavedLook = {
        id: `${look.id}_${Date.now()}`,
        savedAt: new Date().toISOString(),
        look,
        occasionLabel,
        recommendationId: meta.recommendationId,
        requestId: meta.requestId,
        inputKey: meta.inputKey,
        owner: meta.owner,
        dedupeKey: meta.inputKey ? `${look.id}|${meta.inputKey}` : legacyKey(look, occasionLabel),
      };
      update((prev) => ({ ...prev, looks: [entry, ...prev.looks] }));
      return entry;
    },
    [update],
  );

  const removeLook = useCallback(
    (id: string) => update((prev) => ({ ...prev, looks: prev.looks.filter((l) => l.id !== id) })),
    [update],
  );

  /** Puts a removed look back where it was, newest first. */
  const restoreLook = useCallback(
    (entry: SavedLook) =>
      update((prev) => ({
        ...prev,
        looks: [...prev.looks.filter((l) => l.id !== entry.id), entry].sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
      })),
    [update],
  );

  /**
   * Moves this device's guest looks onto the account in one write. If the write fails, nothing
   * changes and the guest keeps every look.
   */
  const migrateToAccount = useCallback(
    (accountId: string, anonymousSessionId: string) => {
      const current = read(concept);
      const result = migrateLooks(current.looks, accountId, anonymousSessionId);
      const next = { ...current, looks: result.looks };
      const ok = write(concept, next);
      if (ok) setState(next);
      return { ok, moved: result.moved, duplicates: result.duplicates };
    },
    [concept],
  );

  const saveDna = useCallback((dna: SavedDna) => update((prev) => ({ ...prev, dna })), [update]);

  const clearDna = useCallback(() => update((prev) => ({ ...prev, dna: null })), [update]);

  const reset = useCallback(() => update(() => EMPTY), [update]);

  const looks = useMemo(() => state.looks.filter((l) => visibleTo(l, userId)), [state.looks, userId]);

  return { looks, dna: state.dna, saveLook, removeLook, restoreLook, migrateToAccount, saveDna, clearDna, reset };
}
