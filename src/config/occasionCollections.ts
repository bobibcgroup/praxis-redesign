/**
 * The occasion photo collections for the home cards: one default (international) collection and one
 * entry per country, keyed by ISO 3166-1 alpha-2 code. This file is the whole registry; the home reads
 * it through src/a/lib/country.ts and never names a country itself. How to add or activate a country,
 * and the creative brief for each, are in docs/OCCASION-PHOTOS.md; `npm run photos:check` verifies it.
 *
 * A country's photos live in public/images/occasions/<CODE>/ as dinner, work, date, wedding and party,
 * each at -480.webp and -960.webp (4:3, 480 x 360 and 960 x 720, the cards' own shape). A country is shown to visitors only when its
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
  /** The city shown small on each card, only where the photo page confirms it. */
  places?: Partial<Record<OccasionId, string>>;
  position?: Partial<Record<OccasionId, string>>;
}

export const OCCASION_FILES: Record<OccasionId, string> = {
  DINNER: "dinner",
  WORK: "work",
  DATE: "date",
  WEDDING: "wedding",
  PARTY: "party",
};

/** The international collection, one campaign from the Round 2 review's reference board (public/images/home/CREDITS.md). */
export const DEFAULT_COLLECTION: { version: number; photos: Record<OccasionId, OccasionPhoto> } = {
  version: 2,
  photos: {
    DINNER: { base: "/images/home/dinner", alt: "A candlelit table with cut glass goblets under soft warm light" },
    WORK: { base: "/images/home/work", alt: "A man in a taupe double breasted suit in front of an arched doorway" },
    DATE: { base: "/images/home/date", alt: "A couple sharing coffee by candlelight under string lights" },
    WEDDING: { base: "/images/home/wedding", alt: "A long wedding table with white flowers beneath tall arched windows" },
    PARTY: { base: "/images/home/party", alt: "A lounge bar in burgundy velvet lit by small table lamps" },
  },
};

const pending = (name: string, cities: string[]): CountryCollection => ({ name, status: "pending", version: 1, cities });

