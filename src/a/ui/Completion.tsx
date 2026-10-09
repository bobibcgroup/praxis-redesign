/** The completion state: what just happened, then where next. The actions sit in the pinned row. */
import { FRESH, useGated, useJourney, type DoneKind } from "../lib/journeyContext";
import { LinkButton, PlusMark, QuietButton, TextButton } from "./controls";

const LINE: Record<DoneKind, string> = {
  saved: "I’ve saved it to your Looks.",
  reserved: "Your pieces are listed by retailer.",
  dna: "I’ll remember your Style DNA.",
};

export function Completion({ kind }: { kind: DoneKind }) {
  return (
    <div className="mt-6 lg:mt-8" aria-live="polite">
      <p className="text-[13px] leading-5 text-[var(--muted)]">{LINE[kind]}</p>
      <h2 className="a-display mt-2">You’re set.</h2>
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
  const plus = user?.plus ?? false;
  const toDna = () => gated("dna", () => go("dna/face", { ...FRESH, face: null }));

  return (
    <div className="flex flex-col items-start gap-2">
      <LinkButton to={href("moment/occasion", FRESH)} variant="primary">
        Dress me for another moment
      </LinkButton>
      {store.dna ? (
        <>
          <LinkButton to={href("looks", { hero: null })} variant="secondary">
            See my looks
          </LinkButton>
          <TextButton onClick={toDna}>
            Update my Style DNA
            <PlusMark show={!plus} />
          </TextButton>
        </>
      ) : (
        <>
          <QuietButton onClick={toDna}>
            Build my Style DNA
            <PlusMark show={!plus} />
          </QuietButton>
          <LinkButton to={href("looks", { hero: null })} variant="tertiary">
            See my looks
          </LinkButton>
        </>
      )}
    </div>
  );
}
