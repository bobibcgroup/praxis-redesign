/**
 * The Style DNA journey reuses the one-question stage: face, fit,
 * lifestyle, inspiration. Answers ride in the URL (face, fit, life, taste).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { FITS, LIFESTYLES, STYLE_PRESETS, type FitId, type LifestyleId } from "../../../shared/catalog";
import { useJourney } from "../../lib/journeyContext";
import { useDnaAnswers, useDnaPortrait } from "../../lib/dna";
import { useAttachStream } from "../../lib/stream";
import { dnaSpine } from "../../lib/spine";
import { Capture } from "../../ui/Capture";
import { Caption, ChoiceList, Count, PrimaryButton, TextButton } from "../../ui/controls";
import { Frame } from "../../ui/Frame";
import { Stage } from "../../ui/Stage";

const ADVANCE_MS = 260;

export function DnaFace() {
  const { href, go, setFaceImage, reduced } = useJourney();
  const portrait = useDnaPortrait();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  useAttachStream(videoRef, stream);
  const onStream = useCallback((s: MediaStream | null) => setStream(s), []);

  return (
    <Stage
      spine={dnaSpine("face", href)}
      back={href("")}
      canvas={<Frame image={portrait} alt="Your portrait" liveRef={videoRef} live={Boolean(stream)} reduced={reduced} />}
      actions={
        portrait ? (
          <div className="flex items-center gap-2">
            <PrimaryButton onClick={() => go("dna/fit")}>Looks right</PrimaryButton>
            <TextButton onClick={() => go("dna/face", { face: null })}>Change the photo</TextButton>
          </div>
        ) : undefined
      }
    >
      <Count step={1} total={4} />
      <h1 className="a-display">Let’s find your colours.</h1>
      <Caption className="mt-4 max-w-[36ch]">A daylight photo with no filter shows me which colours suit you.</Caption>
      {!portrait ? (
        <div className="mt-6">
          <Capture
            videoRef={videoRef}
            onStream={onStream}
            onCapture={({ image, source }) => {
              setFaceImage(source === "own" ? image : null);
              go("dna/face", { face: source });
            }}
          />
        </div>
      ) : null}
    </Stage>
  );
}

export function DnaFit() {
  const { href, go, reduced } = useJourney();
  const dna = useDnaAnswers();
  const portrait = useDnaPortrait();
  const [pending, setPending] = useState<FitId | null>(null);

  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => go("dna/lifestyle", { fit: pending }), reduced ? 0 : ADVANCE_MS);
    return () => clearTimeout(t);
  }, [pending, go, reduced]);

  if (!dna.face) return <Navigate to={href("dna/face")} replace />;

  return (
    <Stage spine={dnaSpine("fit", href)} back={href("dna/face")} canvas={<Frame image={portrait} alt="Your portrait" reduced={reduced} />}>
      <Count step={2} total={4} />
      <h1 className="a-display">How do you like your clothes to fit?</h1>
      <div className="mt-6">
        <ChoiceList label="How do you like your clothes to fit?" options={FITS} value={pending ?? dna.fit} onChange={(id) => setPending(id)} />
      </div>
    </Stage>
  );
}

export function DnaLifestyle() {
  const { href, go, reduced } = useJourney();
  const dna = useDnaAnswers();
  const portrait = useDnaPortrait();
  const [pending, setPending] = useState<LifestyleId | null>(null);

  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => go("dna/inspiration", { life: pending }), reduced ? 0 : ADVANCE_MS);
    return () => clearTimeout(t);
  }, [pending, go, reduced]);

  if (!dna.fit) return <Navigate to={href("dna/face")} replace />;

  return (
    <Stage spine={dnaSpine("life", href)} back={href("dna/fit")} canvas={<Frame image={portrait} alt="Your portrait" reduced={reduced} />}>
      <Count step={3} total={4} />
      <h1 className="a-display">What does most of your week look like?</h1>
      <div className="mt-6">
        <ChoiceList label="What does most of your week look like?" options={LIFESTYLES} value={pending ?? dna.life} onChange={(id) => setPending(id)} />
      </div>
    </Stage>
  );
}

export function DnaInspiration() {
  const { href, go, reduced } = useJourney();
  const dna = useDnaAnswers();
  const portrait = useDnaPortrait();
  const [picked, setPicked] = useState<string[]>(dna.taste);

  if (!dna.life) return <Navigate to={href("dna/face")} replace />;

  const toggle = (id: string) => {
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : prev.length >= 2 ? [prev[1], id] : [...prev, id]));
  };

  const last = picked.length ? STYLE_PRESETS.find((p) => p.id === picked[picked.length - 1]) : null;

  return (
    <Stage
      spine={dnaSpine("taste", href)}
      back={href("dna/lifestyle")}
      canvas={<Frame image={last?.images[0] ?? portrait} alt={last ? `${last.label} look` : "Your portrait"} reduced={reduced} />}
      actions={<PrimaryButton onClick={() => go("dna/build", { taste: picked.length ? picked.join(",") : null })}>{picked.length ? "Build my Style DNA" : "Skip this"}</PrimaryButton>}
    >
      <Count step={4} total={4} />
      <h1 className="a-display">Which of these feel most like you?</h1>
      <Caption className="mt-4">Pick up to two.</Caption>
      <div role="group" aria-label="Inspiration" className="a-answers mt-6 grid grid-cols-2">
        {STYLE_PRESETS.map((p) => (
          <button key={p.id} type="button" aria-pressed={picked.includes(p.id)} onClick={() => toggle(p.id)} className="a-control">
            {p.label}
          </button>
        ))}
      </div>
    </Stage>
  );
}
