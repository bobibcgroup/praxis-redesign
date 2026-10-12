/**
 * Making the looks personal, reached from the results: add one piece you own, then the looks are
 * styled again around it. Its own route so Back works.
 */
import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { track } from "../../../core/analytics";
import { rememberWardrobeItem } from "../../../core/data";
import { anonymousId } from "../../../core/identity";
import { shortHash } from "../../../core/ids";
import { consentFor } from "../../../core/images";
import { wardrobeRef } from "../../../core/request";
import { useJourney, type Slot } from "../../lib/journeyContext";
import { canvasImage, occasionLabel, SAMPLE_ITEMS, SLOT_LABEL } from "../../lib/looks";
import { momentSpine } from "../../lib/spine";
import { fileToDataUrl, shrinkImage } from "../../lib/image";
import { ChoiceList, TextButton } from "../../ui/controls";
import { PhotoConsent, problemText, rejectFile, rejectImage } from "../../ui/PhotoConsent";
import { Frame } from "../../ui/Frame";
import { Stage } from "../../ui/Stage";

function useYouCanvas() {
  const { answers } = useJourney();
  return { image: canvasImage(answers), alt: answers.occasion ? `${occasionLabel(answers.occasion)} look` : "", night: answers.time === "NIGHT" };
}

/** The old sixth step: the looks now come first and offer this on the results, so the route goes there. */
export function You() {
  const { href } = useJourney();
  return <Navigate to={href("moment/results")} replace />;
}

/** Try-on used to ask for a face photo here; it now asks on its own page, so old links go there. */
export function YouFace() {
  const { href } = useJourney();
  return <Navigate to={href("moment/tryon")} replace />;
}

const SLOT_OPTIONS = (Object.keys(SLOT_LABEL) as Slot[]).map((id) => ({ id, label: SLOT_LABEL[id] }));
/** "Your navy overshirt" becomes "Navy overshirt", the hint on the sample choice. */
function sampleHint(slot: Slot): string {
  const name = SAMPLE_ITEMS[slot].replace(/^Your /, "");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function YouItem() {
  const { answers, href, go, setOwnedItem, reduced, user } = useJourney();
  const [asking, setAsking] = useState(false);
  const canvas = useYouCanvas();
  const [slot, setSlot] = useState<Slot | null>(answers.item);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setError(null);
    setAsking(false);
  }, [slot]);

  if (!answers.spend) return <Navigate to={href("")} replace />;

  const finish = (name: string, image: string | null) => {
    if (!slot) return;
    setOwnedItem({ slot, name, image });
    // Remembered by name and type for next time; the photo stays in this tab only.
    rememberWardrobeItem(wardrobeRef(slot, name, image ? "upload" : "sample", image ? shortHash(image) : ""), { anonymousSessionId: anonymousId(), userId: user?.id });
    track("wardrobe_item_added", { slot, source: image ? "upload" : "sample" });
    go("moment/build", { item: slot, hero: null });
  };

  const onFile = async (file: File | undefined) => {
    if (!file || !slot) return;
    const refused = rejectFile(file, "wardrobe_garment");
    if (refused) {
      setError(problemText(refused));
      return;
    }
    try {
      const original = await fileToDataUrl(file);
      const problem = await rejectImage(original, "wardrobe_garment");
      if (problem) {
        setError(problemText(problem));
        return;
      }
      finish(`Your own ${SLOT_LABEL[slot].toLowerCase()}`, await shrinkImage(original));
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
                { id: "sample" as const, label: "Try it with an example", hint: sampleHint(slot) },
              ]}
              value={null}
              onChange={(id) => {
                setError(null);
                if (id === "sample") finish(SAMPLE_ITEMS[slot], null);
                else if (consentFor("wardrobe_garment")) fileRef.current?.click();
                else setAsking(true);
              }}
            />
            <p className="text-[13px] leading-5 text-[var(--muted)]">An example shows how I build the look around a piece you own, without a photo. Upload a photo to use your own piece.</p>
            {asking ? (
              <PhotoConsent
                category="wardrobe_garment"
                declineLabel="Try it with an example instead"
                onAgree={() => {
                  setAsking(false);
                  fileRef.current?.click();
                }}
                onDecline={() => finish(SAMPLE_ITEMS[slot], null)}
              />
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
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
