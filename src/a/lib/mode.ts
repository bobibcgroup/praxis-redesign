/**
 * Light or dark. Light by default; only a saved preference or an explicit
 * ?mode=dark gives dark. Read synchronously on first render so nothing flashes.
 */
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

export type ModeId = "light" | "dark";

const STORAGE_KEY = "praxis_lab_a_mode";

function isMode(v: string | null): v is ModeId {
  return v === "light" || v === "dark";
}

function readStored(): ModeId | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isMode(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function useMode(): { mode: ModeId; setMode: (m: ModeId) => void } {
  const [params, setParams] = useSearchParams();
  const [mode, setModeState] = useState<ModeId>(() => {
    const fromUrl = params.get("mode");
    return isMode(fromUrl) ? fromUrl : readStored() ?? "light";
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Storage unavailable; the URL still carries the choice.
    }
    if (params.get("mode") !== mode) {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("mode", mode);
          return next;
        },
        { replace: true },
      );
    }
  }, [mode, params, setParams]);

  const setMode = useCallback((m: ModeId) => setModeState(m), []);
  return { mode, setMode };
}
