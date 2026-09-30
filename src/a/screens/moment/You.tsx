/**
 * The optional sixth step: add your face, add one item, or skip both.
 * Face capture and the item live on their own routes so Back works.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useJourney, type Slot } from "../../lib/journeyContext";
import { canvasImage, occasionLabel, resolveLooks, SAMPLE_ITEMS, SLOT_LABEL } from "../../lib/looks";
import { momentSpine } from "../../lib/spine";
import { fileToDataUrl, shrinkImage } from "../../lib/image";
import { Caption, ChoiceList, Count, PrimaryButton, QuietButton, TextButton } from "../../ui/controls";
import { Capture } from "../../ui/Capture";
import { Frame } from "../../ui/Frame";
import { useAttachStream } from "../../lib/stream";
import { Stage } from "../../ui/Stage";

function useYouCanvas() {
  const { answers, ownedItem } = useJourney();
  const resolved = useMemo(() => resolveLooks(answers, ownedItem), [answers, ownedItem]);
  return { image: canvasImage(answers, resolved), alt: answers.occasion ? `${occasionLabel(answers.occasion)} look` : "", night: answers.time === "NIGHT" };
}

export function You() {
  const { answers, href, go, ownedItem, store, reduced } = useJourney();
  const canvas = useYouCanvas();
  if (!answers.spend) return <Navigate to={href("moment/occasion")} replace />;

  const faceLine = answers.face === "own" ? "Your photo is in" : answers.face === "sample" ? "Sample face is in" : store.dna ? "From your DNA" : "Add";
  const itemLine = answers.item && ownedItem ? ownedItem.name : "Add";
  const anything = Boolean(answers.face || answers.item);

  return (
    <Stage
      spine={momentSpine("you", answers, href)}
      back={href("moment/spend")}
      canvas={<Frame {...canvas} reduced={reduced} />}
      actions={<PrimaryButton onClick={() => go("moment/build")}>{anything ? "Build the looks" : "Not now"}</PrimaryButton>}
    >
      <h1 className="a-display">Want it on you?</h1>
      <Count step={6} total={6} />
      <Caption className="mt-4 max-w-[36ch]">Your face lets us render the look on you. One piece you own becomes the anchor of every look. Both optional.</Caption>
      <div className="a-answers mt-6">
        <button type="button" onClick={() => go("moment/you/face")} className="a-control" aria-pressed={faceLine !== "Add"}>
          Your face
          <span className="hint">{faceLine}</span>
        </button>
        <button type="button" onClick={() => go("moment/you/item")} className="a-control" aria-pressed={itemLine !== "Add"}>
          One item you own
          <span className="hint">{itemLine}</span>
        </button>
      </div>
    </Stage>
  );
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
      spine={momentSpine("you", answers, href)}
      back={href("moment/you")}
      canvas={<Frame {...canvas} liveRef={videoRef} live={Boolean(stream)} reduced={reduced} />}
      actions={<QuietButton onClick={() => go("moment/you")}>Not now</QuietButton>}
    >
      <h1 className="a-display">Add your face.</h1>
      <Count step={6} total={6} />
      <div className="mt-6">
        <Capture
          videoRef={videoRef}
          onStream={onStream}
          onCapture={({ image, source }) => {
            setFaceImage(source === "own" ? image : null);
            go("moment/you", { face: source });
          }}
        />
      </div>
    </Stage>
  );
}

const SLOT_OPTIONS = (Object.keys(SLOT_LABEL) as Slot[]).map((id) => ({ id, label: SLOT_LABEL[id] }));
const WAYS: readonly { id: "upload" | "sample"; label: string }[] = [
  { id: "upload", label: "Upload a photo" },
  { id: "sample", label: "Use a sample" },
];

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
    go("moment/you", { item: slot });
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
      setError("The photo could not be read. Try another one.");
    }
  };

  return (
    <Stage
      spine={momentSpine("you", answers, href)}
      back={href("moment/you")}
      canvas={<Frame {...canvas} reduced={reduced} />}
      actions={slot ? <TextButton onClick={() => setSlot(null)}>Different piece</TextButton> : undefined}
    >
      <h1 className="a-display">{slot ? `Show us the ${SLOT_LABEL[slot].toLowerCase()}.` : "Which piece is it?"}</h1>
      <Count step={6} total={6} />
      <div className="mt-6">
        {!slot ? (
          <ChoiceList label="Which piece is it?" options={SLOT_OPTIONS} value={slot} onChange={(id) => setSlot(id)} />
        ) : (
          <div className="flex flex-col gap-4">
            <ChoiceList
              label="How to add the piece"
              options={WAYS}
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
