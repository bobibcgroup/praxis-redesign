/**
 * See it on me. For the look chosen on the results (the URL's hero), one page walks through every
 * step: what try-on is, what happens to the photo and consent, the camera or an upload, the checks,
 * a preview to keep or retake, confirming, the request and its working state, and the answer, with
 * Try again, another photo, or back to the looks.
 *
 * The steps follow the state machine in src/core/tryon.ts and the request goes through the image
 * services, so connecting a real engine changes the adapter only. While no engine is connected the
 * answer says so plainly: no picture is ever made to look like the customer.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { track } from "../../../core/analytics";
import { anonymousId } from "../../../core/identity";
import { writeJson, session } from "../../../core/ids";
import { consentFor, IMAGE_POLICIES } from "../../../core/images";
import { buildTryOnRequest, canRetry, readTryOnPhoto, runTryOn, startStep, TRYON_SLOW_AFTER_MS, tryOnReducer, writeTryOnPhoto, type TryOnOutcome, type TryOnPhoto } from "../../../core/tryon";
import { tryOnAdapterInUse } from "../../../core/vision";
import { imageStats } from "../../lib/image";
import { useJourney } from "../../lib/journeyContext";
import { forOccasion, resolveFromResponse } from "../../lib/looks";
import { usePieceSelection } from "../../lib/selection";
import { momentSpine } from "../../lib/spine";
import { useAttachStream } from "../../lib/stream";
import { useStylingResponse, useStylingSpec } from "../../lib/styling";
import { Capture } from "../../ui/Capture";
import { Caption, LinkButton, PrimaryButton, QuietButton, TextButton } from "../../ui/controls";
import { Frame } from "../../ui/Frame";
import { PhotoConsent } from "../../ui/PhotoConsent";
import { PiecesSheet } from "../../ui/PiecesSheet";
import { Stage } from "../../ui/Stage";

/** The last try-on request in this tab, without the photo, so it can be traced. */
const REQUEST_KEY = "praxis_tryon_request";

const TIPS = ["Stand against a plain wall", "From the knees up, arms relaxed", "Good, even light, no filter"];

/** What went wrong, in words the customer can act on. */
function failureCopy(outcome: TryOnOutcome): { title: string; body: string } {
  if (outcome.status === "timed_out") return { title: "The try-on took too long.", body: "Nothing was made. Try again, or come back to it later." };
  switch (outcome.error?.code) {
    case "person_not_found":
      return { title: "I couldn’t find you in that photo.", body: "Try one where you’re standing, facing the camera, from the knees up." };
    case "consent_missing":
      return { title: "I need your agreement first.", body: "Read how the photo is used and agree, then try again." };
    case "photo_too_small":
      return { title: "That photo is too small.", body: "Try a larger one, or take one with the camera." };
    default:
      return { title: "The try-on didn’t work this time.", body: "Nothing was made and your photo is still here. Try again, or use another photo." };
  }
}

