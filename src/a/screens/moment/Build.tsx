/**
 * The guided build happens on the canvas: named stages under the question,
 * a 2 px line of progress under the print, the three thumbnails arriving one by one.
 */
import { useEffect, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { MOMENT_STAGES, useGuidedBuild } from "../../../shared/guided";
import { useJourney } from "../../lib/journeyContext";
import { canvasImage, occasionLabel, resolveLooks } from "../../lib/looks";
import { momentSpine } from "../../lib/spine";
import { BELOW, Frame, ProgressLine } from "../../ui/Frame";
import { Stage } from "../../ui/Stage";
import { StageList } from "../../ui/StageList";
import { Thumbs } from "../../ui/Thumbs";

export function Build() {
  const { answers, href, go, ownedItem, reduced } = useJourney();
  const resolved = useMemo(() => resolveLooks(answers, ownedItem), [answers, ownedItem]);
  const ready = Boolean(answers.spend && resolved);
  const build = useGuidedBuild(MOMENT_STAGES, ready, answers.occasion ?? "", reduced);

  useEffect(() => {
    if (!build.done || !resolved) return;
    const t = setTimeout(() => go("moment/results", { hero: resolved.hero.id }, { replace: true }), reduced ? 0 : 500);
    return () => clearTimeout(t);
  }, [build.done, resolved, go, reduced]);

  if (!ready || !resolved) return <Navigate to={href("moment/occasion")} replace />;

  const revealed = Math.min(3, Math.floor(build.progress * 3.6));
  const thumbs = resolved.looks.slice(0, revealed);
  const image = revealed > 0 ? resolved.looks[revealed - 1].image : canvasImage(answers, null);

  return (
    <Stage
      spine={momentSpine("looks", answers, href)}
      back={href("moment/you")}
      band="looks"
      canvas={
        <Frame
          image={image}
          alt={`${occasionLabel(answers.occasion)} look forming`}
          night={answers.time === "NIGHT"}
          reduced={reduced}
          belowHeight={BELOW.thumbsLine}
          below={
            <>
              <ProgressLine progress={build.progress} label={build.current?.label ?? "Done"} reduced={reduced} />
              <Thumbs looks={thumbs} activeId={null} reduced={reduced} />
            </>
          }
        />
      }
    >
      <h1 className="a-display">Three looks for {occasionLabel(answers.occasion).toLowerCase()}, forming.</h1>
      <p className="sr-only" aria-live="polite">
        {build.current?.label ?? "Ready"}
      </p>
      <div className="mt-6">
        <StageList stages={MOMENT_STAGES} index={build.index} />
      </div>
    </Stage>
  );
}
