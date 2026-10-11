/**
 * The occasion photo collections for the home cards: one default (international) collection and one
 * entry per country, keyed by ISO 3166-1 alpha-2 code. This file is the whole registry; the home reads
 * it through src/a/lib/country.ts and never names a country itself. How to add or activate a country,
 * and the creative brief for each, are in docs/OCCASION-PHOTOS.md; `npm run photos:check` verifies it.
 *
 * A country's photos live in public/images/occasions/<CODE>/ as dinner, work, date, wedding and party,
 * each at -480.webp and -960.webp (portrait, about 2:3). A country is shown to visitors only when its
 * status is "active", which needs all five photos present, licensed, credited in that folder's
 * CREDITS.md, and reviewed. A "pending" country shows the default collection. Nothing ever borrows
 * another country's photos.
 */
import type { OccasionId } from "../shared/catalog";

export type CollectionStatus = "active" | "pending";

export interface OccasionPhoto {
  /** Path without width or extension: `${base}-480.webp` and `${base}-960.webp`. */
  base: string;
  alt: string;
  /** CSS object-position, when the subject sits off centre. */
  position?: string;
}

export interface CountryCollection {
  name: string;
  status: CollectionStatus;
  /** Bumped whenever a photo in the set changes, so analytics can tell sets apart. */
  version: number;
  /** Where the photos come from in that country; the brief in docs/OCCASION-PHOTOS.md has the rest. */
  cities: readonly string[];
  /** Alt text per photo, required before a country can be activated. */
  alt?: Partial<Record<OccasionId, string>>;
  position?: Partial<Record<OccasionId, string>>;
}

export const OCCASION_FILES: Record<OccasionId, string> = {
  DINNER: "dinner",
  WORK: "work",
  DATE: "date",
  WEDDING: "wedding",
  PARTY: "party",
};

/** The international collection: the photos the home has always used (public/images/home/CREDITS.md). */
export const DEFAULT_COLLECTION: { version: number; photos: Record<OccasionId, OccasionPhoto> } = {
  version: 1,
  photos: {
    DINNER: { base: "/images/home/dinner", alt: "A candlelit restaurant table" },
    WORK: { base: "/images/home/work", alt: "A man in a tailored suit in the city" },
    DATE: { base: "/images/home/date", alt: "Two glasses raised in a toast" },
    WEDDING: { base: "/images/home/wedding", alt: "White roses in a wedding bouquet" },
    PARTY: { base: "/images/home/party", alt: "A martini on a bar at night" },
  },
};

const pending = (name: string, cities: string[]): CountryCollection => ({ name, status: "pending", version: 1, cities });

export const COUNTRY_COLLECTIONS: Record<string, CountryCollection> = {
  /* Highest priority */
  PL: pending("Poland", ["Warsaw", "Kraków", "Gdańsk", "Wrocław"]),
  LB: pending("Lebanon", ["Beirut", "Byblos", "Batroun", "Mount Lebanon"]),
  AE: pending("United Arab Emirates", ["Dubai", "Abu Dhabi"]),
  SA: pending("Saudi Arabia", ["Riyadh", "Jeddah", "AlUla"]),
  FR: pending("France", ["Paris", "Lyon", "Bordeaux", "Nice"]),
  NL: pending("Netherlands", ["Amsterdam", "Rotterdam", "The Hague", "Utrecht"]),
  CN: pending("China", ["Shanghai", "Beijing", "Shenzhen", "Hangzhou"]),
  /* High priority */
  AT: pending("Austria", ["Vienna", "Salzburg", "Innsbruck"]),
  DE: pending("Germany", ["Berlin", "Munich", "Hamburg", "Düsseldorf"]),
  GB: pending("United Kingdom", ["London", "Edinburgh", "Manchester"]),
  IT: pending("Italy", ["Milan", "Rome", "Florence", "Lake Como"]),
  ES: pending("Spain", ["Madrid", "Barcelona", "Seville", "Marbella"]),
  CH: pending("Switzerland", ["Zurich", "Geneva", "Lausanne", "St. Moritz"]),
  QA: pending("Qatar", ["Doha", "Lusail"]),
  KW: pending("Kuwait", ["Kuwait City"]),
  BH: pending("Bahrain", ["Manama", "Muharraq"]),
  OM: pending("Oman", ["Muscat", "Salalah"]),
  JO: pending("Jordan", ["Amman", "Aqaba"]),
  EG: pending("Egypt", ["Cairo", "Alexandria", "El Gouna"]),
  MA: pending("Morocco", ["Marrakech", "Casablanca", "Rabat", "Tangier"]),
  TR: pending("Türkiye", ["Istanbul", "Bodrum", "Izmir"]),
  US: pending("United States", ["New York", "Los Angeles", "Chicago", "Miami"]),
  CA: pending("Canada", ["Toronto", "Montreal", "Vancouver"]),
  IN: pending("India", ["Mumbai", "New Delhi", "Bengaluru", "Jaipur"]),
  /* Further Arab countries */
  IQ: pending("Iraq", ["Baghdad", "Erbil", "Basra"]),
  SY: pending("Syria", ["Damascus", "Aleppo", "Latakia"]),
  PS: pending("Palestine", ["Ramallah", "Bethlehem", "Nablus"]),
  YE: pending("Yemen", ["Sana'a", "Aden"]),
  DZ: pending("Algeria", ["Algiers", "Oran", "Constantine"]),
  TN: pending("Tunisia", ["Tunis", "Sidi Bou Said", "Sousse"]),
  LY: pending("Libya", ["Tripoli", "Benghazi"]),
  SD: pending("Sudan", ["Khartoum", "Omdurman"]),
  MR: pending("Mauritania", ["Nouakchott"]),
  SO: pending("Somalia", ["Mogadishu", "Hargeisa"]),
  DJ: pending("Djibouti", ["Djibouti City"]),
  KM: pending("Comoros", ["Moroni"]),
};
