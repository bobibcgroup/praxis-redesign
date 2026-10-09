/**
 * Home: always says what this is. Two paths of unequal weight: dress me for
 * a moment (primary) and, under a rule, the Style DNA block. With a saved
 * DNA the headline asks where he is going and the occasion chips sit under
 * it. After saving a DNA, the completion state.
 */
import { useEffect, useState } from "react";
import { OCCASIONS, STAND_IN_PORTRAIT, type OccasionId } from "../../shared/catalog";
import { FRESH, useGated, useJourney } from "../lib/journeyContext";
import { ChoiceList, LinkButton, PlusMark, QuietButton, TextButton } from "../ui/controls";
import { Completion, CompletionActions } from "../ui/Completion";
import { Frame } from "../ui/Frame";
import { Stage } from "../ui/Stage";

const LINE = "Tell me where you’re going. I’ll put together three looks.";
const RETURNING_LINE = "Pick the occasion and I’ll put together three looks.";

function DnaBlock() {
  const { store, go, user } = useJourney();
  const gated = useGated();
  const plus = user?.plus ?? false;
  const toDna = () => gated("dna", () => go("dna/face", { ...FRESH, face: null }));

  if (store.dna) {
    return (
      <div className="flex items-center justify-between gap-4">
        <p className="text-[15px] leading-5">Your Style DNA is saved.</p>
        <TextButton onClick={toDna}>
          Update my Style DNA
          <PlusMark show={!plus} />
        </TextButton>
      </div>
    );
  }
  return (
    <div className="mt-4 border-t border-[var(--rule)] pt-4">
      <p className="a-display a-display-sm lg:max-w-[30ch]">Let me get to know your style.</p>
      <QuietButton onClick={toDna} className="mt-4">
        Build my Style DNA
        <PlusMark show={!plus} />
      </QuietButton>
    </div>
  );
}

export function Home() {
  const { answers, href, go, store, reduced, setFaceImage } = useJourney();
  const [pending, setPending] = useState<OccasionId | null>(null);
  const dna = store.dna;

  useEffect(() => {
    if (!pending) return;
    const own = dna?.portrait?.startsWith("data:") ? dna.portrait : null;
    const t = setTimeout(() => {
      if (own) setFaceImage(own);
      go("moment/venue", { ...FRESH, occasion: pending, face: own ? "own" : "sample" });
    }, reduced ? 0 : 260);
    return () => clearTimeout(t);
  }, [pending, go, reduced, dna, setFaceImage]);

  if (answers.done === "dna") {
    return (
      <Stage wordmark canvas={<Frame image={dna?.portrait ?? STAND_IN_PORTRAIT} alt="Your portrait" reduced={reduced} />} actions={<CompletionActions />}>
        <Completion kind="dna" />
      </Stage>
    );
  }

  const image = pending ? OCCASIONS.find((o) => o.id === pending)?.image ?? null : null;

  return (
    <Stage
      wordmark
      band="home"
      canvas={<Frame image={image} alt="" preview={OCCASIONS} reduced={reduced} />}
      actions={
        <div className="flex flex-col">
          {dna ? null : (
            <LinkButton to={href("moment/occasion", FRESH)} variant="primary" className="self-start">
              Dress me for a moment
            </LinkButton>
          )}
          <DnaBlock />
        </div>
      }
    >
      <h1 className="a-display max-w-[19ch]">{dna ? "Where are you going?" : "Know what to wear. Every time."}</h1>
      <p className="mt-4 max-w-[40ch] leading-6">{dna ? RETURNING_LINE : LINE}</p>
      {dna ? (
        <div className="mt-6">
          <ChoiceList label="Where are you going?" options={OCCASIONS} value={pending} onChange={(id) => setPending(id)} />
        </div>
      ) : null}
    </Stage>
  );
}
