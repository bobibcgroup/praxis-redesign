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

/** Made with Google Gemini in the mood of the Round 2 review's reference board; see CREDITS.md. Bump the version whenever a photo changes. */
export const OCCASION_PHOTOS: { version: number; photos: Record<OccasionId, OccasionPhoto> } = {
  version: 3,
  photos: {
    DINNER: { base: "/images/home/dinner", alt: "A candlelit table for two with crystal glasses and white roses beside a velvet banquette" },
    WORK: { base: "/images/home/work", alt: "A man in a taupe double breasted suit before an arched wooden door and an olive tree" },
    DATE: { base: "/images/home/date", alt: "A smiling couple sharing espresso by candlelight in a café strung with lights" },
    WEDDING: { base: "/images/home/wedding", alt: "A long wedding table with white roses and taper candles between tall arched windows" },
    PARTY: { base: "/images/home/party", alt: "A wood panelled cocktail lounge with burgundy velvet chairs, brass lamps and a glowing bar" },
  },
};
