/**
 * The occasion photo registry and the country resolution. Run on its own with `npm run photos:check`.
 * An active country must have all ten files (five photos at two widths), portrait, with alt text and a
 * CREDITS.md; nothing may point at another country's folder.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COUNTRY_COLLECTIONS, DEFAULT_COLLECTION, OCCASION_FILES } from "../occasionCollections";
import { collectionFor, resolveCountry } from "../../a/lib/country";
import { validCountry } from "../../shared/countries";
// @ts-expect-error plain JS module
import { countryForIp, loadGeo } from "../../../server/geo.mjs";

const PUBLIC = join(__dirname, "../../../public");
const OCCASIONS = Object.keys(OCCASION_FILES) as (keyof typeof OCCASION_FILES)[];
const PRIORITY = ["PL", "LB", "AE", "SA", "FR", "NL", "CN"];

/** Width and height of a WebP file, from its header. */
function webpSize(path: string): { w: number; h: number } | null {
  const b = readFileSync(path);
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") return null;
  const kind = b.toString("ascii", 12, 16);
  if (kind === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (kind === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  if (kind === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

describe("occasion photo registry", () => {
  it("lists every required country with its own entry", () => {
    const required = [...PRIORITY, "AT", "DE", "GB", "IT", "ES", "CH", "QA", "KW", "BH", "OM", "JO", "EG", "MA", "TR", "US", "CA", "IN", "IQ", "SY", "PS", "YE", "DZ", "TN", "LY", "SD", "MR", "SO", "DJ", "KM"];
    for (const cc of required) expect(COUNTRY_COLLECTIONS[cc], cc).toBeDefined();
    for (const cc of Object.keys(COUNTRY_COLLECTIONS)) expect(validCountry(cc), cc).toBe(cc);
  });

  it("has the default collection on disk", () => {
    for (const id of OCCASIONS) for (const w of [480, 960]) expect(existsSync(join(PUBLIC, `${DEFAULT_COLLECTION.photos[id].base}-${w}.webp`))).toBe(true);
  });

  for (const [cc, entry] of Object.entries(COUNTRY_COLLECTIONS).filter(([, e]) => e.status === "active")) {
    it(`${cc} (${entry.name}) is complete, portrait, described and credited`, () => {
      const dir = join(PUBLIC, "images/occasions", cc);
      expect(existsSync(join(dir, "CREDITS.md")), "CREDITS.md").toBe(true);
      for (const id of OCCASIONS) {
        expect(entry.alt?.[id], `alt for ${id}`).toBeTruthy();
        for (const w of [480, 960]) {
          const file = join(dir, `${OCCASION_FILES[id]}-${w}.webp`);
          expect(existsSync(file), file).toBe(true);
          const size = webpSize(file);
          expect(size?.w, file).toBe(w);
          expect(size!.h / size!.w, `${file} is portrait`).toBeGreaterThanOrEqual(1.2);
        }
      }
    });
  }
});

describe("country resolution", () => {
  const now = new Date("2026-10-11T12:00:00Z");
  it("puts a manual choice first", () => {
    expect(resolveCountry({ manual: "PL", page: { code: "LB", source: "ip" }, languages: ["fr-FR"] }, now)).toEqual({ countryCode: "PL", source: "manual", confidence: "high", resolvedAt: now.toISOString() });
  });
  it("then the page's hosting or IP country", () => {
    expect(resolveCountry({ page: { code: "LB", source: "ip" }, languages: ["fr-FR"] }, now).source).toBe("ip");
    expect(resolveCountry({ page: { code: "ae", source: "hosting" } }, now)).toMatchObject({ countryCode: "AE", source: "hosting", confidence: "high" });
  });
  it("then a region in the browser language, as a weak hint", () => {
    expect(resolveCountry({ languages: ["en", "pl-PL"] }, now)).toMatchObject({ countryCode: "PL", source: "language", confidence: "low" });
    expect(resolveCountry({ languages: ["en-US", "en-GB"] }, now).source).toBe("default");
  });
  it("ignores anything that is not a country", () => {
    expect(resolveCountry({ manual: "<script>", page: { code: "ZZ", source: "ip" }, languages: ["en"] }, now)).toMatchObject({ countryCode: null, source: "default" });
    expect(resolveCountry({ manual: "../PL" }, now).countryCode).toBeNull();
  });
});

describe("collection choice", () => {
  it("switches all five paths for each priority country when previewed", () => {
    for (const cc of PRIORITY) {
      const c = collectionFor(null, cc);
      expect(c.code).toBe(cc);
      for (const id of OCCASIONS) {
        expect(c.photos[id].base).toBe(`/images/occasions/${cc}/${OCCASION_FILES[id]}`);
        expect(c.photos[id].fallback).toBe(DEFAULT_COLLECTION.photos[id].base);
      }
    }
  });
  it("uses a country's own photos only when it is active, and never another country's", () => {
    for (const [cc, entry] of Object.entries(COUNTRY_COLLECTIONS)) {
      const c = collectionFor(cc);
      if (entry.status === "active") expect(c.code).toBe(cc);
      else expect(c.code).toBeNull();
      for (const id of OCCASIONS) expect(c.photos[id].base.startsWith(`/images/occasions/${cc}/`) || c.photos[id].base === DEFAULT_COLLECTION.photos[id].base).toBe(true);
    }
  });
  it("gives the default set to unknown and unsupported countries", () => {
    expect(collectionFor(null).code).toBeNull();
    expect(collectionFor("PT").code).toBeNull();
    expect(collectionFor("PT").photos.DINNER.base).toBe(DEFAULT_COLLECTION.photos.DINNER.base);
  });
});

describe("server IP lookup", () => {
  it("maps addresses to countries and drops the rest", async () => {
    await loadGeo();
    expect(countryForIp("83.1.1.1")).toBe("PL");
    expect(countryForIp("2a02:a310::1")).toBe("PL");
    expect(countryForIp("::ffff:83.1.1.1")).toBe("PL");
    expect(countryForIp("8.8.8.8")).toBe("US");
    expect(countryForIp("10.0.0.1")).toBeNull();
    expect(countryForIp("not an ip")).toBeNull();
  }, 20000);
});
