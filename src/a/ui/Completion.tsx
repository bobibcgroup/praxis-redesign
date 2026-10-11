/**
 * The completion state: what just happened, then where next. The actions sit in the pinned row.
 * After a guest saves, a quiet offer to sign in so the looks follow them; it can be declined, and
 * once declined it stays away.
 */
import { useEffect, useState } from "react";
import { track } from "../../core/analytics";
import { local, readJson, writeJson } from "../../core/ids";
import { FRESH, useGated, useJourney, type DoneKind } from "../lib/journeyContext";
import { LinkButton, PremiumMark, QuietButton, TextButton } from "./controls";

const LINE: Record<DoneKind, string> = {
  saved: "I’ve saved it to your Looks.",
  dna: "I’ll remember your Style DNA.",
};

const SYNC_DISMISSED = "praxis_sync_offer_dismissed";

function SyncOffer() {
  const { user, openGate } = useJourney();
  const [dismissed, setDismissed] = useState(() => readJson<boolean>(local(), SYNC_DISMISSED) === true);
  const show = !user && !dismissed;

  useEffect(() => {
    if (show) track("sync_offer_viewed", {}, { once: "saved" });
  }, [show]);

  if (!show) return null;
  return (
    <div className="mt-6 border-t border-[var(--rule)] pt-5">
      <p className="text-[15px] leading-6">Keep your looks on every device.</p>
      <p className="text-[15px] leading-6 text-[var(--muted)]">Sign in to sync your collection.</p>
      <div className="mt-3 flex items-center gap-2">
        <QuietButton onClick={() => openGate("signin", "sync_offer")}>Sign in</QuietButton>
        <TextButton
          onClick={() => {
            writeJson(local(), SYNC_DISMISSED, true);
            setDismissed(true);
            track("sync_offer_dismissed", {});
          }}
        >
          Not now
        </TextButton>
      </div>
    </div>
  );
}

export function Completion({ kind }: { kind: DoneKind }) {
  return (
    <div className="mt-6 lg:mt-8" aria-live="polite">
      <p className="text-[13px] leading-5 text-[var(--muted)]">{LINE[kind]}</p>
      <h2 className="a-display mt-2">You’re set.</h2>
      {kind === "saved" ? <SyncOffer /> : null}
    </div>
  );
}

/**
 * Stacked: style another moment (keeps the face and the DNA), then the DNA
 * as the second path with its value line, then the looks.
 */
export function CompletionActions() {
  const { href, store, go, user } = useJourney();
  const gated = useGated();
  const premium = user?.premium ?? false;
  const toDna = () => {
    if (!store.dna) track("style_dna_explored", { surface: "completion" });
    gated("dna", () => go("dna/face", { ...FRESH, face: null }));
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <LinkButton to={href("", FRESH)} variant="primary">
        Start a new look
      </LinkButton>
      {store.dna ? (
        <>
          <LinkButton to={href("looks", { hero: null })} variant="secondary">
            See saved looks
          </LinkButton>
          <TextButton onClick={toDna}>
            Update my Style DNA
            <PremiumMark show={!premium} />
          </TextButton>
        </>
      ) : (
        <>
          <QuietButton onClick={toDna}>
            Build my Style DNA
            <PremiumMark show={!premium} />
          </QuietButton>
          <LinkButton to={href("looks", { hero: null })} variant="tertiary">
            See saved looks
          </LinkButton>
        </>
      )}
    </div>
  );
}
