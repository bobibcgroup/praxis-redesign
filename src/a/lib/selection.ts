import { useCallback, useEffect, useMemo, useState } from "react";
import type { Look, Piece } from "../../shared/catalog";

/**
 * Which pieces of a look the client is taking, and in which size. Every piece starts chosen except
 * one the retailer reports sold out; owned pieces are never bought.
 */
export interface PieceSelection {
  isChosen: (id: string) => boolean;
  toggle: (id: string) => void;
  chosen: Piece[];
  total: number;
  sizeOf: (id: string) => string | undefined;
  setSize: (id: string, size: string) => void;
}

export function soldOut(p: Piece): boolean {
  return p.availability === "out_of_stock";
}

export function usePieceSelection(look: Look | null): PieceSelection {
  const [dropped, setDropped] = useState<ReadonlySet<string>>(new Set());
  const [sizes, setSizes] = useState<Readonly<Record<string, string>>>({});

  useEffect(() => {
    setDropped(new Set());
    setSizes({});
  }, [look?.id]);

  const toggle = useCallback((id: string) => {
    setDropped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setSize = useCallback((id: string, size: string) => setSizes((prev) => ({ ...prev, [id]: size })), []);

  return useMemo(() => {
    const unavailable = new Set((look?.pieces ?? []).filter(soldOut).map((p) => p.id));
    const isChosen = (id: string) => !dropped.has(id) && !unavailable.has(id);
    const chosen = (look?.pieces ?? []).filter((p) => !p.owned && isChosen(p.id));
    return {
      isChosen,
      toggle,
      chosen,
      total: chosen.reduce((sum, p) => sum + p.price, 0),
      sizeOf: (id: string) => sizes[id],
      setSize,
    };
  }, [look, dropped, sizes, toggle, setSize]);
}
