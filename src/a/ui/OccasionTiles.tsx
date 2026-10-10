/**
 * The occasions as tiles: three, then two, each a name in the serif with an arrow that says
 * "this starts your looks". Choosing one fills it in ink for a beat before the journey moves on.
 * `a-transition` opts them out of the lab rule in src/index.css that switches transitions off.
 */
import { ArrowRight } from "lucide-react";
import type { ChoiceOption, OccasionId } from "../../shared/catalog";

interface Props {
  options: readonly ChoiceOption<OccasionId>[];
  value: OccasionId | null;
  onChange: (id: OccasionId) => void;
}

export function OccasionTiles({ options, value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="Where are you going?" className="a-tiles">
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)} className="a-tile a-transition">
          <span>{o.label}</span>
          <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" className="a-tile-arrow a-transition" />
        </button>
      ))}
    </div>
  );
}