export const COUNTRY_COLLECTIONS: Record<string, CountryCollection> = {
  /* Highest priority */
  PL: pending("Poland", ["Warsaw", "Kraków", "Gdańsk", "Wrocław"]),
  LB: {
    name: "Lebanon",
    status: "active",
    version: 1,
    cities: ["Beirut", "Byblos", "Batroun", "Mount Lebanon"],
    alt: {
      DINNER: "A long table under the triple arched windows of a Beirut house",
      WORK: "A man in a navy suit and blue shirt",
      DATE: "A seafront restaurant lit at dusk on the Beirut coast",
      WEDDING: "A bride with a sunflower bouquet, in black and white",
      PARTY: "A bar open to the street in Gemmayzeh at evening, a scooter outside",
    },
    places: { DINNER: "Beirut", WORK: "Beirut", DATE: "Beirut", WEDDING: "Beirut", PARTY: "Gemmayzeh" },
  },
  AE: pending("United Arab Emirates", ["Dubai", "Abu Dhabi"]),
  SA: pending("Saudi Arabia", ["Riyadh", "Jeddah", "AlUla"]),
  FR: {
    name: "France",
    status: "active",
    version: 1,
    cities: ["Paris", "Lyon", "Bordeaux", "Nice"],
    alt: {
      DINNER: "A Paris café front hung with flowers and warm lights",
      WORK: "A man in a dark suit walking along a Paris street",
      DATE: "A couple at a riverside terrace table in Paris",
      WEDDING: "A bride and groom walking past a Paris café",
      PARTY: "Guests in silhouette at a lit hotel bar in Paris",
    },
    places: { DINNER: "Paris", WORK: "Paris", DATE: "Paris", WEDDING: "Paris", PARTY: "Paris" },
  },
  NL: {
    name: "Netherlands",
    status: "active",
    version: 1,
    cities: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht"],
    alt: {
      DINNER: "A candlelit Amsterdam restaurant under an iron staircase",
      WORK: "A man adjusting his tie, a watch on his wrist",
      DATE: "Canal side restaurant terraces in Utrecht at dusk",
      WEDDING: "A bride and groom kissing among guests holding sparklers",
      PARTY: "A warm lit back bar in Amsterdam",
    },
    places: { DINNER: "Amsterdam", WORK: "Tilburg", WEDDING: "Sas van Gent", PARTY: "Amsterdam" },
  },
  CN: {
    name: "China",
    status: "active",
    version: 1,
    cities: ["Shanghai", "Beijing", "Shenzhen", "Hangzhou"],
    alt: {
      DINNER: "A dark fine dining room in Shanghai under low pendant lights",
      WORK: "A man in a suit crossing a Shanghai street between stone buildings and towers",
      DATE: "A lantern lit pleasure boat on West Lake in the evening",
      WEDDING: "A gold bridal crown on a red wedding table",
      PARTY: "The Shanghai skyline lit at night along the river",
    },
    places: { DINNER: "Shanghai", WORK: "Shanghai", DATE: "Hangzhou", PARTY: "Shanghai" },
  },
  /* High priority */
  AT: {
    name: "Austria",
    status: "active",
    version: 1,
    cities: ["Vienna", "Salzburg", "Innsbruck"],
    alt: {
      DINNER: "Diners under the vaulted arcades of a Vienna café",
      WORK: "Modern office buildings in Vienna",
      DATE: "A couple walking hand in hand on a sunlit Vienna street",
      WEDDING: "A bride and groom walking through a meadow at sunset",
      PARTY: "A grand Vienna hotel lit at night",
    },
    places: { DINNER: "Vienna", WORK: "Vienna", DATE: "Vienna", WEDDING: "Mönchdorf", PARTY: "Vienna" },
  },
  DE: {
    name: "Germany",
    status: "active",
    version: 1,
    cities: ["Berlin", "Munich", "Hamburg", "Düsseldorf"],
    alt: {
      DINNER: "Wine glasses on a white tablecloth in a Munich restaurant",
      WORK: "A man in a tailored jacket and dark shirt",
      DATE: "Rosé and a vase of roses on a table set for two",
      WEDDING: "A bride and groom at the altar of a Bavarian church",
      PARTY: "Berlin at blue hour with the TV tower",
    },
    places: { DINNER: "Munich", WORK: "Munich", DATE: "Ettlingen", WEDDING: "Munich", PARTY: "Berlin" },
  },
  GB: pending("United Kingdom", ["London", "Edinburgh", "Manchester"]),
  IT: pending("Italy", ["Milan", "Rome", "Florence", "Lake Como"]),
  ES: pending("Spain", ["Madrid", "Barcelona", "Seville", "Marbella"]),
  CH: {
    name: "Switzerland",
    status: "active",
    version: 1,
    cities: ["Zurich", "Geneva", "Lausanne", "St. Moritz"],
    alt: {
      DINNER: "A Zurich restaurant with a long bar and diners",
      WORK: "Men walking through a modern Zurich business quarter",
      DATE: "A couple walking through an arched lane in Zurich old town",
      WEDDING: "A candlelit wedding table in a stone vaulted cellar",
      PARTY: "Zurich old town lit at night across the river",
    },
    places: { DINNER: "Zurich", WORK: "Zurich", DATE: "Zurich", WEDDING: "Zurich", PARTY: "Zurich" },
  },
  QA: {
    name: "Qatar",
    status: "active",
    version: 1,
    cities: ["Doha", "Lusail"],
    alt: {
      DINNER: "A terrace table facing the Doha skyline at night",
      WORK: "Doha towers seen from below",
      DATE: "A couple on the shore facing the Doha skyline at dusk",
      WEDDING: "A newly engaged couple laughing together",
      PARTY: "Doha West Bay towers at dusk framed by palms",
    },
    places: { DINNER: "Doha", WORK: "Doha", DATE: "Doha", WEDDING: "Doha", PARTY: "Doha" },
  },
  KW: pending("Kuwait", ["Kuwait City"]),
  BH: pending("Bahrain", ["Manama", "Muharraq"]),
  OM: pending("Oman", ["Muscat", "Salalah"]),
  JO: pending("Jordan", ["Amman", "Aqaba"]),
  EG: pending("Egypt", ["Cairo", "Alexandria", "El Gouna"]),
  MA: pending("Morocco", ["Marrakech", "Casablanca", "Rabat", "Tangier"]),
  TR: {
    name: "Türkiye",
    status: "active",
    version: 1,
    cities: ["Istanbul", "Bodrum", "Izmir"],
    alt: {
      DINNER: "A dining room behind red curtains in Istanbul",
      WORK: "A man in a dark suit and tie in Istanbul",
      DATE: "A couple at a ferry window crossing the Bosphorus",
      WEDDING: "A bride and groom by the sea in Istanbul",
      PARTY: "A waterfront terrace in Ortaköy at night, the Bosphorus Bridge lit",
    },
    places: { DINNER: "Istanbul", WORK: "Istanbul", DATE: "Istanbul", WEDDING: "Istanbul", PARTY: "Istanbul" },
  },
  US: {
    name: "United States",
    status: "active",
    version: 1,
    cities: ["New York", "Los Angeles", "Chicago", "Miami"],
    alt: {
      DINNER: "A dim New York dining room lit by table lamps",
      WORK: "A man in a suit jacket in a Manhattan crowd",
      DATE: "A couple by the water facing the lit Manhattan skyline",
      WEDDING: "Newlyweds walking under a white umbrella in Central Park",
      PARTY: "A rooftop bar above New York at dusk",
    },
    places: { DINNER: "New York", WORK: "New York", DATE: "New York", WEDDING: "New York", PARTY: "New York" },
  },
  CA: {
    name: "Canada",
    status: "active",
    version: 1,
    cities: ["Toronto", "Montreal", "Vancouver"],
    alt: {
      DINNER: "A busy brick and glass restaurant in Toronto",
      WORK: "A man in a dark overcoat on a downtown Toronto street",
      DATE: "A couple walking down a Montreal street under red blossoms",
      WEDDING: "A wedding reception under hanging lights in a Toronto church hall",
      PARTY: "A wood and marble bar in Toronto",
    },
    places: { DINNER: "Toronto", WORK: "Toronto", DATE: "Montreal", WEDDING: "Toronto", PARTY: "Toronto" },
  },
  IN: {
    name: "India",
    status: "active",
    version: 1,
    cities: ["Mumbai", "New Delhi", "Bengaluru", "Jaipur"],
    alt: {
      DINNER: "A regal dining room with crystal chandeliers in Jaipur",
      WORK: "A man before glass towers in Gurugram at dusk",
      DATE: "A couple on the Mumbai seafront facing the sea link",
      WEDDING: "A groom laughing with guests at a wedding in Pune",
      PARTY: "Mumbai towers lit at night",
    },
    places: { DINNER: "Jaipur", WORK: "Gurugram", DATE: "Mumbai", WEDDING: "Pune", PARTY: "Mumbai" },
  },
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
