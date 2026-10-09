/**
 * Looks: a quiet library. The stage becomes a horizontal rail of saved
 * prints; tapping one opens it in the print with its pieces.
 */
import { usePieceSelection } from "../lib/selection";
import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Link, Navigate, useParams } from "react-router-dom";
import { FRESH, readSession, useJourney, writeSession } from "../lib/journeyContext";
import type { SavedLook } from "../../shared/store";
import { LinkButton, PrimaryButton, TextButton } from "../ui/controls";
import { BELOW, Frame, FrameCaption } from "../ui/Frame";
import { LookDetails } from "../ui/LookDetails";
import { PiecesSheet } from "../ui/PiecesSheet";
import { Stage } from "../ui/Stage";
import { TopBar } from "../ui/TopBar";

/** The look removed a moment ago, kept for the session so the rail can offer Undo. */
const REMOVED_KEY = "praxis_lab_a_removed";
const UNDO_MS = 6000;

function savedOn(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

export function Looks() {
  const { href, store, reduced } = useJourney();
  const looks = store.looks;
  const [removed, setRemoved] = useState<SavedLook | null>(() => readSession<SavedLook>(REMOVED_KEY));

  useEffect(() => {
    if (!removed) return;
    const t = setTimeout(() => {
      writeSession(REMOVED_KEY, null);
      setRemoved(null);
    }, UNDO_MS);
    return () => clearTimeout(t);
  }, [removed]);

  /* Undo is only offered on the visit right after the remove. */
  useEffect(() => () => writeSession(REMOVED_KEY, null), []);

  const undo = () => {
    if (!removed) return;
    store.restoreLook(removed);
    writeSession(REMOVED_KEY, null);
    setRemoved(null);
  };

  return (
    <div className="a-stage">
      <TopBar back={href("")} wordmark />
      <div className="flex min-h-0 flex-col">
        {looks.length > 0 ? (
          <div className="flex items-baseline justify-between px-5 pt-6 lg:px-12 lg:pt-8">
            <h1 className="a-display">Looks</h1>
          </div>
        ) : null}
        {removed ? (
          <div className="flex items-center gap-2 px-5 pt-2 lg:px-12" aria-live="polite">
            <p className="text-[15px] leading-5 text-[var(--muted)]">Removed.</p>
            <TextButton onClick={undo}>Undo</TextButton>
          </div>
        ) : null}

        {looks.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5 pb-16 text-center lg:px-12">
            <h1 className="a-display">No saved looks yet.</h1>
            <p className="max-w-[36ch] leading-6 text-[var(--muted)]">Save a look you like and I’ll keep it here for you.</p>
            <LinkButton to={href("moment/occasion", FRESH)} variant="primary">
              Dress me for a moment
            </LinkButton>
          </div>
        ) : (
          <ul className="a-rail flex min-h-0 flex-1 snap-x snap-mandatory items-start gap-4 overflow-x-auto px-5 py-6 lg:gap-8 lg:px-12 lg:py-8" aria-label="Saved looks">
            {looks.map((s, i) => (
              <motion.li key={s.id} initial={reduced ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reduced ? 0 : Math.min(i, 6) * 0.05, duration: 0.3, ease: "easeOut" }} className="shrink-0 snap-start">
                <Link to={href(`looks/${s.id}`)} className="group flex flex-col">
                  <span className="a-rail-print block">
                    <img src={s.tryOnImage ?? s.look.image} alt={`${s.look.title} for ${s.occasionLabel.toLowerCase()}`} className="h-full w-full object-cover object-top transition-opacity duration-200 group-hover:opacity-85" draggable={false} />
                  </span>
                  <span className="mt-4 block font-[family-name:var(--font-display)] text-[19px] leading-6">{s.look.title}</span>
                  <span className="a-label mt-1 block text-[var(--muted)]">
                    {s.occasionLabel}, {savedOn(s.savedAt)}
                  </span>
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function LookDetail() {
  const { id } = useParams();
  const { href, go, store, reduced } = useJourney();
  const [sheet, setSheet] = useState(false);
  const openBuy = useCallback(() => setSheet(true), []);
  const saved = store.looks.find((s) => s.id === id);
  const selection = usePieceSelection(saved?.look ?? null);

  if (!saved) return <Navigate to={href("looks")} replace />;

  return (
    <Stage
      back={href("looks")}
      band="looks"
      canvas={
        <Frame
          book
          image={saved.tryOnImage ?? saved.look.image}
          alt={`${saved.look.title} for ${saved.occasionLabel.toLowerCase()}`}
          reduced={reduced}
          belowHeight={saved.tryOnImage ? BELOW.caption : BELOW.none}
          below={saved.tryOnImage ? <FrameCaption>On you</FrameCaption> : undefined}
        />
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <PrimaryButton onClick={openBuy}>Check out</PrimaryButton>
          <TextButton
            onClick={() => {
              writeSession(REMOVED_KEY, saved);
              store.removeLook(saved.id);
              go("looks");
            }}
          >
            Remove
          </TextButton>
        </div>
      }
    >
      <LookDetails look={saved.look} eyebrow={`${saved.occasionLabel}, saved ${savedOn(saved.savedAt)}`} selection={selection} />
      <PiecesSheet look={saved.look} open={sheet} onClose={() => setSheet(false)} selection={selection} />
    </Stage>
  );
}
