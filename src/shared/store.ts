/**
 * Tiny namespaced persistence for the lab so each concept can show
 * returning-user states (saved looks, a saved DNA) without touching
 * production storage keys or Supabase.
 */
import { useCallback, useEffect, useState } from "react";
import type { Look, ToneResult, FitId, LifestyleId } from "./catalog";

export interface SavedLook {
  id: string;
  savedAt: string;
  look: Look;
  occasionLabel: string;
  tryOnImage?: string;
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

function read(concept: string): LabState {
  try {
    const raw = localStorage.getItem(keyFor(concept));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<LabState>;
    return { looks: parsed.looks ?? [], dna: parsed.dna ?? null };
  } catch {
    return EMPTY;
  }
}

function write(concept: string, state: LabState): void {
  try {
    localStorage.setItem(keyFor(concept), JSON.stringify(state));
  } catch {
    // Storage unavailable; the prototype still works for the session.
  }
}

export function useLabStore(concept: string) {
  const [state, setState] = useState<LabState>(EMPTY);

  useEffect(() => {
    setState(read(concept));
  }, [concept]);

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
    (look: Look, occasionLabel: string, tryOnImage?: string) => {
      const entry: SavedLook = {
        id: `${look.id}_${Date.now()}`,
        savedAt: new Date().toISOString(),
        look,
        occasionLabel,
        tryOnImage,
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

  const saveDna = useCallback((dna: SavedDna) => update((prev) => ({ ...prev, dna })), [update]);

  const clearDna = useCallback(() => update((prev) => ({ ...prev, dna: null })), [update]);

  const reset = useCallback(() => update(() => EMPTY), [update]);

  return { ...state, saveLook, removeLook, restoreLook, saveDna, clearDna, reset };
}
