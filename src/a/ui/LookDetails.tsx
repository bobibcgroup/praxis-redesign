/**
 * The look in the left column: eyebrow, title, the one-line why, pieces on
 * the baseline grid with tabular prices on one right edge, the total under a
 * rule. On mobile the pieces collapse to one line that opens the pieces sheet.
 */
import type { Look } from "../../shared/catalog";
import { money } from "../lib/looks";

interface Props {
  look: Look;
  eyebrow: string;
  /** Hide the pieces (the completion state takes their place). */
  compact?: boolean;
  onOpenPieces: () => void;
}

export function LookDetails({ look, eyebrow, compact = false, onOpenPieces }: Props) {
  const vendors = new Set(look.pieces.filter((p) => !p.owned).map((p) => p.vendor)).size;
  return (
    <div className="flex min-h-0 flex-col">
      <p className="mb-2 text-[13px] leading-5 text-[var(--muted)]">{eyebrow}</p>
      <h1 className="a-display">{look.title}</h1>
      <p className={`mt-4 max-w-[40ch] leading-6 ${compact ? "hidden lg:block" : ""}`}>{look.why}</p>

      {!compact ? (
        <>
          <div className="mt-4 hidden lg:block" role="list" aria-label="Pieces">
            {look.pieces.map((p) => (
              <div key={p.id} className="a-row" role="listitem">
                <span>
                  {p.name}
                  <span className="vendor">{p.vendor}</span>
                </span>
                <span className={`a-mono ${p.owned ? "text-[var(--muted)]" : ""}`}>{money(p.price)}</span>
              </div>
            ))}
            <div className="a-total">
              <span>Total</span>
              <span className="a-mono">{money(look.total)}</span>
            </div>
          </div>
          <button type="button" onClick={onOpenPieces} className="mt-4 grid h-11 grid-cols-[1fr_auto] items-center border-t border-[var(--rule)] pt-2 text-left font-medium lg:hidden">
            <span>
              {look.pieces.length} pieces from {vendors} {vendors === 1 ? "vendor" : "vendors"}
            </span>
            <span className="a-mono">{money(look.total)}</span>
          </button>
        </>
      ) : null}
    </div>
  );
}
