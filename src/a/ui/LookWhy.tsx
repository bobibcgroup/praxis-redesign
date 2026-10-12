/**
 * Why this look: the answers that shaped it, each with what it did, exactly as the recommendation
 * service gave them. Folded by default so the column stays calm; the screen never writes a reason
 * of its own.
 */
import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { RecommendationFactor } from "../../core/contracts";

const ORDER: RecommendationFactor["factor"][] = ["occasion", "venue", "time", "style", "budget", "wardrobe", "style_dna", "feedback", "colour", "body", "weather"];

export function LookWhy({ factors, lookId }: { factors: RecommendationFactor[]; lookId: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  if (factors.length === 0) return null;
  const sorted = [...factors].sort((a, b) => ORDER.indexOf(a.factor) - ORDER.indexOf(b.factor));
  return (
    <div className="a-why" key={lookId}>
      <button type="button" className="a-why-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span className="a-label">Why this look</span>
        <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" className="a-transition" data-open={open ? "" : undefined} />
      </button>
      <dl id={id} className="a-why-list" hidden={!open}>
        {sorted.map((f) => (
          <div key={`${f.factor}-${f.value}`}>
            <dt className="a-label">{f.value}</dt>
            <dd>{f.influence ?? ""}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
