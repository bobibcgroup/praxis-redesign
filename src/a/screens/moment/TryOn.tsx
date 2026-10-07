/**
 * Try-on: the same print the user has been watching; after the guided
 * stages, a wipe from left to right reveals the rendering of him in the
 * look. The three thumbnails stay; tapping one re-runs the try-on for it.
 */
import { useCallback, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Navigate } from "react-router-dom";
import { STAND_IN_PORTRAIT } from "../../../shared/catalog";
import { TRYON_STAGES, useGuidedBuild } from "../../../shared/guided";
import { useGateAction, useGated, useJourney } from "../../lib/journeyContext";
import { occasionLabel, resolveLooks, ROLE_LABEL } from "../../lib/looks";
import { momentSpine } from "../../lib/spine";
import { Completion, CompletionActions } from "../../ui/Completion";
import { Caption, LinkButton, PrimaryButton, TextButton } from "../../ui/controls";
import { BELOW, Frame, FrameCaption, ProgressLine } from "../../ui/Frame";
import { LookDetails } from "../../ui/LookDetails";
import { PiecesSheet } from "../../ui/PiecesSheet";
import { Stage } from "../../ui/Stage";
import { StageList } from "../../ui/StageList";
import { Thumbs } from "../../ui/Thumbs";

export function TryOn() {
  const { answers, href, go, ownedItem, store, reduced } = useJourney();
  const gated = useGated();
  const resolved = useMemo(() => resolveLooks(answers, ownedItem), [answers, ownedItem]);
  const ready = Boolean(answers.spend && resolved);
  const build = useGuidedBuild(TRYON_STAGES, ready, answers.hero ?? "", reduced);
  const [sheet, setSheet] = useState(false);
  const hero = resolved?.hero ?? null;
  const label = occasionLabel(answers.occasion);
  const rendering = STAND_IN_PORTRAIT;

  const save = useCallback(() => {
    if (!hero) return;
    store.saveLook(hero, label, rendering);
    go("moment/tryon", { done: "saved" }, { replace: true });
  }, [hero, label, rendering, store, go]);
  const openBuy = useCallback(() => setSheet(true), []);
  useGateAction("save", save);
  useGateAction("buy", openBuy);

  if (!ready || !resolved || !hero) return <Navigate to={href("moment/occasion")} replace />;

  const { looks } = resolved;
  const saved = store.looks.some((s) => s.look.id === hero.id && s.occasionLabel === label && s.tryOnImage);
  const done = answers.done;

  const overlay = (
    <motion.div
      aria-hidden={!build.done}
      initial={false}
      animate={reduced ? { opacity: build.done ? 1 : 0 } : { clipPath: build.done ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)" }}
      transition={reduced ? { duration: 0.2 } : { duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
      className="absolute inset-0"
      style={reduced ? undefined : { clipPath: "inset(0 100% 0 0)" }}
    >
      <img src={rendering} alt={`How ${hero.title} looks on you`} className="h-full w-full scale-[1.08] object-cover object-[50%_18%]" draggable={false} />
    </motion.div>
  );

  return (
    <Stage
      spine={momentSpine("looks", answers, href)}
      back={href("moment/results")}
      band="looks"
      canvas={
        <Frame
          image={hero.image}
          alt={`${hero.title} for ${label.toLowerCase()}`}
          overlay={overlay}
          reduced={reduced}
          belowHeight={build.done ? BELOW.thumbsCaption : BELOW.thumbsLine}
          below={
            <>
              {!build.done ? <ProgressLine progress={build.progress} label={build.current?.label ?? "Done"} reduced={reduced} /> : null}
              <Thumbs looks={looks} activeId={hero.id} onPick={(id) => go("moment/tryon", { hero: id }, { replace: true })} reduced={reduced} />
              {build.done ? (
                <FrameCaption>
                  Here’s how it looks on you
                  <span className="block lg:hidden">A rendering, not a photograph.</span>
                </FrameCaption>
              ) : null}
            </>
          }
        />
      }
      actions={
        !build.done ? undefined : done ? (
          <CompletionActions />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <PrimaryButton onClick={() => gated("buy", openBuy)}>Get the pieces</PrimaryButton>
            <TextButton onClick={() => gated("save", save)} disabled={saved}>
              {saved ? "Saved" : "Save"}
            </TextButton>
            <LinkButton to={href("moment/results")} variant="tertiary" className="lg:ml-auto">
              Back to looks
            </LinkButton>
          </div>
        )
      }
    >
      {!build.done ? (
        <>
          <h1 className="a-display">Let me show you.</h1>
          <p className="sr-only" aria-live="polite">
            {build.current?.label ?? "Finishing the look"}
          </p>
          <div className="mt-6">
            <StageList stages={TRYON_STAGES} index={build.index} />
          </div>
        </>
      ) : (
        <>
          <LookDetails look={hero} eyebrow={done ? `${ROLE_LABEL[hero.role]} for ${label.toLowerCase()}` : "Here’s how it looks on you"} compact={done !== null} onOpenPieces={() => setSheet(true)} />
          {done ? <Completion kind={done} /> : <Caption className="mt-4 hidden lg:block">A rendering, not a photograph. Use it to get a feel for the look. Fit may vary by piece.</Caption>}
          <PiecesSheet
            look={hero}
            open={sheet}
            onClose={() => setSheet(false)}
            mode="buy"
            onReserve={() => {
              setSheet(false);
              go("moment/tryon", { done: "reserved" }, { replace: true });
            }}
          />
        </>
      )}
    </Stage>
  );
}
