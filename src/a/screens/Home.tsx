/**
 * Home: the headline, one line on what happens, and the five occasions as photographs in a row; the
 * first tap starts the looks. Beside it, the film of the real journey on a phone, layered over
 * photographs. Then how it works as one quiet strip, and Style DNA as one panoramic photograph across
 * the page with its copy on the open wall, so the premium feature never competes with the first tap.
 * After saving a Style DNA, the completion state.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { track } from "../../core/analytics";
import { OCCASIONS, STAND_IN_PORTRAIT, timesFor, type OccasionId } from "../../shared/catalog";
import { COUNTRY_COLLECTIONS } from "../../config/occasionCollections";
import { collectionFor, previewCode, useCountry } from "../lib/country";
import { FRESH, useGated, useJourney } from "../lib/journeyContext";
import { LinkButton } from "../ui/controls";
import { Completion, CompletionActions } from "../ui/Completion";
import { CountrySheet } from "../ui/CountrySheet";
import { Frame } from "../ui/Frame";
import { HomeDemo } from "../ui/HomeDemo";
import { OccasionCards } from "../ui/OccasionCards";
import { Stage } from "../ui/Stage";
import { TopBar } from "../ui/TopBar";

const LINE = "Choose your occasion. Discover three looks designed for it.";
const STEPS = [
  { n: "01", title: "Choose an occasion", line: "Tell me where you’re going." },
  { n: "02", title: "Discover three looks", line: "Get curated outfit ideas." },
  { n: "03", title: "Save or share", line: "Keep your favorites." },
];
/** One photograph across the section: the man on the left, open wall on the right for the copy. */
const DNA_BANNER = {
  wide: "/images/home/style-dna-wide-1600.webp 1600w, /images/home/style-dna-wide-2400.webp 2400w",
  phone: "/images/home/style-dna-phone-800.webp 800w, /images/home/style-dna-phone-1200.webp 1200w",
  alt: "A man in a light jacket and open white shirt against a sunlit wall with the shadow of palm leaves",
};

function StyleDna() {
  const { store, go, href } = useJourney();
  const gated = useGated();
  const explore = () => {
    track("style_dna_explored", { surface: "home" });
    gated("dna", () => go("dna/face", { ...FRESH, face: null }));
  };

  return (
    <section className="a-dna" aria-labelledby="dna-title">
      <picture className="a-dna-image">
        <source media="(min-width: 768px)" srcSet={DNA_BANNER.wide} sizes="100vw" />
        <img srcSet={DNA_BANNER.phone} sizes="100vw" src="/images/home/style-dna-phone-800.webp" alt={DNA_BANNER.alt} width={1200} height={900} loading="lazy" decoding="async" />
      </picture>
      <div className="a-dna-copy">
        <p className="a-label flex items-center gap-3">
          Introducing Style DNA
          <span className="a-tag">Premium</span>
        </p>
        <h2 id="dna-title" className="a-display a-dna-title mt-4">
          Your style. More personal.
        </h2>
        <p className="a-dna-line mt-3">
          {store.dna ? "Your Style DNA is saved. You can look it over or start again at any time." : "Discover a styling experience shaped around your preferences with Style DNA."}
        </p>
        {store.dna ? (
          <LinkButton to={href("dna", { hero: null })} variant="secondary" className="a-dna-cta mt-6 gap-3">
            See my Style DNA
            <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
          </LinkButton>
        ) : (
          <button type="button" onClick={explore} className="a-control a-secondary a-dna-cta a-transition mt-6 gap-3">
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
  /* Sent here from Restyle to change the occasion: keep the other answers and go back to the looks after the place. */
  const restyle = params.get("restyle") !== null;
  const { resolution, name: countryLabel } = useCountry();
  const preview = previewCode(params);
  const collection = useMemo(() => collectionFor(resolution.countryCode, preview), [resolution.countryCode, preview]);
  const [picker, setPicker] = useState(false);
  const [onCards, setOnCards] = useState(false);

  useEffect(() => {
    if (answers.done) return;
    track(
      "country_collection_loaded",
      { country: resolution.countryCode ?? "none", source: resolution.source, collection: collection.code ?? "default", version: collection.version, localized: collection.code !== null },
      { once: `country:${resolution.countryCode ?? "none"}` },
    );
  }, [answers.done, resolution.countryCode, resolution.source, collection.code, collection.version]);

  useEffect(() => {
    if (answers.done) return;
    track("landing_viewed", { via: via === "story" || via === "friend" || via === "link" ? via : "none" }, { once: "home" });
  }, [answers.done, via]);

  const choose = (id: OccasionId) => {
    setPending(id);
    track("occasion_selected", { occasion: id, surface: "home", collection: collection.code ?? "default" });
  };

  useEffect(() => {
    if (!pending) return;
    /* Back here mid-journey or from Restyle: the place belongs to the old occasion and is asked again; a time
       that still fits, the feel and the budget are kept, so the looks follow straight after the place. */
    const keepTime = timesFor(pending).some((t) => t.id === answers.time);
    const midway = restyle || (answers.occasion && !answers.done);
    const patch = midway ? { occasion: pending, venue: null, time: keepTime ? answers.time : null, hero: null } : { ...FRESH, occasion: pending };
    const t = setTimeout(() => go("moment/venue", patch), reduced ? 0 : 260);
    return () => clearTimeout(t);
  }, [pending, go, reduced, restyle, answers.occasion, answers.done, answers.time]);

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
        <div className="a-home-inner">
        <section className="a-hero">
          <div className="a-hero-copy">
            <h1 className="a-display a-hero-title">
              Know what to wear. <em>Every time.</em>
            </h1>
            <p className="a-hero-line">{LINE}</p>
            <p className="a-label a-hero-ask text-[var(--muted)]">Where are you going?</p>
            {/* The film holds while the visitor is on the occasions, so the choice has their attention. */}
            <div
              className="mt-4"
              onPointerEnter={() => setOnCards(true)}
              onPointerLeave={() => setOnCards(false)}
              onFocus={() => setOnCards(true)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOnCards(false);
              }}
            >
              <OccasionCards options={OCCASIONS} value={pending ?? answers.occasion} onChange={choose} collection={collection} />
            </div>
            {collection.code ? (
              <p className="a-photos-from">
                Photographed in {COUNTRY_COLLECTIONS[collection.code].name}.{" "}
                <button type="button" onClick={() => setPicker(true)} aria-haspopup="dialog" className="a-photos-change">
                  Change
                </button>
              </p>
            ) : null}
            {store.looks.length > 0 ? (
              <LinkButton to={href("looks", { hero: null })} variant="tertiary" className="a-phone mt-4 self-start !px-0">
                Saved looks
                <span className="hint">{store.looks.length}</span>
              </LinkButton>
            ) : null}
          </div>
          <HomeDemo reduced={reduced} hold={onCards} />
        </section>

        <section className="a-steps" aria-labelledby="steps-title">
          <h2 id="steps-title" className="a-label a-steps-title">
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
        </div>

        <StyleDna />
      </main>
      <footer className="a-home-foot">
        <button type="button" className="a-home-location a-transition" onClick={() => setPicker(true)} aria-haspopup="dialog">
          <span className="text-[var(--muted)]">Location</span>
          <span>{countryLabel ?? "Not set"}</span>
          <span className="a-home-location-change">Change</span>
        </button>
      </footer>
      <CountrySheet open={picker} onClose={() => setPicker(false)} />
    </div>
  );
}