export function TryOn() {
  const { answers, href, go, reduced, user } = useJourney();
  const spec = useStylingSpec();
  const { response, loading } = useStylingResponse(spec);
  const resolved = useMemo(() => resolveFromResponse(response, answers.occasion, answers.hero), [response, answers.occasion, answers.hero]);
  const hero = resolved?.hero ?? null;
  const selection = usePieceSelection(hero);
  const [sheet, setSheet] = useState(false);
  const [state, dispatch] = useReducer(tryOnReducer, null, () => startStep(readTryOnPhoto()));
  const [checking, setChecking] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  useAttachStream(videoRef, stream);
  const onStream = useCallback((s: MediaStream | null) => setStream(s), []);
  const back = href("moment/results");

  /* Opening try-on for a look is counted once per look and set. */
  useEffect(() => {
    if (response && hero) track("tryon_opened", { recommendationId: response.recommendationId, outfitId: hero.id }, { once: `tryon:${response.recommendationId}:${hero.id}` });
  }, [response, hero]);

  /* Leaving the page stops a request on its way. */
  useEffect(() => () => controller.current?.abort(), []);

  /** Sends the confirmed photo with this look, as a new request with its own id. */
  const send = useCallback(
    (photo: TryOnPhoto, attempt: number, retry: boolean) => {
      if (!hero || !response) return;
      const adapter = tryOnAdapterInUse();
      const request = buildTryOnRequest({
        anonymousSessionId: anonymousId(),
        userId: user?.id,
        recommendationId: response.recommendationId,
        stylingRequestId: response.requestId,
        outfitId: hero.id,
        garmentIds: hero.pieces.map((p) => p.id),
        photo,
        adapter: { id: adapter.id, version: adapter.version },
      });
      controller.current?.abort();
      const c = new AbortController();
      controller.current = c;
      dispatch(retry ? { type: "RETRY", requestId: request.requestId } : { type: "CONFIRM", requestId: request.requestId });
      dispatch({ type: "STARTED" });
      writeJson(session(), REQUEST_KEY, { request, outcome: null });
      track("tryon_submitted", { requestId: request.requestId, outfitId: hero.id, adapter: `${adapter.id}/${adapter.version}`, attempt });
      const slow = setTimeout(() => dispatch({ type: "SLOW" }), TRYON_SLOW_AFTER_MS);
      void runTryOn(request, photo, { signal: c.signal }).then((outcome) => {
        clearTimeout(slow);
        // The stored record keeps the answer, never the photo or the picture.
        writeJson(session(), REQUEST_KEY, { request, outcome: { ...outcome, image: outcome.image ? { ...outcome.image, storageRef: undefined } : undefined } });
        track("tryon_answered", { requestId: request.requestId, status: outcome.status, code: outcome.error?.code, durationMs: outcome.durationMs });
        if (!c.signal.aborted || outcome.status === "cancelled") dispatch({ type: "ANSWERED", outcome });
      });
    },
    [hero, response, user?.id],
  );

  const retake = useCallback(() => {
    controller.current?.abort();
    writeTryOnPhoto(null);
    track("photo_deleted", { category: "try_on" });
    dispatch({ type: "RETAKE" });
  }, []);

  const onCaptured = useCallback(async (image: string, via: "camera" | "upload") => {
    setChecking(true);
    const stats = await imageStats(image);
    setChecking(false);
    const photo: TryOnPhoto = { image, source: via, width: stats.width, height: stats.height, consentVersion: IMAGE_POLICIES.try_on.consentVersion, takenAt: new Date().toISOString() };
    writeTryOnPhoto(photo);
    track("tryon_photo_ready", { source: via });
    dispatch({ type: "PHOTO", photo });
  }, []);

  if (!spec) return <Navigate to={href("")} replace />;
  if (loading) {
    return (
      <Stage spine={momentSpine("looks", answers, href)} back={back} band="looks" canvas={<Frame image={null} alt="" reduced={reduced} />}>
        <p role="status" className="a-display">
          Bringing your look back.
        </p>
      </Stage>
    );
  }
  if (!response || !resolved || !hero) return <Navigate to={back} replace />;

  const forThe = forOccasion(answers.occasion);
  const note = (text: string) => (
    <p className="a-print-note" aria-hidden="true">
      {text}
    </p>
  );
  const lookOnModel = <Frame image={hero.image} alt={`${hero.title} ${forThe}, on a model`} reduced={reduced} overlay={note("The look you chose, on a model")} />;
  const photoFrame = (photo: TryOnPhoto, caption: string) => <Frame image={photo.image} alt="Your photo" reduced={reduced} overlay={note(caption)} />;

  let canvas = lookOnModel;
  let actions: ReactNode = null;
  let content: ReactNode = null;
  const eyebrow = <p className="a-label mb-3 text-[var(--muted)]">See it on me</p>;

  switch (state.step) {
    case "explain":
      content = (
        <>
          {eyebrow}
          <h1 className="a-display">See this look on you.</h1>
          <p className="mt-4 max-w-[40ch] leading-6">Give me one photo of you, and I’ll show the {hero.title} look on it, so you can judge the fit and the colours before you buy.</p>
          <Caption className="mt-4 max-w-[40ch]">Try-on isn’t switched on yet. I’ll take you through each step and tell you plainly what happens; no picture is made to look like you.</Caption>
        </>
      );
      actions = (
        <div className="flex flex-wrap items-center gap-2">
          <PrimaryButton
            onClick={() => {
              dispatch({ type: "CONTINUE" });
              if (consentFor("try_on")) dispatch({ type: "CONSENTED" });
            }}
          >
            Continue
          </PrimaryButton>
          <LinkButton to={back} variant="tertiary">
            Back to your looks
          </LinkButton>
        </div>
      );
      break;

    case "consent":
      content = (
        <>
          {eyebrow}
          <h1 className="a-display">Before you add a photo.</h1>
          <div className="mt-6">
            <PhotoConsent category="try_on" declineLabel="Not now" onAgree={() => dispatch({ type: "CONSENTED" })} onDecline={() => go("moment/results")} />
          </div>
        </>
      );
      break;

    case "capture":
      canvas = stream ? <Frame image={null} alt="Camera preview" liveRef={videoRef} live reduced={reduced} /> : lookOnModel;
      content = (
        <>
          {eyebrow}
          <h1 className="a-display">Add a photo of you.</h1>
          <ul className="mt-4 flex flex-col gap-1 text-[15px] leading-6 text-[var(--muted)]">
            {TIPS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <div className="mt-6">
            <Capture
              category="try_on"
              allowSample={false}
              consented
              cameraTip="Stand back so I can see you from the knees up, then take the photo."
              videoRef={videoRef}
              onStream={onStream}
              onCapture={({ image, via }) => void onCaptured(image, via ?? "upload")}
            />
          </div>
          {checking ? (
            <p role="status" className="mt-4 text-[15px] leading-6 text-[var(--muted)]">
              Checking your photo.
            </p>
          ) : null}
        </>
      );
      actions = (
        <LinkButton to={back} variant="tertiary">
          Back to your looks
        </LinkButton>
      );
      break;

    case "preview":
      canvas = photoFrame(state.photo, "Your photo, kept in this tab only");
      content = (
        <>
          {eyebrow}
          <h1 className="a-display">Is this photo right?</h1>
          <p className="mt-4 max-w-[40ch] leading-6">It’s large and bright enough. Use it to try on the {hero.title} look, or take another.</p>
        </>
      );
      actions = (
        <div className="flex flex-wrap items-center gap-2">
          <PrimaryButton onClick={() => send(state.photo, 1, false)}>Use this photo</PrimaryButton>
          <TextButton onClick={retake}>Retake</TextButton>
          <LinkButton to={back} variant="tertiary">
            Back to your looks
          </LinkButton>
        </div>
      );
      break;

    case "submitted":
    case "processing":
      canvas = photoFrame(state.photo, "Your photo, with the look you chose");
      content = (
        <>
          {eyebrow}
          <h1 className="a-display">Sending your try-on.</h1>
          <p role="status" className="mt-4 max-w-[40ch] leading-6 text-[var(--muted)]">
            {state.step === "processing" && state.slow ? "This is taking longer than usual. You can wait, or stop and come back to it." : "Working on it."}
          </p>
        </>
      );
      actions = (
        <QuietButton
          onClick={() => {
            controller.current?.abort();
            dispatch({ type: "CANCEL" });
          }}
        >
          Stop
        </QuietButton>
      );
      break;

    case "cancelled":
      canvas = photoFrame(state.photo, "Your photo, kept in this tab only");
      content = (
        <>
          {eyebrow}
          <h1 className="a-display">Stopped.</h1>
          <p className="mt-4 max-w-[40ch] leading-6">Nothing was made. Your photo is still here if you want to send it again.</p>
        </>
      );
      actions = (
        <div className="flex flex-wrap items-center gap-2">
          <PrimaryButton onClick={() => send(state.photo, 1, false)}>Send again</PrimaryButton>
          <TextButton onClick={retake}>Use another photo</TextButton>
          <LinkButton to={back} variant="tertiary">
            Back to your looks
          </LinkButton>
        </div>
      );
      break;

    case "result": {
      const { outcome } = state;
      const lookActions = (
        <>
          <TextButton onClick={() => setSheet(true)} disabled={selection.chosen.length === 0}>
            Check out
          </TextButton>
          <LinkButton to={back} variant="tertiary">
            Back to your looks
          </LinkButton>
        </>
      );
      if (outcome.status === "ready" && outcome.image?.storageRef) {
        canvas = <Frame image={outcome.image.storageRef} alt={`${hero.title}, shown on your photo`} reduced={reduced} overlay={note("Made by try-on from your photo")} />;
        content = (
          <>
            {eyebrow}
            <h1 className="a-display">Here it is on you.</h1>
            <p className="mt-4 max-w-[40ch] leading-6">This is the {hero.title} look on your photo. Judge the colours and the proportions; the fit of each piece comes from its size.</p>
          </>
        );
        actions = (
          <div className="flex flex-wrap items-center gap-2">
            <QuietButton onClick={retake}>Use another photo</QuietButton>
            {lookActions}
          </div>
        );
      } else if (outcome.status === "not_connected") {
        canvas = photoFrame(state.photo, "Your photo. No picture was made from it");
        content = (
          <>
            {eyebrow}
            <h1 className="a-display">Try-on isn’t switched on yet.</h1>
            <p className="mt-4 max-w-[40ch] leading-6">I sent the {hero.title} look with your photo, and the try-on service answered that it can’t make pictures yet. Nothing was made to look like you.</p>
          </>
        );
        actions = (
          <div className="flex flex-wrap items-center gap-2">
            <LinkButton to={back} variant="primary">
              Back to your looks
            </LinkButton>
            <TextButton onClick={retake}>Use another photo</TextButton>
            <TextButton onClick={() => setSheet(true)} disabled={selection.chosen.length === 0}>
              Check out
            </TextButton>
          </div>
        );
      } else {
        const copy = failureCopy(outcome);
        canvas = photoFrame(state.photo, "Your photo, kept in this tab only");
        content = (
          <>
            {eyebrow}
            <h1 className="a-display">{copy.title}</h1>
            <p role="alert" className="mt-4 max-w-[40ch] leading-6">
              {copy.body}
            </p>
          </>
        );
        actions = (
          <div className="flex flex-wrap items-center gap-2">
            {canRetry(state) ? <PrimaryButton onClick={() => send(state.photo, state.attempt + 1, true)}>Try again</PrimaryButton> : null}
            <TextButton onClick={retake}>Use another photo</TextButton>
            {lookActions}
          </div>
        );
      }
      break;
    }
  }

  return (
    <Stage spine={momentSpine("looks", answers, href)} back={back} band="looks" canvas={canvas} actions={actions}>
      <div data-tryon-step={state.step}>{content}</div>
      <PiecesSheet look={hero} open={sheet} onClose={() => setSheet(false)} selection={selection} />
    </Stage>
  );
}
