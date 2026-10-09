/**
 * The look in the left column: eyebrow, title, the stylist's note, then the pieces, each with a box
 * the client can untick, and the total of what is chosen. On a phone the list scrolls inside the column.
 */
import type { ReactNode } from "react";
import type { Look } from "../../shared/catalog";
import { money } from "../lib/looks";
import type { PieceSelection } from "../lib/selection";
import { PieceRow } from "./PieceRow";

interface Props {
  look: Look;
  eyebrow: string;
  /** Hide the pieces (the completion state takes their place). */
  compact?: boolean;
  selection: PieceSelection;
  /** Follows the pieces and total: the offer to make the look personal. */
  personal?: ReactNode;
  /** Closes the column, after the total. */
  end?: ReactNode;
}

export function LookDetails({ look, eyebrow, compact = false, selection, personal, end }: Props) {
  const count = selection.chosen.length;
  return (
    <div className="flex min-h-0 flex-col">
      <p className="a-label mb-3 text-[var(--muted)]">{eyebrow}</p>
      <h1 className="a-display">{look.title}</h1>
      <p className={`a-note mt-4 max-w-[34ch] ${compact ? "hidden lg:block" : ""}`}>{look.why}</p>

      {!compact ? (
        <div className="mt-8" role="list" aria-label="Pieces">
          {look.pieces.map((p) => (
            <PieceRow key={p.id} piece={p} chosen={selection.isChosen(p.id)} onToggle={selection.toggle} />
          ))}
          <div className="a-total">
            <span className="a-label">
              Total, {count} {count === 1 ? "piece" : "pieces"}
            </span>
            <span className="a-mono">{money(selection.total)}</span>
          </div>
        </div>
      ) : null}
      {personal}
      {end}
    </div>
  );
}
