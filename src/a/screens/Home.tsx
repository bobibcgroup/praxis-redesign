/**
 * Home: the headline, one line on what happens, and the occasions as photographs; the first tap
 * starts the looks. Beside it, a short recording of the real journey, staged with photographs. Under the fold, how it works in three
 * steps, then Style DNA in its own section so the premium feature never competes with the first tap.
 * After saving a Style DNA, the completion state.
 */
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { OCCASIONS, STAND_IN_PORTRAIT, type OccasionId } from "../../shared/catalog";
import { FRESH, useGated, useJourney } from "../lib/journeyContext";
import { LinkButton } from "../ui/controls";
import { Completion, CompletionActions } from "../ui/Completion";
import { Frame } from "../ui/Frame";
import { HomeDemo } from "../ui/HomeDemo";
import { OccasionCards, photoSet } from "../ui/OccasionCards";
import { Stage } from "../ui/Stage";
import { TopBar } from "../ui/TopBar";

const LINE = "Choose your occasion. Discover three looks designed for it.";
const STEPS = [
  { n: "01", title: "Choose your occasion", line: "Tell me where you’re going." },
  { n: "02", title: "Discover three looks", line: "Real pieces, put together for the moment." },
  { n: "03", title: "Save or share", line: "Keep your favorites or send them to a friend." },
];
const DNA_IMAGE = "/images/home/dna";

function StyleDna() {
  const { store, go, href } = useJourney();
  const gated = useGated();
  const explore = () => gated("dna", () => go("dna/face", { ...FRESH, face: null }));

  return (
    <section className="a-dna" aria-labelledby="dna-title">
      <div className="a-dna-image">
        <img {...photoSet(DNA_IMAGE)} sizes="(min-width: 1024px) 40vw, 100vw" alt="Folds of tailoring cloth in camel, houndstooth and brown" loading="lazy" decoding="async" />
      </div>
      <div className="a-dna-copy">
        <p className="a-label flex items-center gap-3 text-[var(--muted)]">
          Introducing Style DNA
          <span className="a-tag">Premium</span>
        </p>
        <h2 id="dna-title" className="a-display a-display-md mt-4">
          Your style. More personal.
        </h2>
        <p className="mt-4 max-w-[44ch] text-[16px] leading-6 text-[var(--muted)]">
          {store.dna ? "Your Style DNA is saved. Every look I put together starts from it." : "Discover a styling experience shaped around your preferences with Style DNA."}
        </p>
        {store.dna ? (
          <LinkButton to={href("dna", { hero: null })} variant="secondary" className="mt-6 gap-2">
            See my Style DNA
            <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
          </LinkButton>
        ) : (
          <button type="button" onClick={explore} className="a-control a-secondary mt-6 gap-2">
            Explore Style DNA
            <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
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
      go("moment/venue", { ...FRESH, occasion: pending, face: dna ? (own ? "own" : "sample") : null });
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

  return (
    <div className="a-home">
      <TopBar />
      <main>
        <section className="a-hero">
          <div className="a-hero-copy">
            <p className="a-label text-[var(--muted)]">Your personal stylist</p>
            <h1 className="a-display a-hero-title mt-4">
              Know what to wear. <em>Every time.</em>
            </h1>
            <p className="mt-5 max-w-[44ch] text-[16px] leading-6 lg:text-[17px] lg:leading-7">{LINE}</p>
            <p className="a-label mt-8 text-[var(--muted)] lg:mt-10">Where are you going?</p>
            <div className="mt-4">
              <OccasionCards options={OCCASIONS} value={pending} onChange={setPending} />
            </div>
            {store.looks.length > 0 ? (
              <LinkButton to={href("looks", { hero: null })} variant="tertiary" className="a-phone mt-4 self-start !px-0">
                Saved looks
                <span className="hint">{store.looks.length}</span>
              </LinkButton>
            ) : null}
          </div>
          <HomeDemo reduced={reduced} />
        </section>

        <section className="a-steps" aria-labelledby="steps-title">
          <h2 id="steps-title" className="a-label text-[var(--muted)]">
            How it works
          </h2>
          <ol>
            {STEPS.map((step) => (
              <li key={step.n}>
                <span className="a-step-n">{step.n}</span>
                <span>
                  <span className="a-step-title">{step.title}</span>
                  <span className="a-step-line">{step.line}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <StyleDna />
      </main>
    </div>
  );
}
