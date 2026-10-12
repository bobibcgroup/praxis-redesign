/**
 * Results: the looks come first, exactly as the recommendation service returned them for these
 * answers, in its order, with its reasons. The pick fills the print with the others beside it as an
 * index. Move between them with the index, a sideways swipe on the print, the arrows under it on
 * desktop, or the arrow keys once the print or the index has focus; it stops at the first and the
 * last. Everything follows the one look in the URL (`hero`), so the photo, the name, the reasons, the
 * pieces, the prices, the total, the feedback, and Check out, Share, Save and Restyle always belong to
 * the same look. A tap or click on the print opens it large to zoom in (LookViewer). Saving needs no
 * account; the completion state offers sign-in afterwards.
 */
import { soldOut, usePieceSelection, type PieceSelection } from "../../lib/selection";
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Navigate } from "react-router-dom";
import { track } from "../../../core/analytics";
import { recordSelection } from "../../../core/data";
import { anonymousId } from "../../../core/identity";
import { FRESH, useGated, useJourney } from "../../lib/journeyContext";
import { forOccasion, money, occasionLabel, resolveFromResponse, ROLE_LABEL } from "../../lib/looks";
import { momentSpine } from "../../lib/spine";
import { useStylingResponse, useStylingSpec } from "../../lib/styling";
import { useSwipe } from "../../lib/swipe";
import { Completion, CompletionActions } from "../../ui/Completion";
import { LinkButton, PremiumMark, PrimaryButton, TextButton } from "../../ui/controls";
import { LookViewer } from "../../ui/LookViewer";
import { RestyleSheet } from "../../ui/RestyleSheet";
import { ShareSheet } from "../../ui/ShareSheet";
import { Frame } from "../../ui/Frame";
import { CHECKOUT_REASON_ID, LookDetails } from "../../ui/LookDetails";
import { LookFeedback } from "../../ui/LookFeedback";
import { PiecesSheet } from "../../ui/PiecesSheet";
import { Stage } from "../../ui/Stage";
import { Thumbs } from "../../ui/Thumbs";
import type { StylingResponse } from "../../../core/contracts";

type Method = "thumbnail" | "swipe" | "arrow" | "key" | "viewer";

/** What these looks are, in one quiet line: an example from the sample set, or chosen for this person. */
function captionFor(response: StylingResponse, occasion: string): string {
  // Real pieces from a store being tested: say so, so nobody mistakes the test for the finished service.
  const store = response.outfits.flatMap((o) => o.garments).find((g) => g.source === "retail" && g.product.priceStatus === "live");
  const references = response.outfits.some((o) => o.garments.some((g) => g.source === "reference"));
  if (store && store.source === "retail") {
    return `Real pieces from ${store.product.retailerName} where they suit the look, while I test live stock; their prices and sizes are theirs.${references ? " My references complete the rest and aren’t for sale here." : ""}`;
  }
  if (references) return "My references complete these looks; nothing from the store suited them, so there’s nothing to buy here yet.";
  return response.mode === "personalized"
    ? `Chosen for your ${occasion} plans, preferred style and budget.`
    : "An example of the looks Praxis can help you explore. Pieces and prices are for illustration.";
}

/** Counts each tick and untick as the customer's own action. */
function useTrackedSelection(selection: PieceSelection, outfitId: string | null, recommendationId: string | null): PieceSelection {
  return useMemo(
    () => ({
      ...selection,
      toggle: (id: string) => {
        if (outfitId) track(selection.isChosen(id) ? "garment_deselected" : "garment_reselected", { recommendationId: recommendationId ?? undefined, outfitId, garmentId: id });
        selection.toggle(id);
      },
    }),
    [selection, outfitId, recommendationId],
  );
}

/** Said when a save could not be written: storage is full or blocked in this browser. */
export function SaveFailed() {
  return (
    <p role="alert" className="w-full text-[13px] leading-5 text-[var(--error)]">
      I couldn’t save this look. This browser’s storage is full or switched off; free some space or allow site data, then try again.
    </p>
  );
}

