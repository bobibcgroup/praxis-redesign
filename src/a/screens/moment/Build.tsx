/**
 * The build: the answers go to the recommendation service as one styling request, and this screen
 * follows that request through its real states (src/core/processing.ts). Nothing is timed to look
 * busy: the line moves while the service works, the wording changes only when the state does, and
 * the looks it returns arrive under the print before the results open. When the service fails,
 * answers with nothing, or takes too long, the customer is told so here, with their answers kept.
 */
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { MAX_ATTEMPTS, type ProcessingState } from "../../../core/processing";
import { FRESH, useJourney } from "../../lib/journeyContext";
import { canvasImage, occasionLabel, resolveFromResponse } from "../../lib/looks";
import { momentSpine } from "../../lib/spine";
import { useStylingRun, useStylingSpec } from "../../lib/styling";
import { LinkButton, PrimaryButton, TextButton } from "../../ui/controls";
import { BELOW, Frame, WorkingLine } from "../../ui/Frame";
import { RestyleSheet } from "../../ui/RestyleSheet";
import { Stage } from "../../ui/Stage";
import { Thumbs } from "../../ui/Thumbs";

/** Between one look arriving under the print and the next. */
const REVEAL_MS = 350;

function wording(state: ProcessingState): { title: string; line: string } {
  switch (state.status) {
    case "delayed":
      return { title: "I’m putting your looks together.", line: "This is taking a little longer than usual." };
    case "completed":
    case "partial":
      if (state.status === "partial") {
        const n = state.response.outfits.length;
        return { title: "I’m putting your looks together.", line: `I found ${n === 1 ? "one look" : n === 2 ? "two looks" : `${n} looks`} for this.` };
      }
      return { title: "I’m putting your looks together.", line: "Your looks are ready." };
    case "empty":
      return { title: "I couldn’t find looks for all of that.", line: "Try another budget or feel, and I’ll look again." };
    case "failed":
      return { title: "I couldn’t put your looks together this time.", line: "Your answers are kept. Try again, or change one of them." };
    case "retry_exhausted":
      return { title: "I still can’t put your looks together.", line: "Your answers are kept. Try again in a little while, or change one of them." };
    case "cancelled":
      return { title: "I’ve stopped.", line: "Your answers are kept." };
    default:
      return { title: "I’m putting your looks together.", line: "Choosing pieces for your answers." };
  }
}

export function Build() {
  const { answers, href, go, reduced, user } = useJourney();
  const spec = useStylingSpec();
  const { state, retry, cancel, restart } = useStylingRun(spec, user?.id);
  const [restyling, setRestyling] = useState(false);
  const [revealed, setRevealed] = useState(0);

  const response = state.status === "completed" || state.status === "partial" ? state.response : null;
  const resolved = useMemo(() => resolveFromResponse(response, answers.occasion, null), [response, answers.occasion]);
  const looks = resolved?.looks ?? [];

  /* The looks that came back arrive one by one, then the results open on the pick. */
  useEffect(() => {
    if (!response) {
      setRevealed(0);
      return;
    }
    if (revealed < looks.length) {
      const t = setTimeout(() => setRevealed((n) => n + 1), reduced ? 0 : REVEAL_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => go("moment/results", { hero: response.outfits[0]?.outfitId ?? null }, { replace: true }), reduced ? 0 : 500);
    return () => clearTimeout(t);
  }, [response, revealed, looks.length, go, reduced]);

  if (!spec) return <Navigate to={href("")} replace />;

  const working = state.status === "idle" || state.status === "validating" || state.status === "submitted" || state.status === "processing" || state.status === "delayed" || state.status === "retry_requested";
  const { title, line } = wording(state);
  const thumbs = looks.slice(0, revealed);
  const image = revealed > 0 ? looks[revealed - 1].image : canvasImage(answers);
  const stuck = state.status === "failed" || state.status === "retry_exhausted" || state.status === "empty" || state.status === "cancelled";

  const actions = working ? (
    <TextButton onClick={cancel}>Cancel</TextButton>
  ) : state.status === "failed" ? (
    <div className="flex flex-wrap items-center gap-2">
      <PrimaryButton onClick={retry}>Try again</PrimaryButton>
      <TextButton onClick={() => setRestyling(true)}>Change my answers</TextButton>
    </div>
  ) : state.status === "cancelled" ? (
    <div className="flex flex-wrap items-center gap-2">
      <PrimaryButton onClick={restart}>Show me my looks</PrimaryButton>
      <TextButton onClick={() => setRestyling(true)}>Change my answers</TextButton>
    </div>
  ) : stuck ? (
    <div className="flex flex-wrap items-center gap-2">
      <PrimaryButton onClick={() => setRestyling(true)}>Change my answers</PrimaryButton>
      <LinkButton to={href("", FRESH)} variant="tertiary">
        Start a new look
      </LinkButton>
    </div>
  ) : undefined;

  return (
    <Stage
      spine={momentSpine("looks", answers, href)}
      back={href("moment/spend")}
      band="looks"
      actions={actions}
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
              {stuck ? null : <WorkingLine working={working} label={line} reduced={reduced} />}
              <Thumbs looks={thumbs} activeId={null} reduced={reduced} />
            </>
          }
        />
      }
    >
      <h1 className="a-display">{title}</h1>
      <p className="mt-4 max-w-[40ch] leading-6 text-[var(--muted)]" aria-live="polite">
        {line}
      </p>
      {state.status === "failed" && state.attempt > 1 ? (
        <p className="mt-2 text-[13px] leading-5 text-[var(--muted)]">
          Try {state.attempt} of {MAX_ATTEMPTS}.
        </p>
      ) : null}
      <RestyleSheet open={restyling} onClose={() => setRestyling(false)} />
    </Stage>
  );
}
