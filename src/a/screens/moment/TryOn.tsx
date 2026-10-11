/**
 * Try-on, in preview. Showing a look on the customer needs an image service that is not switched on,
 * so this page never pretends: it shows the look on a model, says so on the picture and in the column,
 * and keeps the look's pieces, Check out and Save. The other looks stay one tap away.
 */
import { usePieceSelection } from "../../lib/selection";
import { useCallback, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { track } from "../../../core/analytics";
import { anonymousId } from "../../../core/identity";
import { useJourney } from "../../lib/journeyContext";
import { forOccasion, occasionLabel, resolveFromResponse, ROLE_LABEL } from "../../lib/looks";
import { momentSpine } from "../../lib/spine";
import { useStylingResponse, useStylingSpec } from "../../lib/styling";
import { Completion, CompletionActions } from "../../ui/Completion";
import { LinkButton, PrimaryButton, TextButton } from "../../ui/controls";
import { BELOW, Frame, FrameCaption } from "../../ui/Frame";
import { CHECKOUT_REASON_ID, LookDetails } from "../../ui/LookDetails";
import { PiecesSheet } from "../../ui/PiecesSheet";
import { Stage } from "../../ui/Stage";
import { Thumbs } from "../../ui/Thumbs";

export function TryOn() {
  const { answers, href, go, store, reduced, user } = useJourney();
  const spec = useStylingSpec();
  const { response, loading } = useStylingResponse(spec);
  const resolved = useMemo(() => resolveFromResponse(response, answers.occasion, answers.hero), [response, answers.occasion, answers.hero]);
  const [sheet, setSheet] = useState(false);
  const hero = resolved?.hero ?? null;
  const selection = usePieceSelection(hero);
  const label = occasionLabel(answers.occasion);

  const save = useCallback(() => {
    if (!hero || !response) return;
    store.saveLook(hero, label, { owner: { anonymousSessionId: anonymousId(), userId: user?.id }, recommendationId: response.recommendationId, requestId: response.requestId, inputKey: response.inputKey });
    track("look_saved", { recommendationId: response.recommendationId, outfitId: hero.id, signedIn: Boolean(user) });
    go("moment/tryon", { done: "saved" }, { replace: true });
  }, [hero, response, label, store, user, go]);
  const openBuy = useCallback(() => {
    if (hero && selection.chosen.length > 0) track("checkout_initiated", { recommendationId: response?.recommendationId, outfitId: hero.id, pieces: selection.chosen.length, total: selection.total, priceStatus: hero.priceStatus ?? "example" });
    setSheet(true);
  }, [hero, selection, response]);

  if (!spec) return <Navigate to={href("moment/occasion")} replace />;
  if (loading) return null;
  if (!response || !resolved || !hero) return <Navigate to={href("moment/results")} replace />;

  const { looks } = resolved;
  const saved = store.looks.some((s) => s.dedupeKey === `${hero.id}|${response.inputKey}`);
  const done = answers.done;

  return (
    <Stage
      spine={momentSpine("looks", answers, href)}
      back={href("moment/results")}
      band="looks"
      canvas={
        <Frame
          book
          image={hero.image}
          alt={`${hero.title} ${forOccasion(answers.occasion)}, on a model`}
          reduced={reduced}
          belowHeight={BELOW.thumbsCaption}
          below={
            <>
              <Thumbs looks={looks} activeId={hero.id} onPick={(id) => go("moment/tryon", { hero: id }, { replace: true })} reduced={reduced} />
              <FrameCaption>On a model, not you. Try-on is in preview.</FrameCaption>
            </>
          }
        />
      }
      actions={
        done ? (
          <CompletionActions />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <PrimaryButton onClick={openBuy} disabled={selection.chosen.length === 0} aria-describedby={selection.chosen.length === 0 ? CHECKOUT_REASON_ID : undefined}>
              Check out
            </PrimaryButton>
            <TextButton onClick={save} disabled={saved}>
              {saved ? "Saved" : "Save"}
            </TextButton>
            <LinkButton to={href("moment/results")} variant="tertiary" className="lg:ml-auto">
              Back to looks
            </LinkButton>
          </div>
        )
      }
    >
      <LookDetails
        look={hero}
        eyebrow={done ? `${ROLE_LABEL[hero.role]} ${forOccasion(answers.occasion)}` : "Try-on preview"}
        compact={done !== null}
        selection={selection}
        caption={hero.priceStatus === "live" ? undefined : "Pieces and prices are for illustration."}
        personal={
          done ? null : (
            <p className="mt-6 max-w-[40ch] text-[15px] leading-6 text-[var(--muted)]">
              When try-on is ready, I’ll show this look on a photo of you. Until then, this is the look on a model.
            </p>
          )
        }
      />
      {done ? <Completion kind={done} /> : null}
      <PiecesSheet look={hero} open={sheet} onClose={() => setSheet(false)} selection={selection} />
    </Stage>
  );
}
