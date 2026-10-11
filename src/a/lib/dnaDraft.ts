/**
 * The Style DNA being built or changed, before it is saved. Kept in this tab only, so a reload keeps
 * the customer's corrections and closing the tab drops them. It never holds the photo.
 */
import { useCallback, useState } from "react";
import { isProfile, type StyleProfile } from "../../core/styleProfile";
import { readSession, writeSession } from "./journeyContext";

export const DRAFT_KEY = "praxis_dna_draft";

export function readDraft(): StyleProfile | null {
  const raw = readSession<unknown>(DRAFT_KEY);
  return isProfile(raw) ? raw : null;
}

export function useDnaDraft(): [StyleProfile | null, (next: StyleProfile | null) => void] {
  const [draft, setDraftState] = useState<StyleProfile | null>(readDraft);
  const setDraft = useCallback((next: StyleProfile | null) => {
    writeSession(DRAFT_KEY, next);
    setDraftState(next);
  }, []);
  return [draft, setDraft];
}
