/**
 * The Style DNA build, its result, and the "You" surface. The build asks the colour analysis
 * service (src/core/vision.ts) about the photo and follows its real answer: an estimate, a photo it
 * cannot read (retake or skip), or a failure. The result shows each part as an estimate, the
 * customer's answer or their correction, and lets them change any of it before saving. Nothing here
 * stores the photo.
 */
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { track } from "../../../core/analytics";
import { consentFor, IMAGE_POLICIES, PROBLEM_COPY, type ImageProblem } from "../../../core/images";
import { applyAnalysis, confirmEstimates, createProfile, hasEstimates, type StyleProfile } from "../../../core/styleProfile";
import { imageServices, type ColourAnalysis } from "../../../core/vision";
import { STAND_IN_PORTRAIT } from "../../../shared/catalog";
import { FRESH, useGated, useJourney } from "../../lib/journeyContext";
import { useDnaAnswers, useDnaPortrait } from "../../lib/dna";
import { useDnaDraft } from "../../lib/dnaDraft";
import { imageStats } from "../../lib/image";
import { dnaSpine } from "../../lib/spine";
import { LinkButton, PremiumMark, PrimaryButton, TextButton } from "../../ui/controls";
import { BELOW, Frame, WorkingLine } from "../../ui/Frame";
import { ModeRadio } from "../../ui/Mode";
import { Stage } from "../../ui/Stage";
import { isSampleEstimate, StyleProfileEditor, StyleProfileView } from "../../ui/StyleProfileView";

type BuildState = "working" | ColourAnalysis["status"];

export function DnaBuild() {
  const { href, go, reduced, faceImage, params } = useJourney();
  const dna = useDnaAnswers();
  const portrait = useDnaPortrait();
  const [draft, setDraft] = useDnaDraft();
  const [state, setState] = useState<BuildState>("working");
  const [problem, setProblem] = useState<ImageProblem | undefined>();
  const [attempt, setAttempt] = useState(0);
  const retake = params.get("retake") === "1";
  const ownMissing = dna.face === "own" && !faceImage;
  const ready = Boolean(dna.face && !ownMissing && (retake ? draft : dna.fit && dna.life));

  /* One colour analysis per photo (and per Try again). */
  useEffect(() => {
    if (!ready || !dna.face) return;
    let alive = true;
    setState("working");
    const own = dna.face === "own" && faceImage ? faceImage : null;
    void (async () => {
      const stats = own ? await imageStats(own) : { width: 0, height: 0 };
      const consentVersion = own ? (consentFor("face_colour")?.version ?? "") : IMAGE_POLICIES.face_colour.consentVersion;
      const analysis = await imageServices().analyseColour({ ref: own ?? STAND_IN_PORTRAIT, category: "face_colour", width: stats.width, height: stats.height, consentVersion });
      if (!alive) return;
      track("style_dna_analysis_finished", { status: analysis.status });
      if (analysis.status === "completed") {
        const base = retake && draft ? draft : createProfile({ photo: dna.face === "own" ? "own" : "sample", fit: dna.fit ?? "REGULAR", week: dna.life ?? "MIXED", tastes: dna.taste });
        setDraft(applyAnalysis(base, analysis, dna.face === "own" ? "own" : "sample"));
      } else {
        setProblem(analysis.problem);
      }
      setState(analysis.status);
    })();
    return () => {
      alive = false;
    };
    // The analysis runs again only for a new photo or a new try.
  }, [ready, dna.face, faceImage, attempt]);

  useEffect(() => {
    if (state !== "completed") return;
    const t = setTimeout(() => go("dna/result", { retake: null }, { replace: true }), reduced ? 0 : 400);
    return () => clearTimeout(t);
  }, [state, go, reduced]);

  if (ownMissing) return <Navigate to={href("dna/face")} replace />;
  if (!ready) return <Navigate to={href("dna/face")} replace />;

  /** Without colours: the profile keeps the customer's answers and says colours are not set. */
  const skip = () => {
    const base = retake && draft ? draft : createProfile({ photo: "none", fit: dna.fit ?? "REGULAR", week: dna.life ?? "MIXED", tastes: dna.taste });
    setDraft(base);
    go("dna/result", { retake: null }, { replace: true });
  };
  const retakePhoto = () => go("dna/face", { face: null, retake: "1" });

  const unreadable = state === "unreadable";
  const failed = state === "failed" || state === "disabled";
  const title = unreadable ? "I couldn’t read your colours from that photo." : failed ? "I couldn’t work out your colours this time." : "I’ve got what I need.";
  const line = unreadable
    ? (problem ? PROBLEM_COPY[problem] : "Try another photo in daylight.")
    : failed
      ? "Your answers are kept. Try again, or carry on without colours and add them later."
      : state === "completed"
        ? "Your Style DNA is ready."
        : "Putting your Style DNA together.";

  return (
    <Stage
      spine={dnaSpine("dna", href)}
      back={href("dna/inspiration")}
      canvas={<Frame image={portrait} alt={dna.face === "own" ? "Your portrait" : "A sample portrait"} reduced={reduced} belowHeight={BELOW.line} below={unreadable || failed ? undefined : <WorkingLine working={state === "working"} label={line} reduced={reduced} />} />}
      actions={
        unreadable ? (
          <div className="flex flex-wrap items-center gap-2">
            <PrimaryButton onClick={retakePhoto}>Retake the photo</PrimaryButton>
            <TextButton onClick={skip}>Skip colours for now</TextButton>
          </div>
        ) : failed ? (
          <div className="flex flex-wrap items-center gap-2">
            {state === "failed" ? <PrimaryButton onClick={() => setAttempt((a) => a + 1)}>Try again</PrimaryButton> : null}
            <TextButton onClick={skip}>Carry on without colours</TextButton>
          </div>
        ) : undefined
      }
    >
      <h1 className="a-display">{title}</h1>
      <p className="mt-4 max-w-[40ch] leading-6 text-[var(--muted)]" aria-live="polite">
        {line}
      </p>
    </Stage>
  );
}

