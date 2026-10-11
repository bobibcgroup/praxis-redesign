/**
 * Check out: the pieces ticked on the page, each with its size and what the retailer says about
 * stock, then the way to buy. It only offers to buy where a real route exists (the retailer's site
 * or an affiliate link); the sample pieces have none, so the sheet says so instead of pretending to
 * take an order. Stock reads "not confirmed" unless a retailer feed confirms it, and delivery is
 * shown only when the retailer supplies it.
 */
import { ExternalLink } from "lucide-react";
import { track } from "../../core/analytics";
import { stockFor } from "../../core/retail";
import type { Look, Piece } from "../../shared/catalog";
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

type Link = { url: string; route: "retailer_site" | "affiliate" };

function linkOf(p: Piece): Link | null {
  const r = p.purchase;
  return r && (r.kind === "retailer_site" || r.kind === "affiliate") ? { url: r.url, route: r.kind } : null;
}

function stockLine(p: Piece, size: string | undefined): string {
  const stock = stockFor({ availability: p.availability ?? "unknown", sizeAvailability: p.sizeAvailability }, size);
  if (stock === "out_of_stock") return size ? `Size ${size} is sold out` : "Sold out";
  if (stock === "in_stock" && p.priceStatus === "live") return size ? `Size ${size} in stock` : "In stock";
  return "Stock not confirmed";
}

export function PiecesSheet({ look, open, onClose, selection }: PiecesSheetProps) {
  const chosen = selection.chosen;
  const count = chosen.length;
  const buyable = chosen.filter((p) => linkOf(p));
  const examples = chosen.some((p) => p.priceStatus !== "live");
  const needsSize = buyable.filter((p) => p.sizes?.length && !selection.sizeOf(p.id));

  const pickSize = (p: Piece, size: string) => {
    selection.setSize(p.id, size);
    track("size_selected", { outfitId: look.id, garmentId: p.id, size });
  };

  const leave = (p: Piece) => {
    const link = linkOf(p);
    if (!link) return;
    track("retailer_redirected", { outfitId: look.id, garmentId: p.id, retailerId: p.retailerId ?? p.vendor, route: link.route });
    window.open(link.url, "_blank", "noopener,noreferrer");
  };

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
          {buyable.length === 0 ? (
            <>
              <PrimaryButton disabled aria-describedby="a-buy-reason" className="w-full justify-center">
                Buying isn’t open yet
              </PrimaryButton>
              <p id="a-buy-reason" className="text-[13px] leading-5 text-[var(--muted)]">
                {examples ? "These are example pieces, so they can’t be bought yet." : "These pieces can’t be bought from here yet."}
              </p>
            </>
          ) : needsSize.length ? (
            <p className="text-[13px] leading-5 text-[var(--muted)]" aria-live="polite">
              Choose a size for each piece to continue.
            </p>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <div role="list" aria-label="Your pieces">
          {chosen.map((p) => {
            const size = selection.sizeOf(p.id);
            const link = linkOf(p);
            return (
              <div key={p.id} role="listitem" className="border-b border-[var(--rule)] py-4">
                <div className="grid grid-cols-[1fr_auto] items-baseline gap-4">
                  <span>
                    <span className="a-label block text-[var(--muted)]">{p.vendor}</span>
                    <span className="mt-1 block font-[family-name:var(--font-display)] text-[19px] leading-6">{p.name}</span>
                  </span>
                  <span className="a-mono">{money(p.price)}</span>
                </div>
                {p.sizes?.length ? (
                  <div className="a-chips mt-3" role="group" aria-label={`Size for ${p.name}`}>
                    {p.sizes.map((s) => (
                      <button key={s} type="button" className="a-chip" aria-pressed={size === s} onClick={() => pickSize(p, s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                ) : null}
                <p className="mt-2 text-[13px] leading-5 text-[var(--muted)]">
                  {stockLine(p, size)}
                  {p.deliveryEstimate ? `. Delivery ${p.deliveryEstimate}` : ""}
                </p>
                {link ? (
                  <PrimaryButton className="mt-3" onClick={() => leave(p)} disabled={Boolean(p.sizes?.length && !size) || stockFor({ availability: p.availability ?? "unknown", sizeAvailability: p.sizeAvailability }, size) === "out_of_stock"}>
                    Buy at {p.vendor}
                    <ExternalLink size={16} strokeWidth={1.5} aria-hidden="true" />
                  </PrimaryButton>
                ) : null}
              </div>
            );
          })}
        </div>
        {examples ? <p className="text-[15px] leading-6 text-[var(--muted)]">Prices are examples. Stock and delivery aren’t confirmed.</p> : null}
      </div>
    </Sheet>
  );
}
