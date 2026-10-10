/**
 * Results: the looks come first. The hero fills the print with the three looks beside it as an
 * index. Move between them with the index, a sideways swipe on the print, the arrows under it on
 * desktop, or the arrow keys once the print or the index has focus; it stops at the first and the
 * last. Everything follows the one look in the URL (`hero`), so the photo, the name, the note, the
 * pieces, the prices, the total, and Check out, Share, Save and Restyle always belong to the same
 * look. A tap or click on the print opens it large to zoom in (LookViewer). The column offers to
 * make it personal (see it on me, build around something I own), lists the pieces to check out,
 * and ends with a way to start a new look. Save lands in the completion state.
 */
import { usePieceSelection } from "../../lib/selection";
import { useCallback, useMemo, useState, type KeyboardEvent } from "react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Navigate } from "react-router-dom";
import { FRESH, useGateAction, useGated, useJourney } from "../../lib/journeyContext";
import { defaultHeroId, money, occasionLabel, resolveLooks, ROLE_LABEL } from "../../lib/looks";
import { momentSpine } from "../../lib/spine";
import { useSwipe } from "../../lib/swipe";
import { Completion, CompletionActions } from "../../ui/Completion";
import { LinkButton, PlusMark, PrimaryButton, QuietButton, TextButton } from "../../ui/controls";
import { LookViewer } from "../../ui/LookViewer";
import { RestyleSheet } from "../../ui/RestyleSheet";
import { ShareSheet } from "../../ui/ShareSheet";
import { Frame } from "../../ui/Frame";
import { LookDetails } from "../../ui/LookDetails";
import { PiecesSheet } from "../../ui/PiecesSheet";
import { Stage } from "../../ui/Stage";
import { Thumbs } from "../../ui/Thumbs";

