/**
 * Why this look: the answers that shaped it, each with what it did, exactly as the recommendation
 * service gave them. The screen never writes a reason of its own.
 *
 * A real disclosure: the whole header is the button, and the reasons fold away entirely (height to
 * nothing, then hidden, so they leave the reading and tab order and what follows moves up). Open at
 * first on desktop, where the column has room, and folded on a phone. Once the customer opens or
 * folds it, that choice holds as they move between looks.
 */
import { useId, useState } from "react";
import { motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import type { RecommendationFactor } from "../../core/contracts";
import { useJourney } from "../lib/journeyContext";

const ORDER: RecommendationFactor["factor"][] = ["occasion", "venue", "time", "style", "budget", "wardrobe", "style_dna", "feedback", "colour", "body", "weather"];
const FOLD = { duration: 0.25, ease: [0.22, 0.61, 0.36, 1] as const };

/** The customer's own choice for this tab; null until they make one. Each look mounts afresh, so it lives here. */
let chosen: boolean | null = null;
const openAtFirst = () => chosen ?? (typeof window !== "undefined" && window.matchMedia?.("(min-width: 1024px)").matches === true);

/** For tests: forget the customer's choice. */
export function resetWhyChoice() {
  chosen = null;
}

export function LookWhy({ factors, lookId }: { factors: RecommendationFactor[]; lookId: string }) {
  const { reduced } = useJourney();
  const [open, setOpen] = useState(openAtFirst);
  /* Hidden once folded, so the reasons leave the page's reading and tab order; shown again before unfolding. */
  const [gone, setGone] = useState(() => !open);
  const id = useId();
  if (factors.length === 0) return null;
  const sorted = [...factors].sort((a, b) => ORDER.indexOf(a.factor) - ORDER.indexOf(b.factor));
  const toggle = () => {
    chosen = !open;
    if (!open) setGone(false);
    setOpen(!open);
  };
  return (
    <div className="a-why" key={lookId}>
      <button type="button" className="a-why-toggle" aria-expanded={open} aria-controls={id} onClick={toggle}>
        <span className="a-label">Why this look</span>
        <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" data-open={open ? "" : undefined} />
      </button>
      <motion.div
        id={id}
        className="a-why-fold"
        hidden={gone}
        initial={false}
        animate={open ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
        transition={reduced ? { duration: 0 } : FOLD}
        onAnimationComplete={() => setGone(!open)}
      >
        <dl className="a-why-list">
          {sorted.map((f) => (
            <div key={`${f.factor}-${f.value}`}>
              <dt className="a-label">{f.value}</dt>
              <dd>{f.influence ?? ""}</dd>
            </div>
          ))}
        </dl>
      </motion.div>
    </div>
  );
}
