/**
 * "More like this" and "Not for me" on each look. Not for me asks why in one tap (too formal, too
 * casual, the colours, the fit, the price, or one piece) and never more. Every answer is stored
 * against the customer, the request, the recommendation, the look and the piece, with the adapter
 * that made it. The confirmation says it was noted, never that Praxis has learned, and offers the one
 * change that answers the reason when there is one.
 */
import { useCallback, useState, useSyncExternalStore } from "react";
import { track } from "../../core/analytics";
import type { FeedbackReason, StylingResponse } from "../../core/contracts";
import { FEEDBACK_REASONS, feedbackStore } from "../../core/feedback";
import { anonymousId } from "../../core/identity";
import type { Look } from "../../shared/catalog";
import { useJourney, type Patch } from "../lib/journeyContext";
import { TextButton } from "./controls";

interface Props {
  look: Look;
  response: StylingResponse;
}

const NOTED: Record<FeedbackReason, string> = {
  too_formal: "it’s too formal",
  too_casual: "it’s too casual",
  wrong_colours: "the colours aren’t right",
  wrong_fit: "the fit isn’t yours",
  too_expensive: "it costs too much",
};

/** The change that answers a reason, when the journey has one. */
function nextStep(reason: FeedbackReason | undefined, vibe: string | null, spend: string | null): { label: string; path: string; patch: Patch } | null {
  if (reason === "too_formal" && vibe !== "RELAXED") return { label: "Show me something more relaxed", path: "moment/build", patch: { vibe: "RELAXED", hero: null } };
  if (reason === "too_casual" && vibe !== "SHARP") return { label: "Show me something sharper", path: "moment/build", patch: { vibe: "SHARP", hero: null } };
  if (reason === "too_expensive" && spend !== "SENSIBLE") return { label: "Change the budget", path: "moment/spend", patch: { restyle: "1" } };
  return null;
}

export function LookFeedback({ look, response }: Props) {
  const { user, answers, go } = useJourney();
  const latest = useSyncExternalStore(
    feedbackStore.subscribe,
    () => feedbackStore.latestFor(response.recommendationId, look.id),
    () => null,
  );
  const [asking, setAsking] = useState(false);

  const base = useCallback(
    () => ({
      anonymousSessionId: anonymousId(),
      userId: user?.id,
      recommendationId: response.recommendationId,
      requestId: response.requestId,
      outfitId: look.id,
      adapter: response.adapter,
    }),
    [user?.id, response, look.id],
  );

  const like = () => {
    feedbackStore.record({ ...base(), feedback: "more_like_this" });
    track("feedback_submitted", { recommendationId: response.recommendationId, outfitId: look.id, feedback: "more_like_this" });
  };

  const reject = () => {
    feedbackStore.record({ ...base(), feedback: "not_for_me" });
    track("recommendation_rejected", { recommendationId: response.recommendationId, outfitId: look.id, rank: look.rank ?? 0 });
    setAsking(true);
  };

  /** The reason replaces the bare "not for me", so one answer stays one record. */
  const because = (detail: { reason?: FeedbackReason; garmentId?: string }) => {
    if (latest && latest.feedback === "not_for_me" && !latest.reason && !latest.garmentId) feedbackStore.withdraw(latest.eventId);
    feedbackStore.record({ ...base(), feedback: "not_for_me", ...detail });
    track("feedback_submitted", { recommendationId: response.recommendationId, outfitId: look.id, feedback: "not_for_me", ...detail });
    setAsking(false);
  };

  const undo = () => {
    if (latest) feedbackStore.withdraw(latest.eventId);
    setAsking(false);
  };

  if (latest?.feedback === "more_like_this") {
    return (
      <div className="a-feedback" aria-live="polite">
        <p className="text-[15px] leading-6">Noted. You like this one.</p>
        <TextButton onClick={undo} className="-ml-2 self-start">
          Undo
        </TextButton>
      </div>
    );
  }

  if (latest?.feedback === "not_for_me" && asking) {
    const retail = look.pieces.filter((p) => !p.owned);
    return (
      <div className="a-feedback" aria-live="polite">
        <p className="text-[15px] leading-6">What’s not right?</p>
        <div className="a-chips mt-3" role="group" aria-label="What’s not right">
          {FEEDBACK_REASONS.map((r) => (
            <button key={r.id} type="button" className="a-chip" onClick={() => because({ reason: r.id })}>
              {r.label}
            </button>
          ))}
        </div>
        {retail.length > 0 ? (
          <>
            <p className="mt-4 text-[13px] leading-5 text-[var(--muted)]">Or one piece:</p>
            <div className="a-chips mt-2" role="group" aria-label="The piece that’s not right">
              {retail.map((p) => (
                <button key={p.id} type="button" className="a-chip" onClick={() => because({ garmentId: p.id })}>
                  {p.name}
                </button>
              ))}
            </div>
          </>
        ) : null}
        <TextButton onClick={() => setAsking(false)} className="-ml-2 mt-2 self-start">
          Skip
        </TextButton>
      </div>
    );
  }

  if (latest?.feedback === "not_for_me") {
    const piece = latest.garmentId ? look.pieces.find((p) => p.id === latest.garmentId)?.name.toLowerCase() : null;
    const line = latest.reason ? `Noted: ${NOTED[latest.reason]}.` : piece ? `Noted: not the ${piece}.` : "Noted. Not for you.";
    const step = nextStep(latest.reason, answers.vibe, answers.spend);
    return (
      <div className="a-feedback" aria-live="polite">
        <p className="text-[15px] leading-6">{line}</p>
        <div className="flex flex-wrap items-center gap-1">
          {step ? (
            <TextButton onClick={() => go(step.path, step.patch)} className="-ml-2">
              {step.label}
            </TextButton>
          ) : null}
          <TextButton onClick={undo} className={step ? "" : "-ml-2"}>
            Undo
          </TextButton>
        </div>
      </div>
    );
  }

  return (
    <div className="a-feedback-row" role="group" aria-label="Your view of this look">
      <TextButton onClick={like} className="-ml-2">
        More like this
      </TextButton>
      <TextButton onClick={reject}>Not for me</TextButton>
    </div>
  );
}