function intro(p: StyleProfile): string {
  if (p.photo === "none" || (!p.undertone.inferred && !p.contrast.inferred)) return "Here’s what you told me. Add your colours whenever you like.";
  if (isSampleEstimate(p)) return "Colour analysis is in preview, so these colours are an example to start from. Change anything that isn’t you.";
  return "Based on your photo, these shades may suit you particularly well. Change anything that isn’t you.";
}

export function DnaResult() {
  const { href, go, store, reduced } = useJourney();
  const dna = useDnaAnswers();
  const portrait = useDnaPortrait();
  const [draft, setDraft] = useDnaDraft();
  const [editing, setEditing] = useState(false);

  if (!draft) return <Navigate to={href(dna.face ? "dna/build" : "dna/face")} replace />;

  const estimates = hasEstimates(draft);
  const save = () => {
    const saved = estimates ? confirmEstimates(draft) : draft;
    if (estimates) track("style_dna_estimate_confirmed", {});
    store.saveDna(saved);
    setDraft(null);
    track("style_dna_completed", { photo: dna.face === "own" ? "own" : "sample", tasteCount: saved.tastes.length });
    go("", { ...FRESH, face: null, done: "dna", retake: null });
  };

  return (
    <Stage
      spine={dnaSpine("dna", href)}
      back={href("dna/inspiration")}
      canvas={<Frame image={portrait ?? STAND_IN_PORTRAIT} alt={dna.face === "own" ? "Your portrait" : "A sample portrait"} reduced={reduced} />}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <PrimaryButton onClick={save}>{estimates ? "Looks right" : "Save my Style DNA"}</PrimaryButton>
          <TextButton onClick={() => setEditing(true)}>Not quite right?</TextButton>
          <TextButton
            onClick={() => {
              setDraft(null);
              go("dna/face", { ...FRESH, face: null, retake: null });
            }}
          >
            Start again
          </TextButton>
        </div>
      }
    >
      <h1 className="a-display">Your Style DNA</h1>
      <p className="mt-4 max-w-[40ch] leading-6 text-[var(--muted)]">{intro(draft)}</p>
      <div className="mt-6">
        <StyleProfileView profile={draft} />
      </div>
      <StyleProfileEditor open={editing} onClose={() => setEditing(false)} profile={draft} onChange={setDraft} onRetake={() => go("dna/face", { face: null, retake: "1" })} />
    </Stage>
  );
}

/** The You surface: the saved Style DNA, changes to it, appearance and account. */
export function DnaHome() {
  const { href, go, store, reduced, mode, setMode, user, signOut, faceImage } = useJourney();
  const gated = useGated();
  const [, setDraft] = useDnaDraft();
  const [editing, setEditing] = useState(false);
  const dna = store.dna;

  if (!dna) return <Navigate to={href("dna/face")} replace />;

  return (
    <Stage
      back={href("")}
      canvas={<Frame image={faceImage ?? STAND_IN_PORTRAIT} alt={faceImage ? "Your portrait" : "A sample portrait"} reduced={reduced} />}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <LinkButton to={href("moment/occasion", FRESH)} variant="primary">
            Start a new look
          </LinkButton>
          <TextButton onClick={() => setEditing(true)}>Change my Style DNA</TextButton>
          <TextButton onClick={() => gated("dna", () => go("dna/face", { ...FRESH, face: null, retake: null }))}>
            Start again
            <PremiumMark show={!user?.premium} />
          </TextButton>
        </div>
      }
    >
      <h1 className="a-display">Your Style DNA</h1>
      {isSampleEstimate(dna) && hasEstimates(dna) ? <p className="mt-4 max-w-[40ch] leading-6 text-[var(--muted)]">The colours are an example while colour analysis is in preview. Change anything that isn’t you.</p> : null}
      <div className="mt-6">
        <StyleProfileView profile={dna} />
      </div>
      <div className="mt-6 flex flex-col gap-3 border-t border-[var(--rule)] pt-6">
        <p className="text-[13px] text-[var(--muted)]">Appearance</p>
        <ModeRadio mode={mode} onMode={setMode} />
      </div>
      <div className="mt-6 flex items-center justify-between gap-4 border-t border-[var(--rule)] pt-6">
        <p className="text-[15px] leading-5">Your data on this device</p>
        <LinkButton to={href("data")} variant="tertiary">
          See and delete
        </LinkButton>
      </div>
      {user ? (
        <div className="mt-6 flex items-center justify-between gap-4 border-t border-[var(--rule)] pt-6">
          <p className="text-[15px] leading-5">
            {user.name}
            <span className="ml-2 text-[13px] text-[var(--muted)]">{user.premium ? "Premium" : user.email}</span>
          </p>
          <TextButton onClick={signOut}>Sign out</TextButton>
        </div>
      ) : null}
      <StyleProfileEditor
        open={editing}
        onClose={() => setEditing(false)}
        profile={dna}
        onChange={(p) => store.saveDna(p)}
        onRetake={() => {
          setDraft(dna);
          go("dna/face", { face: null, retake: "1" });
        }}
      />
    </Stage>
  );
}
