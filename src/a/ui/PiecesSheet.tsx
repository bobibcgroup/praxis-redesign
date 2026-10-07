/** The pieces by vendor with a total; in buy mode, "Reserve" lands in the completion state, never a store. */
import type { Look, Piece } from "../../shared/catalog";
import { money, SLOT_LABEL } from "../lib/looks";
import { PrimaryButton } from "./controls";
import { Sheet } from "./Sheet";

interface PiecesSheetProps {
  look: Look;
  open: boolean;
  onClose: () => void;
  mode: "pieces" | "buy";
  onReserve?: () => void;
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

export function PiecesSheet({ look, open, onClose, mode, onReserve }: PiecesSheetProps) {
  const owned = look.pieces.filter((p) => p.owned);
  const groups = groupByVendor(look.pieces);

  return (
    <Sheet open={open} onClose={onClose} label={mode === "buy" ? "Get the pieces" : "The pieces"}>
      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <section key={g.vendor} aria-label={g.vendor}>
            <h3 className="text-[13px] font-medium text-[var(--muted)]">{g.vendor}</h3>
            <div className="mt-2" role="list">
              {g.pieces.map((p) => (
                <div key={p.id} className="a-row" role="listitem">
                  <span>
                    {p.name}
                    <span className="vendor">{SLOT_LABEL[p.slot]}</span>
                  </span>
                  <span className="a-mono">{money(p.price)}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
        {owned.length > 0 ? (
          <section aria-label="Already yours">
            <h3 className="text-[13px] font-medium text-[var(--muted)]">Already yours</h3>
            <div className="mt-2" role="list">
              {owned.map((p) => (
                <div key={p.id} className="a-row" role="listitem">
                  <span>
                    {p.name}
                    <span className="vendor">{SLOT_LABEL[p.slot]}</span>
                  </span>
                  <span className="a-mono text-[var(--muted)]">Owned</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
        <div>
          <div className="a-total">
            <span>Total</span>
            <span className="a-mono">{money(look.total)}</span>
          </div>
          {mode === "buy" && onReserve ? (
            <>
              <p className="mt-4 text-[13px] leading-5 text-[var(--muted)]">You’ll get each piece from the retailer directly. Nothing is charged here.</p>
              <PrimaryButton className="mt-4 w-full" onClick={onReserve}>
                Get the pieces
              </PrimaryButton>
            </>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}
