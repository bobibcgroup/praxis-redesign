/** Every ISO 3166-1 alpha-2 country, for the country picker. Names come from the browser in English. */
export const COUNTRY_CODES = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT " +
  "MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG " +
  "UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW"
).split(" ");

const KNOWN = new Set(COUNTRY_CODES);

/** A valid, known country code in upper case, or null. */
export function validCountry(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cc = raw.trim().toUpperCase();
  return KNOWN.has(cc) ? cc : null;
}

/* Our own names where the browser's differ from common usage or use a dash. */
const OVERRIDES: Record<string, string> = { TR: "Türkiye", PS: "Palestine", XK: "Kosovo", CG: "Republic of the Congo", CD: "Democratic Republic of the Congo" };
let names: Intl.DisplayNames | null = null;

export function countryName(code: string): string {
  if (OVERRIDES[code]) return OVERRIDES[code];
  try {
    names ??= new Intl.DisplayNames(["en"], { type: "region" });
    return (names.of(code) ?? code).replace(/\s+[-–]\s+/g, " ");
  } catch {
    return code;
  }
}
