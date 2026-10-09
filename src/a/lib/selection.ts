import { useCallback, useEffect, useMemo, useState } from "react";
import type { Look, Piece } from "../../shared/catalog";

/** Which pieces of a look the client is taking. Every piece starts chosen; owned pieces are never bought. */
export interface PieceSelection {
  isChosen: (id: string) => boolean;
  toggle: (id: string) => void;
  chosen: Piece[];
  total: number;
}

export function usePieceSelection(look: Look | null): PieceSelection {
  const [dropped, setDropped] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => setDropped(new Set()), [look?.id]);

  const toggle = useCallback((id: string) => {
    setDropped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return useMemo(() => {
    const chosen = (look?.pieces ?? []).filter((p) => !p.owned && !dropped.has(p.id));
    return {
      isChosen: (id: string) => !dropped.has(id),
      toggle,
      chosen,
      total: chosen.reduce((sum, p) => sum + p.price, 0),
    };
  }, [look, dropped, toggle]);
}
