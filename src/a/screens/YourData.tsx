/**
 * What Praxis keeps in this browser, in plain words, with a way to delete the photos one by one and
 * everything at once. Reached from the menu and from Style DNA. Nothing here is sent anywhere.
 */
import { useState } from "react";
import { track } from "../../core/analytics";
import { deleteLocalData, wardrobeEntries } from "../../core/data";
import { feedbackStore } from "../../core/feedback";
import { resetIdentityCache } from "../../core/identity";
import { deleteImages, withdrawConsent } from "../../core/images";
import { requestHistory } from "../../core/service";
import { useJourney } from "../lib/journeyContext";
import { PrimaryButton, TextButton } from "../ui/controls";
import { TopBar } from "../ui/TopBar";

function Line({ label, value, action }: { label: string; value: string; action?: React.ReactNode }) {
  return (
    <div className="a-piece">
      <span>
        <span className="block text-[15px] leading-6">{label}</span>
        <span className="block text-[13px] leading-5 text-[var(--muted)]">{value}</span>
      </span>
      {action ?? <span />}
    </div>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function YourData() {
  const { href, store, faceImage, setFaceImage, ownedItem, setOwnedItem, base } = useJourney();
  const [confirming, setConfirming] = useState(false);
  const wardrobe = wardrobeEntries();

  const deletePhoto = (which: "face" | "item") => {
    if (which === "face") {
      setFaceImage(null);
      deleteImages("face_colour");
      track("photo_deleted", { category: "face_colour" });
    } else if (ownedItem) {
      setOwnedItem({ ...ownedItem, image: null });
      deleteImages("wardrobe_garment");
      track("photo_deleted", { category: "wardrobe_garment" });
    }
  };

  const deleteAll = () => {
    withdrawConsent("face_colour");
    withdrawConsent("wardrobe_garment");
    deleteLocalData();
    resetIdentityCache();
    // The first event of a clean slate, under a new anonymous id.
    track("local_data_deleted", {});
    window.location.assign(base || "/");
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--bg)]">
      <TopBar back={href("")} />
      <main className="mx-auto flex max-w-[640px] flex-col gap-8 px-5 pb-16 pt-4 lg:px-10">
        <div>
          <h1 className="a-display">Your data on this device</h1>
          <p className="mt-4 max-w-[48ch] leading-6 text-[var(--muted)]">Praxis keeps these in this browser only. Nothing is sent to a server yet. Photos stay in this tab and are gone when you close it.</p>
        </div>

        <div role="list">
          <Line label="Saved looks" value={store.looks.length ? plural(store.looks.length, "look", "looks") : "None"} />
          <Line label="Style DNA" value={store.dna ? "Saved, without your photo" : "None"} />
          <Line label="Pieces you own" value={wardrobe.length ? `${plural(wardrobe.length, "piece", "pieces")}, by name only` : "None"} />
          <Line label="Your feedback on looks" value={feedbackStore.all().length ? plural(feedbackStore.all().length, "note", "notes") : "None"} />
          <Line label="Looks you asked for" value={requestHistory.all().length ? `The last ${plural(requestHistory.all().length, "request", "requests")}, kept for 90 days` : "None"} />
          <Line
            label="Your Style DNA photo"
            value={faceImage ? "In this tab" : "None"}
            action={faceImage ? <TextButton onClick={() => deletePhoto("face")}>Delete</TextButton> : undefined}
          />
          <Line
            label="Photo of your piece"
            value={ownedItem?.image ? "In this tab" : "None"}
            action={ownedItem?.image ? <TextButton onClick={() => deletePhoto("item")}>Delete</TextButton> : undefined}
          />
        </div>

        {confirming ? (
          <div className="flex flex-col gap-4 border-t border-[var(--rule)] pt-6">
            <p className="max-w-[44ch] leading-6">This deletes your saved looks, Style DNA, feedback, pieces and photos from this browser, and signs you out. It can’t be undone.</p>
            <div className="flex flex-wrap items-center gap-2">
              <PrimaryButton onClick={deleteAll}>Delete everything</PrimaryButton>
              <TextButton onClick={() => setConfirming(false)}>Keep it</TextButton>
            </div>
          </div>
        ) : (
          <div className="border-t border-[var(--rule)] pt-6">
            <TextButton className="-ml-2" onClick={() => setConfirming(true)}>
              Delete everything on this device
            </TextButton>
          </div>
        )}
      </main>
    </div>
  );
}
