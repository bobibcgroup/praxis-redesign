/**
 * Making the looks personal, reached from the results: add your face (then the try-on),
 * or add one item (then the looks rebuild around it). Each lives on its own route so Back works.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useJourney, type Slot } from "../../lib/journeyContext";
import { canvasImage, occasionLabel, resolveLooks, SAMPLE_ITEMS, SLOT_LABEL } from "../../lib/looks";
import { momentSpine } from "../../lib/spine";
import { fileToDataUrl, shrinkImage } from "../../lib/image";
import { ChoiceList, QuietButton, TextButton } from "../../ui/controls";
import { Capture } from "../../ui/Capture";
import { Frame } from "../../ui/Frame";
import { useAttachStream } from "../../lib/stream";
import { Stage } from "../../ui/Stage";

function useYouCanvas() {
  const { answers, ownedItem } = useJourney();
  const resolved = useMemo(() => resolveLooks(answers, ownedItem), [answers, ownedItem]);
  return { image: canvasImage(answers, resolved), alt: answers.occasion ? `${occasionLabel(answers.occasion)} look` : "", night: answers.time === "NIGHT" };
}

/** The old sixth step: the looks now come first and offer this on the results, so the route goes there. */
export function You() {
  const { href } = useJourney();
  return <Navigate to={href("moment/results")} replace />;
}

export function YouFace() {
  const { answers, href, go, setFaceImage, reduced } = useJourney();
  const canvas = useYouCanvas();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  useAttachStream(videoRef, stream);
  const onStream = useCallback((s: MediaStream | null) => setStream(s), []);

  if (!answers.spend) return <Navigate to={href("moment/occasion")} replace />;

  return (
    <Stage
      spine={momentSpine("looks", answers, href)}
      back={href("moment/results")}
      canvas={<Frame {...canvas} liveRef={videoRef} live={Boolean(stream)} reduced={reduced} />}
      actions={<QuietButton onClick={() => go("moment/results")}>Not now</QuietButton>}
    >
      <h1 className="a-display">Let’s see it on you.</h1>
      <div className="mt-6">
        <Capture
          videoRef={videoRef}
          onStream={onStream}
          onCapture={({ image, source }) => {
            setFaceImage(source === "own" ? image : null);
            go("moment/tryon", { face: source });
          }}
        />
      </div>
    </Stage>
  );
}

const SLOT_OPTIONS = (Object.keys(SLOT_LABEL) as Slot[]).map((id) => ({ id, label: SLOT_LABEL[id] }));
/** "Your navy overshirt" becomes "Navy overshirt", the hint on the sample choice. */
function sampleHint(slot: Slot): string {
  const name = SAMPLE_ITEMS[slot].replace(/^Your /, "");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function YouItem() {
  const { answers, href, go, setOwnedItem, reduced } = useJourney();
  const canvas = useYouCanvas();
  const [slot, setSlot] = useState<Slot | null>(answers.item);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setError(null), [slot]);

  if (!answers.spend) return <Navigate to={href("moment/occasion")} replace />;

  const finish = (name: string, image: string | null) => {
    if (!slot) return;
    setOwnedItem({ slot, name, image });
    go("moment/build", { item: slot, hero: null });
  };

  const onFile = async (file: File | undefined) => {
    if (!file || !slot) return;
    if (!file.type.startsWith("image/")) {
      setError("That file is not an image. Choose a photo of the piece.");
      return;
    }
    try {
      finish(`Your own ${SLOT_LABEL[slot].toLowerCase()}`, await shrinkImage(await fileToDataUrl(file)));
    } catch {
      setError("I couldn’t read that photo. Try another one.");
    }
  };

  return (
    <Stage
      spine={momentSpine("looks", answers, href)}
      back={href("moment/results")}
      canvas={<Frame {...canvas} reduced={reduced} />}
      actions={slot ? <TextButton onClick={() => setSlot(null)}>Choose another piece</TextButton> : undefined}
    >
      <h1 className="a-display">{slot ? `Show me the ${SLOT_LABEL[slot].toLowerCase()}.` : "What do you want me to work with?"}</h1>
      <div className="mt-6">
        {!slot ? (
          <ChoiceList label="What do you want me to work with?" options={SLOT_OPTIONS} value={slot} onChange={(id) => setSlot(id)} />
        ) : (
          <div className="flex flex-col gap-4">
            <ChoiceList
              label="How to add the piece"
              options={[
                { id: "upload" as const, label: "Upload a photo" },
                { id: "sample" as const, label: "Use a sample", hint: sampleHint(slot) },
              ]}
              value={null}
              onChange={(id) => {
                if (id === "upload") fileRef.current?.click();
                else finish(SAMPLE_ITEMS[slot], null);
              }}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label="Upload a photo of the piece"
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {error && (
              <p role="alert" className="text-[15px] text-[var(--error)]">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </Stage>
  );
}
