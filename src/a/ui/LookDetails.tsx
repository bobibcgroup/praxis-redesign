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

export function LookDetails({ look, eyebrow, compact = false }: Props) {
  return (
    <div className="flex min-h-0 flex-col">
      <p className="a-label mb-3 text-[var(--muted)]">{eyebrow}</p>
      <h1 className="a-display">{look.title}</h1>
      <p className={`mt-4 max-w-[40ch] leading-6 ${compact ? "hidden lg:block" : ""}`}>{look.why}</p>

      {!compact ? (
        <>
          <div className="mt-6" role="list" aria-label="Pieces">
            {look.pieces.map((p) => (
              <div key={p.id} className="a-piece" role="listitem">
                <span>
                  <span className="house a-label">{p.vendor}</span>
                  <span className="name">{p.name}</span>
                </span>
                <span className={`a-mono ${p.owned ? "text-[var(--muted)]" : ""}`}>{p.owned ? "Yours" : money(p.price)}</span>
              </div>
            ))}
            <div className="a-total">
              <span>Total</span>
              <span className="a-mono">{money(look.total)}</span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
