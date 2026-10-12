/**
 * The occasions as photographs, like a curated set of editorial prints: three over two on desktop, two
 * to a row with Party across the width on a phone. The name and a small round arrow sit on the photo,
 * over a soft shade that keeps them readable. Hover leans the photo in a touch, lifts the shadow and
 * moves the arrow; choosing one marks it for a beat before the journey moves on. `a-transition` opts them out of the
 * lab rule in src/index.css. The photos come from the visitor's country collection (src/a/lib/country.ts);
 * a photo that fails to load is replaced by the default photo for the same occasion.
 */
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { ChoiceOption, OccasionId } from "../../shared/catalog";
import type { CardPhoto, Collection } from "../lib/country";

/** `base` is a path without width or extension; every photo ships at 480 and 960 wide. */
export function photoSet(base: string) {
  return { src: `${base}-960.webp`, srcSet: `${base}-480.webp 480w, ${base}-960.webp 960w` };
}

interface Props {
  options: readonly ChoiceOption<OccasionId>[];
  value: OccasionId | null;
  onChange: (id: OccasionId) => void;
  collection: Collection;
}

export function OccasionCards({ options, value, onChange, collection }: Props) {
  return (
    <div role="radiogroup" aria-label="Where are you going?" className="a-cards">
      {options.map((o) => {
        const photo = collection.photos[o.id];
        return (
          <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)} className="a-card a-transition">
            <span className="a-card-frame">
              <CardImage key={photo.base} photo={photo} />
              <span className="a-card-shade a-transition" aria-hidden="true" />
              {photo.place ? <span className="a-card-place">{photo.place}</span> : null}
              <span className="a-card-foot">
                <span className="a-card-name">{o.label}</span>
                <span className="a-card-arrow a-transition" aria-hidden="true">
                  <ArrowRight size={14} strokeWidth={1.5} />
                </span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CardImage({ photo }: { photo: CardPhoto }) {
  const [failed, setFailed] = useState(false);
  const base = failed ? photo.fallback : photo.base;
  return (
    <img
      {...photoSet(base)}
      sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 50vw"
      alt=""
      className="a-card-photo a-transition"
      style={photo.position && !failed ? { objectPosition: photo.position } : undefined}
      fetchPriority="high"
      decoding="async"
      data-photo={base}
      onError={failed ? undefined : () => setFailed(true)}
    />
  );
}