export function Results() {
  const { answers, params, href, go, store, reduced, user } = useJourney();
  const gated = useGated();
  const spec = useStylingSpec();
  const { response, loading } = useStylingResponse(spec);
  const resolved = useMemo(() => resolveFromResponse(response, answers.occasion, answers.hero), [response, answers.occasion, answers.hero]);
  const [sheet, setSheet] = useState(false);
  const [viewer, setViewer] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [restyling, setRestyling] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  /** Which way the last move went (+1 to the next look), so the photo glides in from that side. */
  const [dir, setDir] = useState(0);
  const hero = resolved?.hero ?? null;
  const recommendationId = response?.recommendationId ?? null;
  const selection = useTrackedSelection(usePieceSelection(hero), hero?.id ?? null, recommendationId);
  const label = occasionLabel(answers.occasion);
  const shared = params.get("via") !== null && !answers.done;

  const save = useCallback(() => {
    if (!hero || !response) return;
    const result = store.saveLook(hero, label, { owner: { anonymousSessionId: anonymousId(), userId: user?.id }, recommendationId: response.recommendationId, requestId: response.requestId, inputKey: response.inputKey });
    // Nothing is said to be saved unless it was written.
    if (!result.ok) {
      setSaveFailed(true);
      track("look_save_failed", { recommendationId: response.recommendationId, outfitId: hero.id });
      return;
    }
    setSaveFailed(false);
    if (!result.existing) track("look_saved", { recommendationId: response.recommendationId, outfitId: hero.id, signedIn: Boolean(user) });
    go("moment/results", { done: "saved" }, { replace: true });
  }, [hero, response, label, store, user, go]);
  const openBuy = useCallback(() => {
    if (hero && selection.chosen.length > 0) track("checkout_initiated", { recommendationId: recommendationId ?? undefined, outfitId: hero.id, pieces: selection.chosen.length, total: selection.total, priceStatus: hero.priceStatus ?? "example" });
    setSheet(true);
  }, [hero, selection, recommendationId]);

  const looksNow = resolved?.looks ?? [];
  const index = hero ? Math.max(0, looksNow.findIndex((l) => l.id === hero.id)) : 0;
  const canPrev = index > 0;
  const canNext = index < looksNow.length - 1;
  const show = useCallback(
    (id: string, d: number | undefined, method: Method) => {
      const to = looksNow.findIndex((l) => l.id === id);
      if (to < 0 || to === index) return;
      setDir(d ?? Math.sign(to - index));
      if (recommendationId) {
        track("outfit_selected", { recommendationId, outfitId: id, rank: looksNow[to].rank ?? to + 1, method });
        recordSelection(recommendationId, id);
      }
      go("moment/results", { hero: id }, { replace: true });
    },
    [looksNow, index, go, recommendationId],
  );
  const step = useCallback(
    (d: number, method: Method) => {
      const to = looksNow[index + d];
      if (to) show(to.id, d, method);
    },
    [looksNow, index, show],
  );
  const swipePrev = useCallback(() => step(-1, "swipe"), [step]);
  const swipeNext = useCallback(() => step(1, "swipe"), [step]);
  const openViewer = useCallback(() => {
    if (hero && recommendationId) track("outfit_enlarged", { recommendationId, outfitId: hero.id });
    setViewer(true);
  }, [hero, recommendationId]);
  const swipe = useSwipe({ canPrev, canNext, onPrev: swipePrev, onNext: swipeNext, onTap: openViewer });
  const onGalleryKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "ArrowLeft" && canPrev) step(-1, "key");
    else if (e.key === "ArrowRight" && canNext) step(1, "key");
    else return;
    e.preventDefault();
  };

  /* The looks for this recommendation are counted as seen once per visit. */
  useEffect(() => {
    if (!response || !resolved) return;
    track("results_viewed", { recommendationId: response.recommendationId, outfits: resolved.looks.length, mode: response.mode, shared }, { once: response.recommendationId });
  }, [response, resolved, shared]);

  if (!answers.spend || !spec) return <Navigate to={href("")} replace />;
  if (loading) {
    return (
      <Stage spine={momentSpine("looks", answers, href)} back={href("moment/spend")} band="looks" canvas={<Frame image={null} alt="" reduced={reduced} />}>
        <p role="status" className="a-display">
          Bringing your looks back.
        </p>
      </Stage>
    );
  }
  if (!response || !resolved || !hero) {
    return (
      <Stage spine={momentSpine("looks", answers, href)} back={href("moment/spend")} band="looks" canvas={<Frame image={null} alt="" reduced={reduced} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PrimaryButton onClick={() => go("moment/build", { hero: null }, { replace: true })}>Try again</PrimaryButton>
            <TextButton onClick={() => setRestyling(true)}>Change my answers</TextButton>
          </div>
        }
      >
        {response?.status === "empty" ? (
          <>
            <h1 className="a-display">I couldn’t find looks for all of that.</h1>
            <p className="mt-4 max-w-[40ch] leading-6 text-[var(--muted)]">Try another budget or feel, and I’ll look again.</p>
          </>
        ) : (
          <>
            <h1 className="a-display">I couldn’t put your looks together this time.</h1>
            <p className="mt-4 max-w-[40ch] leading-6 text-[var(--muted)]">Your answers are kept. Try again, or change one of them.</p>
          </>
        )}
        <RestyleSheet open={restyling} onClose={() => setRestyling(false)} />
      </Stage>
    );
  }

  const { looks } = resolved;
  const savedKey = `${hero.id}|${response.inputKey}`;
  const saved = store.looks.some((s) => s.dedupeKey === savedKey);
  const done = answers.done;
  const premium = user?.premium ?? false;
  /* Pieces the client unticked. The print stays the stylist's reference, and says so. */
  const left = hero ? hero.pieces.filter((p) => !p.owned && !soldOut(p) && !selection.isChosen(p.id)).length : 0;
  /* My pick is the look the engine ranked first, wherever it sits in the gallery. */
  const top = looks.reduce<(typeof looks)[number] | null>((best, l) => (l.rank !== undefined && (best?.rank === undefined || l.rank < best.rank) ? l : best), null);
  const isPick = top ? hero.id === top.id : index === 0;
  const eyebrow = isPick ? `My pick ${forOccasion(answers.occasion)}` : `${ROLE_LABEL[hero.role]} ${forOccasion(answers.occasion)}`;
  /* Opened from someone's shared link: show their looks and invite this visitor to get their own. */
  const fresh = href("", FRESH);
  const seeOnMe = () => gated("tryon", () => go("moment/tryon"));
  const none = selection.chosen.length === 0;
  /* A look composed from a store and my references: its picture shows the styling, not these exact pieces. */
  const visualized = hero.imageStatus === "mock" || hero.pieces.some((p) => p.reference || p.priceStatus === "live");

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
            alt={`${hero.title}, the ${ROLE_LABEL[hero.role].toLowerCase()} look ${forOccasion(answers.occasion)}`}
            reduced={reduced}
            aside={<Thumbs looks={looks} activeId={hero.id} onPick={(id) => show(id, undefined, "thumbnail")} reduced={reduced} vertical />}
            bleedDesktop
            swap={{ dir, drag: swipe.drag }}
            label={looks.length === 1 ? "Your look" : `Your ${looks.length} looks`}
            onKeyDown={onGalleryKey}
            overlay={
              <>
                {left > 0 ? (
                  <p className="a-print-note a-print-note-foot" aria-live="polite">
                    Original look, {left} {left === 1 ? "piece" : "pieces"} not included
                  </p>
                ) : visualized ? (
                  <p className="a-print-note a-print-note-foot">Styling visualization. Product details may vary.</p>
                ) : null}
                <button
                  type="button"
                  className="a-enlarge"
                  aria-label={`View ${hero.title} larger.${looks.length > 1 ? " Swipe or use the arrow keys for the other looks." : ""}`}
                  aria-haspopup="dialog"
                  {...swipe.handlers}
                />
                <span className="a-zoom-cue" aria-hidden="true">
                  <Search size={16} strokeWidth={1.5} />
                  <span className="a-zoom-cue-text a-transition">View larger</span>
                </span>
                {looks.length > 1 ? (
                  <div className="a-look-nav">
                    <button type="button" className="a-viewer-btn" onClick={() => step(-1, "arrow")} aria-disabled={!canPrev} aria-label="Previous look">
                      <ChevronLeft size={20} strokeWidth={1.5} />
                    </button>
                    <span className="a-label" aria-hidden="true">
                      {index + 1} of {looks.length}
                    </span>
                    <button type="button" className="a-viewer-btn" onClick={() => step(1, "arrow")} aria-disabled={!canNext} aria-label="Next look">
                      <ChevronRight size={20} strokeWidth={1.5} />
                    </button>
                  </div>
                ) : null}
                <div className="a-thumbs-index">
                  <Thumbs looks={looks} activeId={hero.id} onPick={(id) => show(id, undefined, "thumbnail")} reduced={reduced} vertical />
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
              {/* A friend's looks are here for an opinion, not a sale: no Check out, and passing them on is a quiet link. */}
              <TextButton onClick={() => setSharing(true)} className="text-[13px]">
                Forward
              </TextButton>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1 lg:gap-2">
              <PrimaryButton onClick={openBuy} disabled={none} aria-describedby={none ? CHECKOUT_REASON_ID : undefined}>
                Check out
                {none ? null : <span className="hint">{money(selection.total)}</span>}
              </PrimaryButton>
              <TextButton onClick={() => setSharing(true)}>Share</TextButton>
              <TextButton onClick={save} disabled={saved}>
                {saved ? "Saved" : "Save"}
              </TextButton>
              <TextButton onClick={() => setRestyling(true)} aria-label="Restyle, change an answer">
                Restyle
                <span className="hint">Change an answer</span>
              </TextButton>
              {saveFailed ? <SaveFailed /> : null}
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
            caption={response.status === "partial" ? `${captionFor(response, label.toLowerCase())} I found ${looks.length === 1 ? "one look" : `${looks.length} looks`} this time; Restyle to see others.` : captionFor(response, label.toLowerCase())}
            explain={!shared}
            after={shared ? null : <LookFeedback look={hero} response={response} />}
            personal={
              done ? null : shared ? (
                <div className="mt-6">
                  <p className="a-label text-[var(--muted)]">Shared with you</p>
                  <p className="a-note mt-3">A friend asked me to style them {forOccasion(answers.occasion)}. Tell me about your moment and I’ll style three looks for you.</p>
                </div>
              ) : (
                <section className="mt-6" aria-label="Make it yours">
                  <p className="a-label text-[var(--muted)]" aria-hidden="true">Make it yours</p>
                  <div className="a-personal mt-3">
                    <button type="button" onClick={seeOnMe} className="a-personal-card">
                      <span className="title">See it on me</span>
                      <span className="line">Preview this look on you.</span>
                      <PremiumMark show={!premium} price />
                    </button>
                    <button type="button" onClick={() => go("moment/you/item")} className="a-personal-card">
                      <span className="title">{answers.item ? "Change my piece" : "Use something I own"}</span>
                      <span className="line">{answers.item ? "Build the looks around another piece." : "Build the looks around a piece you have."}</span>
                    </button>
                  </div>
                </section>
              )
            }
          />
        </motion.div>
        {done ? <Completion kind={done} /> : null}
        <ShareSheet look={hero} eyebrow={eyebrow} occasion={label.toLowerCase()} recommendationId={response.recommendationId} open={sharing} onClose={() => setSharing(false)} />
        <RestyleSheet open={restyling} onClose={() => setRestyling(false)} />
        <PiecesSheet look={hero} open={sheet} onClose={() => setSheet(false)} selection={selection} />
      </Stage>
      {/* Outside the stage, so the column's entry motion never holds it while it opens. */}
      <LookViewer open={viewer} looks={looks} activeId={hero.id} onPick={(id, d) => show(id, d, "viewer")} onClose={() => setViewer(false)} reduced={reduced} />
    </>
  );
}
