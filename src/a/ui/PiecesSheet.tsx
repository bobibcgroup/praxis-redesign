/** The pieces by vendor with a total. The sheet is the end point: it stays open as the list the client acts on. */
import type { Look, Piece } from "../../shared/catalog";
import { money, SLOT_LABEL } from "../lib/looks";
import { Sheet } from "./Sheet";

interface PiecesSheetProps {
  look: Look;
  open: boolean;
  onClose: () => void;
  mode: "pieces" | "buy";
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

export function PiecesSheet({ look, open, onClose, mode }: PiecesSheetProps) {
  const owned = look.pieces.filter((p) => p.owned);
  const groups = groupByVendor(look.pieces);

  return (
    <Sheet open={open} onClose={onClose} label={mode === "buy" ? "Get the pieces" : "The pieces"}>
      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <section key={g.vendor} aria-label={g.vendor}>
            <h3 className="a-label text-[var(--muted)]">{g.vendor}</h3>
            <div className="mt-2" role="list">
              {g.pieces.map((p) => (
                <div key={p.id} className="a-piece" role="listitem">
                  <span>
                    <span className="house a-label">{SLOT_LABEL[p.slot]}</span>
                    <span className="name">{p.name}</span>
                  </span>
                  <span className="a-mono">{money(p.price)}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
        {owned.length > 0 ? (
          <section aria-label="Already yours">
            <h3 className="a-label text-[var(--muted)]">Already yours</h3>
            <div className="mt-2" role="list">
              {owned.map((p) => (
                <div key={p.id} className="a-piece" role="listitem">
                  <span>
                    <span className="house a-label">{SLOT_LABEL[p.slot]}</span>
                    <span className="name">{p.name}</span>
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
          {mode === "buy" ? <p className="mt-4 text-[13px] leading-5 text-[var(--muted)]">Each piece comes from its retailer.</p> : null}
        </div>
      </div>
    </Sheet>
  );
}
