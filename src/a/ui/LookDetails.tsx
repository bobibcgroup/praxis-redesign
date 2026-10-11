/**
 * The look in the left column: eyebrow, title, the line tying it to the brief, the stylist's note on
 * why the pieces work, the reasons folded under "Why this look", Make it yours, then the pieces, each with a box the
 * client can untick, and the total of what is chosen. With nothing ticked, it says why Check out is
 * unavailable. On a phone the list scrolls inside the column.
 */
import type { ReactNode } from "react";
import type { Look } from "../../shared/catalog";
import { money } from "../lib/looks";
import type { PieceSelection } from "../lib/selection";
import { LookWhy } from "./LookWhy";
import { PieceRow } from "./PieceRow";

/** Referenced by Check out (aria-describedby) while nothing is ticked. */
export const CHECKOUT_REASON_ID = "a-checkout-reason";

interface Props {
  look: Look;
  eyebrow: string;
  /** Hide the pieces (the completion state takes their place). */
  compact?: boolean;
  selection: PieceSelection;
  /** Under the total: what the looks and prices are, in one quiet line. */
  caption?: string;
  /** Show the summary and Why this look. Off for a friend's shared looks: they explain someone else's answers. */
  explain?: boolean;
  /** After the pieces: feedback on the look. */
  after?: ReactNode;
  /** Before the pieces, so it is seen without scrolling: the offer to make the look personal. */
  personal?: ReactNode;
  /** Closes the column, after the total. */
  end?: ReactNode;
}

export function LookDetails({ look, eyebrow, compact = false, selection, caption, explain = true, after, personal, end }: Props) {
  const count = selection.chosen.length;
  const buyable = look.pieces.some((p) => !p.owned);
  return (
    <div className="flex min-h-0 flex-col">
      <p className="a-label mb-3 text-[var(--muted)]">{eyebrow}</p>
      <h1 className="a-display">{look.title}</h1>
      {explain && look.summary && !compact ? <p className="a-summary mt-3 max-w-[40ch]">{look.summary}</p> : null}
      <p className={`a-note mt-4 max-w-[34ch] ${compact ? "hidden lg:block" : ""}`}>{look.why}</p>
      {explain && !compact && look.factors ? <LookWhy factors={look.factors} lookId={look.id} /> : null}
      {personal}

      {!compact ? (
        <div className="mt-6" role="list" aria-label="Pieces">
          {look.pieces.map((p) => (
            <PieceRow key={p.id} piece={p} chosen={selection.isChosen(p.id)} onToggle={selection.toggle} />
          ))}
          <div className="a-total">
            <span className="a-label">
              Total, {count} {count === 1 ? "piece" : "pieces"}
            </span>
            <span className="a-mono">{count === 0 ? "$0" : money(selection.total)}</span>
          </div>
          {count === 0 && buyable ? (
            <p id={CHECKOUT_REASON_ID} className="mt-2 text-[13px] leading-5 text-[var(--muted)]" aria-live="polite">
              Select at least one piece to continue.
            </p>
          ) : null}
          {caption ? <p className="mt-3 max-w-[44ch] text-[13px] leading-5 text-[var(--muted)]">{caption}</p> : null}
        </div>
      ) : null}
      {!compact ? after : null}
      {end}
    </div>
  );
}
