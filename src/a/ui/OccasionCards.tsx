/**
 * The occasions as photographs: three, then two on desktop; two to a row with Party across the
 * width on a phone. Each card is the place it stands for, its name in the serif and an arrow.
 * Hover leans the photo in a touch and moves the arrow; choosing one darkens it for a beat
 * before the journey moves on. `a-transition` opts them out of the lab rule in src/index.css.
 */
import { ArrowRight } from "lucide-react";
import type { ChoiceOption, OccasionId } from "../../shared/catalog";

/** Editorial photos for the home cards (Unsplash, free license); see public/images/home/CREDITS.md. */
export const OCCASION_PHOTOS: Record<OccasionId, { src: string; alt: string; position?: string }> = {
  DINNER: { src: "/images/home/dinner", alt: "A candlelit restaurant table" },
  WORK: { src: "/images/home/work", alt: "A man in a tailored suit in the city" },
  DATE: { src: "/images/home/date", alt: "Two glasses raised in a toast" },
  WEDDING: { src: "/images/home/wedding", alt: "White roses in a wedding bouquet" },
  PARTY: { src: "/images/home/party", alt: "A martini on a bar at night" },
};

/** `base` is a path without width or extension; every photo ships at 480 and 960 wide. */
export function photoSet(base: string) {
  return { src: `${base}-960.webp`, srcSet: `${base}-480.webp 480w, ${base}-960.webp 960w` };
}

interface Props {
  options: readonly ChoiceOption<OccasionId>[];
  value: OccasionId | null;
  onChange: (id: OccasionId) => void;
}

export function OccasionCards({ options, value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="Where are you going?" className="a-cards">
      {options.map((o) => {
        const photo = OCCASION_PHOTOS[o.id];
        return (
          <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)} className="a-card a-transition">
            <img
              {...photoSet(photo.src)}
              sizes="(min-width: 1024px) 280px, (min-width: 640px) 45vw, 50vw"
              alt=""
              className="a-card-photo a-transition"
              style={photo.position ? { objectPosition: photo.position } : undefined}
              fetchPriority="high"
              decoding="async"
            />
            <span className="a-card-name">{o.label}</span>
            <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" className="a-card-arrow a-transition" />
          </button>
        );
      })}
    </div>
  );
}
