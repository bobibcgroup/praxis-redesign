/**
 * Check out: the pieces by retailer, each with a box, all chosen at first. The client drops what
 * they already have, the total follows, and one action places the order.
 * Stand-in: there is no payment; "Purchase" shows the confirmation only.
 */
import { useEffect, useState } from "react";
import type { Look, Piece } from "../../shared/catalog";
import { money } from "../lib/looks";
import type { PieceSelection } from "../lib/selection";
import { PieceRow } from "./PieceRow";
import { PrimaryButton } from "./controls";
import { Sheet } from "./Sheet";

interface PiecesSheetProps {
  look: Look;
  open: boolean;
  onClose: () => void;
  selection: PieceSelection;
}

function groupByVendor(pieces: Piece[]): Array<{ vendor: string; pieces: Piece[] }> {
  return pieces
    .filter((p) => !p.owned)
    .reduce<Array<{ vendor: string; pieces: Piece[] }>>((groups, piece) => {
      const group = groups.find((g) => g.vendor === piece.vendor);
      if (group) return groups.map((g) => (g.vendor === piece.vendor ? { ...g, pieces: [...g.pieces, piece] } : g));
      return [...groups, { vendor: piece.vendor, pieces: [piece] }];
    }, []);
}

export function PiecesSheet({ look, open, onClose, selection }: PiecesSheetProps) {
  const [stage, setStage] = useState<"pick" | "busy" | "done">("pick");
  const owned = look.pieces.filter((p) => p.owned);
  const groups = groupByVendor(look.pieces);
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
        <p className="leading-6 text-[var(--muted)]">Everything is chosen. Untick anything you already have.</p>
        {groups.map((g) => (
          <section key={g.vendor} aria-label={g.vendor}>
            <h3 className="a-label text-[var(--text)]">{g.vendor}</h3>
            <div className="mt-1" role="list">
              {g.pieces.map((p) => (
                <PieceRow key={p.id} piece={p} chosen={selection.isChosen(p.id)} onToggle={selection.toggle} over="slot" />
              ))}
            </div>
          </section>
        ))}
        {owned.length > 0 ? (
          <section aria-label="Already yours">
            <h3 className="a-label text-[var(--text)]">Already yours</h3>
            <div className="mt-1" role="list">
              {owned.map((p) => (
                <PieceRow key={p.id} piece={p} chosen={false} over="slot" />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </Sheet>
  );
}
