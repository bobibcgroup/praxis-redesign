/**
 * One piece with a box to keep or drop it: house above, name in the serif, price on the right edge.
 * A styling reference has no box and no price: it completes the look and isn't for sale here. A piece
 * with its own picture (the store's product photo, or the reference's part of a library photograph)
 * shows it small at the start of the row; a tap opens it large.
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, ExternalLink } from "lucide-react";
import type { Piece } from "../../shared/catalog";
import { money, SLOT_LABEL } from "../lib/looks";
import { Sheet } from "./Sheet";

interface Props {
  piece: Piece;
  chosen: boolean;
  onToggle?: (id: string) => void;
  /** What sits in small capitals above the name. */
  over?: "house" | "slot";
}

/** The piece's own picture, cropped to the piece for a reference (library photographs are square). */
function PhotoBox({ photo, size }: { photo: NonNullable<Piece["photo"]>; size: { w: number; h: number } }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  const r = photo.region;
  if (!r) return <img src={photo.src} alt="" className="h-full w-full object-cover" loading="lazy" draggable={false} onError={() => setBroken(true)} />;
  const width = size.w / r.w;
  const top = -(r.y + r.h / 2) * width + size.h / 2;
  return (
    <img
      src={photo.src}
      alt=""
      draggable={false}
      loading="lazy"
      onError={() => setBroken(true)}
      style={{ position: "absolute", width, height: width, maxWidth: "none", left: -r.x * width, top: Math.min(0, Math.max(size.h - width, top)) }}
    />
  );
}

/** The small picture at the start of a row, and the large view it opens. */
function PiecePhoto({ piece }: { piece: Piece }) {
  const [open, setOpen] = useState(false);
  const [missing, setMissing] = useState(false);
  if (!piece.photo || missing) return null;
  const store = !piece.reference && piece.productUrl && /^https:\/\//i.test(piece.productUrl) ? piece.productUrl : null;
  return (
    <>
      <button
        type="button"
        className="a-piece-photo"
        aria-label={`See ${piece.reference ? "the reference for" : "the photo of"} ${piece.name}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <PhotoBox photo={piece.photo} size={{ w: 44, h: 56 }} />
        {/* A store photo that fails to load hides the button rather than show a broken picture. */}
        {!piece.photo.region ? <img src={piece.photo.src} alt="" hidden onError={() => setMissing(true)} /> : null}
      </button>
      {/* Outside the row's label in the page, so nothing in the sheet ticks or unticks the piece. */}
      {createPortal(
        <Sheet open={open} onClose={() => setOpen(false)} label={piece.name}>
          <div className="flex flex-col gap-4">
            <div className="a-piece-photo-large">
              <PhotoBox photo={piece.photo} size={{ w: 320, h: 400 }} />
            </div>
            <p className="text-[15px] leading-6 text-[var(--muted)]">
              {piece.reference
                ? `My styling reference${piece.description ? `: ${piece.description}` : ""}. It shows what completes the look and isn’t for sale here.`
                : `${piece.vendor}’s own photo of this piece.`}
            </p>
            {store ? (
              <a className="a-control a-tertiary -ml-2 gap-2 self-start" href={store} target="_blank" rel="noopener noreferrer">
                See it at {piece.vendor}
                <ExternalLink size={16} strokeWidth={1.5} aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </Sheet>,
        document.querySelector("[data-concept='a']") ?? document.body,
      )}
    </>
  );
}

export function PieceRow({ piece, chosen, onToggle, over = "house" }: Props) {
  const label = over === "house" ? piece.vendor : SLOT_LABEL[piece.slot];
  const photo = piece.photo ? <PiecePhoto piece={piece} /> : null;
  const withPhoto = piece.photo ? "" : undefined;

  const sold = !piece.owned && !piece.reference && piece.availability === "out_of_stock";
  if (piece.owned || piece.reference || !onToggle || sold) {
    return (
      <div className="a-piece" role="listitem" data-photo={withPhoto} data-reference={piece.reference ? "" : undefined}>
        {photo}
        <span>
          <span className="house a-label">{label}</span>
          <span className="name">{piece.name}</span>
        </span>
        <span className="a-mono text-[var(--muted)]">{piece.owned ? "Yours" : piece.reference ? "Reference" : sold ? "Sold out" : money(piece.price)}</span>
      </div>
    );
  }

  return (
    <label className="a-piece a-pick" data-chosen={chosen ? "" : undefined} data-photo={withPhoto} role="listitem">
      <input type="checkbox" className="sr-only" checked={chosen} onChange={() => onToggle(piece.id)} aria-label={`${piece.name}, ${money(piece.price)}`} />
      <span className="a-box" aria-hidden="true">
        {chosen ? <Check size={14} strokeWidth={2} /> : null}
      </span>
      {photo}
      <span>
        <span className="house a-label">{label}</span>
        <span className="name">{piece.name}</span>
        {chosen ? null : <span className="left-out">Not included</span>}
      </span>
      <span className="a-mono price">{money(piece.price)}</span>
    </label>
  );
}
