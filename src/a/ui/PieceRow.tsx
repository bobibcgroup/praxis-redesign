/** One piece with a box to keep or drop it: house above, name in the serif, price on the right edge. */
import { Check } from "lucide-react";
import type { Piece } from "../../shared/catalog";
import { money, SLOT_LABEL } from "../lib/looks";

interface Props {
  piece: Piece;
  chosen: boolean;
  onToggle?: (id: string) => void;
  /** What sits in small capitals above the name. */
  over?: "house" | "slot";
}

export function PieceRow({ piece, chosen, onToggle, over = "house" }: Props) {
  const label = over === "house" ? piece.vendor : SLOT_LABEL[piece.slot];

  if (piece.owned || !onToggle) {
    return (
      <div className="a-piece" role="listitem">
        <span>
          <span className="house a-label">{label}</span>
          <span className="name">{piece.name}</span>
        </span>
        <span className="a-mono text-[var(--muted)]">{piece.owned ? "Yours" : money(piece.price)}</span>
      </div>
    );
  }

  return (
    <label className="a-piece a-pick" data-chosen={chosen ? "" : undefined} role="listitem">
      <input type="checkbox" className="sr-only" checked={chosen} onChange={() => onToggle(piece.id)} aria-label={`${piece.name}, ${money(piece.price)}`} />
      <span className="a-box" aria-hidden="true">
        {chosen ? <Check size={14} strokeWidth={2} /> : null}
      </span>
      <span>
        <span className="house a-label">{label}</span>
        <span className="name">{piece.name}</span>
      </span>
      <span className="a-mono price">{money(piece.price)}</span>
    </label>
  );
}
