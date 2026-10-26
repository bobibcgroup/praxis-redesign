/**
 * The photos on the home's occasion cards, the same for every visitor. Each lives in public/images/home/
 * as dinner, work, date, wedding and party, at -480.webp and -960.webp (4:3, 480 x 360 and 960 x 720,
 * the cards' own shape), credited in that folder's CREDITS.md. `npm run photos:check` verifies them.
 */
import type { OccasionId } from "../shared/catalog";

export interface OccasionPhoto {
  /** Path without width or extension: `${base}-480.webp` and `${base}-960.webp`. */
  base: string;
  alt: string;
  /** CSS object-position, when the subject sits off centre. */
  position?: string;
}

/** One campaign from the Round 2 review's reference board. Bump the version whenever a photo changes. */
export const OCCASION_PHOTOS: { version: number; photos: Record<OccasionId, OccasionPhoto> } = {
  version: 2,
  photos: {
    DINNER: { base: "/images/home/dinner", alt: "A candlelit table with cut glass goblets under soft warm light" },
    WORK: { base: "/images/home/work", alt: "A man in a taupe double breasted suit in front of an arched doorway" },
    DATE: { base: "/images/home/date", alt: "A couple sharing coffee by candlelight under string lights" },
    WEDDING: { base: "/images/home/wedding", alt: "A long wedding table with white flowers beneath tall arched windows" },
    PARTY: { base: "/images/home/party", alt: "A lounge bar in burgundy velvet lit by small table lamps" },
  },
};
