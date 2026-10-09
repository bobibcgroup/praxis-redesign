/**
 * Check out: a short confirmation of the pieces ticked on the page (choosing happens there, once),
 * the total, who delivers, and one action that places the order.
 * Stand-in: there is no payment; "Purchase" shows the confirmation only.
 */
import { useEffect, useState } from "react";
import type { Look } from "../../shared/catalog";
import { money } from "../lib/looks";
import type { PieceSelection } from "../lib/selection";
import { PrimaryButton } from "./controls";
import { Sheet } from "./Sheet";

interface PiecesSheetProps {
  look: Look;
  open: boolean;
  onClose: () => void;
  selection: PieceSelection;
}

export function PiecesSheet({ look, open, onClose, selection }: PiecesSheetProps) {
  const [stage, setStage] = useState<"pick" | "busy" | "done">("pick");
  const chosen = look.pieces.filter((p) => !p.owned && selection.isChosen(p.id));
  const count = selection.chosen.length;

  useEffect(() => {
    if (open) setStage("pick");
  }, [open]);

  useEffect(() => {
    if (stage !== "busy") return;
    const t = setTimeout(() => setStage("done"), 900);
    return () => clearTimeout(t);
  }, [stage]);

  if (stage === "done") {
    return (
      <Sheet open={open} onClose={onClose} label="Check out" footer={<PrimaryButton onClick={onClose} className="w-full">Back to my look</PrimaryButton>}>
        <div className="flex flex-col gap-4 py-6">
          <p className="a-label text-[var(--muted)]">Order placed</p>
          <p className="font-[family-name:var(--font-display)] text-[32px] leading-[40px]">Thank you. Your order is placed.</p>
          <p className="leading-6 text-[var(--muted)]">
            {count} {count === 1 ? "piece" : "pieces"}, {money(selection.total)}. Each retailer sends its own confirmation.
          </p>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Check out"
      footer={
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-[1fr_auto] items-baseline">
            <span className="a-label">
              Total, {count} {count === 1 ? "piece" : "pieces"}
            </span>
            <span className="a-mono text-[17px]">{money(selection.total)}</span>
          </div>
          <PrimaryButton onClick={() => setStage("busy")} disabled={count === 0 || stage === "busy"} aria-busy={stage === "busy"} className="w-full justify-center">
            {stage === "busy" ? "One moment" : count === 0 ? "Choose a piece" : `Purchase ${money(selection.total)}`}
          </PrimaryButton>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <div role="list" aria-label="Your pieces">
          {chosen.map((p) => (
            <div key={p.id} role="listitem" className="a-piece">
              <span>
                <span className="house a-label">{p.vendor}</span>
                <span className="name">{p.name}</span>
              </span>
              <span className="a-mono">{money(p.price)}</span>
            </div>
          ))}
        </div>
        <p className="text-[15px] leading-6 text-[var(--muted)]">Each house delivers its pieces to you directly and handles its own returns.</p>
      </div>
    </Sheet>
  );
}
