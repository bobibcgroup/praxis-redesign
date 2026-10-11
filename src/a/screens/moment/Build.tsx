/**
 * The build: the answers go to the recommendation service as one styling request, and the looks it
 * returns arrive on the canvas one by one under the question. The results open once the service has
 * answered and the short reveal has played.
 */
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import type { StylingResponse } from "../../../core/contracts";
import { MOMENT_STAGES, useGuidedBuild } from "../../../shared/guided";
import { useJourney } from "../../lib/journeyContext";
import { canvasImage, occasionLabel, resolveFromResponse } from "../../lib/looks";
import { momentSpine } from "../../lib/spine";
import { submitStyling, useStylingSpec } from "../../lib/styling";
import { BELOW, Frame, ProgressLine } from "../../ui/Frame";
import { Stage } from "../../ui/Stage";
import { Thumbs } from "../../ui/Thumbs";

export function Build() {
  const { answers, href, go, reduced, user } = useJourney();
  const spec = useStylingSpec();
  const [response, setResponse] = useState<StylingResponse | null>(null);
  const userId = user?.id;
  const build = useGuidedBuild(MOMENT_STAGES, Boolean(spec), answers.occasion ?? "", reduced);

  /* Every visit here is a new styling request for the answers as they stand. */
  useEffect(() => {
    if (!spec) return;
    let alive = true;
    setResponse(null);
    void submitStyling(spec, userId).then((r) => {
      if (alive) setResponse(r);
    });
    return () => {
      alive = false;
    };
  }, [spec, userId]);

  const resolved = useMemo(() => resolveFromResponse(response, answers.occasion, null), [response, answers.occasion]);

  useEffect(() => {
    if (!build.done || !response) return;
    const pick = response.outfits[0]?.outfitId ?? null;
    const t = setTimeout(() => go("moment/results", { hero: pick }, { replace: true }), reduced ? 0 : 500);
    return () => clearTimeout(t);
  }, [build.done, response, go, reduced]);

  if (!spec) return <Navigate to={href("moment/occasion")} replace />;

  const looks = resolved?.looks ?? [];
  const revealed = Math.min(looks.length, Math.floor(build.progress * (looks.length + 0.6)));
  const thumbs = looks.slice(0, revealed);
  const image = revealed > 0 ? looks[revealed - 1].image : canvasImage(answers);

  return (
    <Stage
      spine={momentSpine("looks", answers, href)}
      back={href("moment/spend")}
      band="looks"
      canvas={
        <Frame
          image={image}
          alt={`Your looks for ${occasionLabel(answers.occasion).toLowerCase()}`}
          night={answers.time === "NIGHT"}
          golden={answers.time === "SUNRISE" || answers.time === "SUNSET" ? answers.time : null}
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
      <h1 className="a-display">I’m putting your looks together.</h1>
      <p className="sr-only" aria-live="polite">
        {build.current?.label ?? "Ready"}
      </p>
    </Stage>
  );
}