export function Results() {
  const { answers, params, href, go, ownedItem, store, reduced, user } = useJourney();
  const gated = useGated();
  const resolved = useMemo(() => resolveLooks(answers, ownedItem), [answers, ownedItem]);
  const [sheet, setSheet] = useState(false);
  const [viewer, setViewer] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [restyling, setRestyling] = useState(false);
  /** Which way the last move went (+1 to the next look), so the photo glides in from that side. */
  const [dir, setDir] = useState(0);
  const hero = resolved?.hero ?? null;
  const selection = usePieceSelection(hero);
  const label = occasionLabel(answers.occasion);

  const save = useCallback(() => {
    if (!hero) return;
    store.saveLook(hero, label);
    go("moment/results", { done: "saved" }, { replace: true });
  }, [hero, label, store, go]);
  const openBuy = useCallback(() => setSheet(true), []);
  useGateAction("save", save);

  const looksNow = resolved?.looks ?? [];
  const index = hero ? Math.max(0, looksNow.findIndex((l) => l.id === hero.id)) : 0;
  const canPrev = index > 0;
  const canNext = index < looksNow.length - 1;
  const show = useCallback(
    (id: string, d?: number) => {
      const to = looksNow.findIndex((l) => l.id === id);
      if (to < 0 || to === index) return;
      setDir(d ?? Math.sign(to - index));
      go("moment/results", { hero: id }, { replace: true });
    },
    [looksNow, index, go],
  );
  const step = useCallback(
    (d: number) => {
      const to = looksNow[index + d];
      if (to) show(to.id, d);
    },
    [looksNow, index, show],
  );
  const prev = useCallback(() => step(-1), [step]);
  const next = useCallback(() => step(1), [step]);
  const openViewer = useCallback(() => setViewer(true), []);
  const swipe = useSwipe({ canPrev, canNext, onPrev: prev, onNext: next, onTap: openViewer });
  const onGalleryKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "ArrowLeft" && canPrev) prev();
    else if (e.key === "ArrowRight" && canNext) next();
    else return;
    e.preventDefault();
  };

  if (!answers.spend || !resolved || !hero) return <Navigate to={href("moment/occasion")} replace />;

  const { looks } = resolved;
  const saved = store.looks.some((s) => s.look.id === hero.id && s.occasionLabel === label);
  const done = answers.done;
  const plus = user?.plus ?? false;
  const isPick = hero.id === defaultHeroId(looks, answers.vibe);
  const hasFace = Boolean(answers.face || store.dna?.portrait);
  const eyebrow = isPick ? `My pick for ${label.toLowerCase()}` : `${ROLE_LABEL[hero.role]} for ${label.toLowerCase()}`;
  /* Opened from someone's shared link: show their looks and invite this visitor to get their own. */
  const shared = params.get("via") !== null && !done;
  const fresh = href("", FRESH);
  const seeOnMe = () => gated("tryon", () => go(hasFace ? "moment/tryon" : "moment/you/face"));

  return (
    <>
      <Stage
        spine={momentSpine("looks", answers, href)}
        back={href("moment/spend")}
        band="looks"
        canvas={
          <Frame
            book
            image={hero.image}
            alt={`${hero.title}, the ${ROLE_LABEL[hero.role].toLowerCase()} look for ${label.toLowerCase()}`}
            reduced={reduced}
            aside={<Thumbs looks={looks} activeId={hero.id} onPick={show} reduced={reduced} vertical />}
            bleedDesktop
            swap={{ dir, drag: swipe.drag }}
            label="Your three looks"
            onKeyDown={onGalleryKey}
            overlay={
              <>
                <button
                  type="button"
                  className="a-enlarge"
                  aria-label={`View ${hero.title} larger. Swipe or use the arrow keys for the other looks.`}
                  aria-haspopup="dialog"
                  {...swipe.handlers}
                />
                <span className="a-zoom-cue" aria-hidden="true">
                  <Search size={16} strokeWidth={1.5} />
                  <span className="a-zoom-cue-text a-transition">View details</span>
                </span>
                <div className="a-look-nav">
                  <button type="button" className="a-viewer-btn" onClick={prev} aria-disabled={!canPrev} aria-label="Previous look">
                    <ChevronLeft size={20} strokeWidth={1.5} />
                  </button>
                  <span className="a-label" aria-hidden="true">
                    {index + 1} of {looks.length}
                  </span>
                  <button type="button" className="a-viewer-btn" onClick={next} aria-disabled={!canNext} aria-label="Next look">
                    <ChevronRight size={20} strokeWidth={1.5} />
                  </button>
                </div>
                <div className="a-thumbs-index">
                  <Thumbs looks={looks} activeId={hero.id} onPick={show} reduced={reduced} vertical />
                </div>
              </>
            }
          />
        }
        actions={
          done ? (
            <CompletionActions />
          ) : shared ? (
            <div className="flex flex-wrap items-center gap-1 lg:gap-2">
              <LinkButton to={fresh} variant="primary">
                Get your own looks
              </LinkButton>
              <TextButton onClick={openBuy} disabled={selection.chosen.length === 0}>
                Check out
              </TextButton>
              <TextButton onClick={() => setSharing(true)}>Share</TextButton>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1 lg:gap-2">
              <PrimaryButton onClick={openBuy} disabled={selection.chosen.length === 0}>
                Check out
                <span className="hint">{money(selection.total)}</span>
              </PrimaryButton>
              <TextButton onClick={() => setSharing(true)}>Share</TextButton>
              <TextButton onClick={() => gated("save", save)} disabled={saved}>
                {saved ? "Saved" : "Save"}
              </TextButton>
              <TextButton onClick={() => setRestyling(true)} className="lg:ml-auto lg:-mr-2">
                Restyle
              </TextButton>
            </div>
          )
        }
      >
        <p className="sr-only" aria-live="polite">
          {`${hero.title}, ${ROLE_LABEL[hero.role].toLowerCase()}, look ${index + 1} of ${looks.length}`}
        </p>
        <motion.div
          key={hero.id}
          className="flex min-h-0 flex-col"
          initial={reduced || dir === 0 ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <LookDetails
            look={hero}
            eyebrow={eyebrow}
            compact={done !== null}
            selection={selection}
            personal={
              done ? null : shared ? (
                <div className="mt-6">
                  <p className="a-label text-[var(--muted)]">Shared with you</p>
                  <p className="a-note mt-3">
                    A friend asked me to style them {answers.occasion === "WORK" ? "for work" : `for a ${label.toLowerCase()}`}. Tell me about your moment and I’ll style three looks for you.
                  </p>
                </div>
              ) : (
                <div className="mt-6">
                  <p className="a-label text-[var(--muted)]">Make it yours</p>
                  <div className="a-personal mt-3">
                    <QuietButton onClick={seeOnMe}>
                      See it on me
                      <PlusMark show={!plus} price />
                    </QuietButton>
                    <QuietButton onClick={() => go("moment/you/item")}>
                      {ownedItem ? "Change my piece" : "Use something I own"}
                    </QuietButton>
                  </div>
                </div>
              )
            }
          />
        </motion.div>
        {done ? <Completion kind={done} /> : null}
        <ShareSheet look={hero} eyebrow={eyebrow} occasion={label.toLowerCase()} open={sharing} onClose={() => setSharing(false)} />
        <RestyleSheet open={restyling} onClose={() => setRestyling(false)} />
        <PiecesSheet look={hero} open={sheet} onClose={() => setSheet(false)} selection={selection} />
      </Stage>
      {/* Outside the stage, so the column's entry motion never holds it while it opens. */}
      <LookViewer open={viewer} looks={looks} activeId={hero.id} onPick={show} onClose={() => setViewer(false)} reduced={reduced} />
    </>
  );
}
