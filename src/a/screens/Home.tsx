/**
 * Home: the headline, one line on what happens, and the occasions as photographs; the first tap
 * starts the looks. Beside it, a short recording of the real journey, staged with photographs. Under the fold, how it works in three
 * steps, then Style DNA in its own section so the premium feature never competes with the first tap.
 * After saving a Style DNA, the completion state.
 */
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { track } from "../../core/analytics";
import { OCCASIONS, STAND_IN_PORTRAIT, type OccasionId } from "../../shared/catalog";
import { FRESH, useGated, useJourney } from "../lib/journeyContext";
import { LinkButton } from "../ui/controls";
import { Completion, CompletionActions } from "../ui/Completion";
import { Frame } from "../ui/Frame";
import { HomeDemo } from "../ui/HomeDemo";
import { OccasionCards, photoSet } from "../ui/OccasionCards";
import { Stage } from "../ui/Stage";
import { TopBar } from "../ui/TopBar";

const LINE = "Choose your occasion, answer four quick questions, and I’ll show you three looks for it.";
const STEPS = [
  { n: "01", title: "Choose your occasion", line: "Tell me where you’re going." },
  { n: "02", title: "Discover three looks", line: "Picked from your answers. The pieces and prices are examples for now." },
  { n: "03", title: "Save or share", line: "Keep your favorites without an account, or send them to a friend." },
];
const DNA_IMAGE = "/images/home/dna";

function StyleDna() {
  const { store, go, href } = useJourney();
  const gated = useGated();
  const explore = () => {
    track("style_dna_explored", { surface: "home" });
    gated("dna", () => go("dna/face", { ...FRESH, face: null }));
  };

  return (
    <section className="a-dna" aria-labelledby="dna-title">
      <div className="a-dna-image">
        <img {...photoSet(DNA_IMAGE)} sizes="(min-width: 1024px) 40vw, 100vw" alt="Folds of tailoring cloth in camel, houndstooth and brown" loading="lazy" decoding="async" />
      </div>
      <div className="a-dna-copy">
        <p className="a-label flex items-center gap-3 text-[var(--text)]">
          Introducing Style DNA
          <span className="a-tag">Premium</span>
        </p>
        <h2 id="dna-title" className="a-display a-display-md mt-4">
          Your style. More personal.
        </h2>
        <p className="mt-4 max-w-[44ch] text-[16px] leading-6 text-[var(--text)]">
          {store.dna ? "Your Style DNA is saved. You can look it over or start again at any time." : "Tell me your colours, your fit and your taste once, and I’ll keep them together in your Style DNA. You can change them at any time."}
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
  const { answers, params, href, go, store, reduced, faceImage } = useJourney();
  const [pending, setPending] = useState<OccasionId | null>(null);
  const via = params.get("via");

  useEffect(() => {
    if (answers.done) return;
    track("landing_viewed", { via: via === "story" || via === "friend" || via === "link" ? via : "none" }, { once: "home" });
  }, [answers.done, via]);

  const choose = (id: OccasionId) => {
    setPending(id);
    track("occasion_selected", { occasion: id, surface: "home" });
  };

  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => go("moment/venue", { ...FRESH, occasion: pending }), reduced ? 0 : 260);
    return () => clearTimeout(t);
  }, [pending, go, reduced]);

  if (answers.done === "dna") {
    return (
      <Stage wordmark canvas={<Frame image={faceImage ?? STAND_IN_PORTRAIT} alt={faceImage ? "Your portrait" : "A sample portrait"} reduced={reduced} />} actions={<CompletionActions />}>
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
              <OccasionCards options={OCCASIONS} value={pending} onChange={choose} />
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
