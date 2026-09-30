/**
 * The DNA build, its plain-language result, and the "You" surface: portrait
 * on the right, the DNA and the appearance choice on the left, Redo.
 */
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { FITS, LIFESTYLES, SAMPLE_TONES, STAND_IN_PORTRAIT, STYLE_PRESETS, type ToneResult } from "../../../shared/catalog";
import { DNA_STAGES, useGuidedBuild } from "../../../shared/guided";
import type { SavedDna } from "../../../shared/store";
import { FRESH, useGated, useJourney } from "../../lib/journeyContext";
import { useDnaAnswers, useDnaPortrait } from "../../lib/dna";
import { dnaSpine } from "../../lib/spine";
import { Caption, LinkButton, PlusMark, PrimaryButton, TextButton } from "../../ui/controls";
import { BELOW, Frame, ProgressLine } from "../../ui/Frame";
import { ModeRadio } from "../../ui/Mode";
import { Stage } from "../../ui/Stage";
import { StageList } from "../../ui/StageList";

const UNDERTONE: Record<ToneResult["undertone"], string> = { cool: "Cool undertone", warm: "Warm undertone", neutral: "Neutral undertone" };
const CONTRAST: Record<ToneResult["contrast"], string> = { high: "strong contrast", medium: "medium contrast", low: "soft contrast" };

export function DnaBuild() {
  const { href, go, reduced } = useJourney();
  const dna = useDnaAnswers();
  const portrait = useDnaPortrait();
  const ready = Boolean(dna.face && dna.fit && dna.life);
  const build = useGuidedBuild(DNA_STAGES, ready, dna.taste.join(","), reduced);

  useEffect(() => {
    if (!build.done) return;
    const t = setTimeout(() => go("dna/result", {}, { replace: true }), reduced ? 0 : 400);
    return () => clearTimeout(t);
  }, [build.done, go, reduced]);

  if (!ready) return <Navigate to={href("dna/face")} replace />;

  return (
    <Stage
      spine={dnaSpine("dna", href)}
      back={href("dna/inspiration")}
      canvas={<Frame image={portrait} alt="Your portrait" reduced={reduced} belowHeight={BELOW.line} below={<ProgressLine progress={build.progress} label={build.current?.label ?? "Done"} reduced={reduced} />} />}
    >
      <h1 className="a-display">Reading you.</h1>
      <p className="sr-only" aria-live="polite">
        {build.current?.label ?? "Ready"}
      </p>
      <div className="mt-6">
        <StageList stages={DNA_STAGES} index={build.index} />
      </div>
    </Stage>
  );
}

function Swatches({ tones }: { tones: ToneResult }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-[13px] text-[var(--muted)]">Wear near your face</p>
        <ul className="flex gap-2" aria-label="Your palette">
          {tones.palette.map((hex) => (
            <li key={hex} className="a-swatch h-8 w-8" style={{ background: hex }} title={hex} />
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-2 text-[13px] text-[var(--muted)]">Leave these</p>
        <ul className="flex gap-2" aria-label="Colours to avoid">
          {tones.avoid.map((hex) => (
            <li key={hex} className="a-swatch h-8 w-8" style={{ background: hex }} title={hex} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function ToneSummary({ tones, fit, lifestyle, presetIds }: { tones: ToneResult; fit: string | null; lifestyle: string | null; presetIds: string[] }) {
  const fitLabel = FITS.find((f) => f.id === fit)?.label;
  const lifeLabel = LIFESTYLES.find((l) => l.id === lifestyle)?.label;
  const presets = presetIds.map((id) => STYLE_PRESETS.find((p) => p.id === id)?.label).filter(Boolean);
  const facts = [fitLabel && `${fitLabel} fit`, lifeLabel, presets.length ? presets.join(" and ") : null].filter(Boolean);
  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[40ch] leading-6">{tones.line}</p>
      <Swatches tones={tones} />
      <Caption className="hidden lg:block">
        {UNDERTONE[tones.undertone]}, {CONTRAST[tones.contrast]}. {facts.join(". ")}.
      </Caption>
    </div>
  );
}

export function DnaResult() {
  const { href, go, store, reduced, faceImage } = useJourney();
  const dna = useDnaAnswers();
  const portrait = useDnaPortrait();

  if (!dna.face || !dna.fit || !dna.life) return <Navigate to={href("dna/face")} replace />;

  const save = () => {
    const entry: SavedDna = {
      createdAt: new Date().toISOString(),
      tones: SAMPLE_TONES,
      fit: dna.fit,
      lifestyle: dna.life,
      presetIds: dna.taste,
      portrait: dna.face === "own" && faceImage ? faceImage : STAND_IN_PORTRAIT,
    };
    store.saveDna(entry);
    go("", { ...FRESH, face: null, done: "dna" });
  };

  return (
    <Stage
      spine={dnaSpine("dna", href)}
      back={href("dna/inspiration")}
      canvas={<Frame image={portrait} alt="Your portrait" reduced={reduced} />}
      actions={
        <div className="flex items-center gap-2">
          <PrimaryButton onClick={save}>Save my DNA</PrimaryButton>
          <TextButton onClick={() => go("dna/face", { ...FRESH, face: null })}>Redo</TextButton>
        </div>
      }
    >
      <h1 className="a-display">Your Style DNA.</h1>
      <div className="mt-6">
        <ToneSummary tones={SAMPLE_TONES} fit={dna.fit} lifestyle={dna.life} presetIds={dna.taste} />
      </div>
    </Stage>
  );
}

/** The You surface: the saved DNA, the appearance choice, and the ways to change them. */
export function DnaHome() {
  const { href, go, store, reduced, mode, setMode, user, signOut } = useJourney();
  const gated = useGated();
  const dna = store.dna;

  if (!dna) return <Navigate to={href("dna/face")} replace />;

  return (
    <Stage
      back={href("")}
      canvas={<Frame image={dna.portrait ?? STAND_IN_PORTRAIT} alt="Your portrait" reduced={reduced} />}
      actions={
        <div className="flex items-center gap-2">
          <LinkButton to={href("moment/occasion", FRESH)} variant="primary">
            Dress me for a moment
          </LinkButton>
          <TextButton onClick={() => gated("dna", () => go("dna/face", { ...FRESH, face: null }))}>
            Redo
            <PlusMark show={!user?.plus} />
          </TextButton>
        </div>
      }
    >
      <h1 className="a-display">Your Style DNA.</h1>
      <div className="mt-6">
        <ToneSummary tones={dna.tones} fit={dna.fit} lifestyle={dna.lifestyle} presetIds={dna.presetIds} />
      </div>
      <div className="mt-6 flex flex-col gap-3 border-t border-[var(--rule)] pt-6">
        <p className="text-[13px] text-[var(--muted)]">Appearance</p>
        <ModeRadio mode={mode} onMode={setMode} />
      </div>
      {user ? (
        <div className="mt-6 flex items-center justify-between gap-4 border-t border-[var(--rule)] pt-6">
          <p className="text-[15px] leading-5">
            {user.name}
            <span className="ml-2 text-[13px] text-[var(--muted)]">{user.plus ? "Plus" : user.email}</span>
          </p>
          <TextButton onClick={signOut}>Sign out</TextButton>
        </div>
      ) : null}
    </Stage>
  );
}
