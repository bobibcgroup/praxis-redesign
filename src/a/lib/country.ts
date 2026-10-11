/**
 * Which country the home's occasion photos are for, and which photos that means. Photography only:
 * nothing here reaches the styling questions, the looks, prices or language.
 *
 * Country, strongest first:
 *   1. manual    the visitor chose one in the country picker (kept in this browser)
 *   2. hosting   a trusted proxy header, written into the page by our server
 *   3. ip        our server's own lookup in the bundled DB-IP database, written into the page
 *   4. language  a region in the browser language (pl-PL, not en-*), a weak hint
 *   5. default   none of the above
 * The server never asks for GPS and the browser is never asked for location. Only the two letter code
 * is kept, and only when the visitor picks one.
 *
 * Photos: the country's collection when it is active in src/config/occasionCollections.ts, otherwise
 * the default collection. Never a neighbour's. `?photos=PL` previews a pending collection for review.
 */
import { useCallback, useSyncExternalStore } from "react";
import { COUNTRY_COLLECTIONS, DEFAULT_COLLECTION, OCCASION_FILES, type OccasionPhoto } from "../../config/occasionCollections";
import type { OccasionId } from "../../shared/catalog";
import { countryName, validCountry } from "../../shared/countries";
import { track } from "../../core/analytics";

export const COUNTRY_KEY = "praxis_country";

export type CountrySource = "manual" | "hosting" | "ip" | "language" | "default";

export interface CountryResolution {
  countryCode: string | null;
  source: CountrySource;
  confidence: "high" | "medium" | "low";
  resolvedAt: string;
}

export interface Signals {
  manual?: string | null;
  page?: { code: string | null; source: string | null } | null;
  languages?: readonly string[];
}

const CONFIDENCE: Record<CountrySource, CountryResolution["confidence"]> = { manual: "high", hosting: "high", ip: "medium", language: "low", default: "low" };

export function resolveCountry(s: Signals, now = new Date()): CountryResolution {
  const out = (countryCode: string | null, source: CountrySource): CountryResolution => ({ countryCode, source, confidence: CONFIDENCE[source], resolvedAt: now.toISOString() });
  const manual = validCountry(s.manual);
  if (manual) return out(manual, "manual");
  const page = validCountry(s.page?.code);
  if (page) return out(page, s.page?.source === "hosting" ? "hosting" : "ip");
  /* English with a region (en-US, en-GB) is the default on browsers everywhere, so it says nothing. */
  for (const tag of s.languages ?? []) {
    if (/^en\b/i.test(tag)) continue;
    const region = /^[a-z]{2,3}[-_]([a-z]{2})\b/i.exec(tag)?.[1];
    const cc = validCountry(region);
    if (cc) return out(cc, "language");
  }
  return out(null, "default");
}

export interface CardPhoto extends OccasionPhoto {
  /** Where the photo was taken, shown small on the card; only for a country's own photos. */
  place?: string;
  /** The default photo for the same occasion, swapped in if this one fails to load. */
  fallback: string;
}

export interface Collection {
  /** The country whose photos these are, or null for the default collection. */
  code: string | null;
  version: number;
  photos: Record<OccasionId, CardPhoto>;
}

const OCCASION_IDS = Object.keys(OCCASION_FILES) as OccasionId[];

/** The photos for a country: its own when active (or previewed), else the default set. */
export function collectionFor(code: string | null, preview: string | null = null): Collection {
  const target = preview ?? code;
  const entry = target ? COUNTRY_COLLECTIONS[target] : undefined;
  const usable = entry && (entry.status === "active" || target === preview);
  const photos = {} as Record<OccasionId, CardPhoto>;
  for (const id of OCCASION_IDS) {
    const fallback = DEFAULT_COLLECTION.photos[id];
    photos[id] = usable
      ? { base: `/images/occasions/${target}/${OCCASION_FILES[id]}`, alt: entry.alt?.[id] ?? fallback.alt, place: entry.places?.[id], position: entry.position?.[id], fallback: fallback.base }
      : { ...fallback, fallback: fallback.base };
  }
  return usable ? { code: target, version: entry.version, photos } : { code: null, version: DEFAULT_COLLECTION.version, photos };
}

/** Countries with an active collection, for tests and the picker. */
export const activeCountries = () => Object.keys(COUNTRY_COLLECTIONS).filter((c) => COUNTRY_COLLECTIONS[c].status === "active");

/* The browser side: read the signals once, keep the manual choice in localStorage. */

function readManual(): string | null {
  try {
    return validCountry(localStorage.getItem(COUNTRY_KEY));
  } catch {
    return null;
  }
}

function readPage() {
  if (typeof document === "undefined") return null;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="praxis-country"]');
  return meta ? { code: meta.content, source: meta.dataset.source ?? null } : null;
}

const listeners = new Set<() => void>();
let current: CountryResolution | null = null;

function compute(): CountryResolution {
  return resolveCountry({ manual: readManual(), page: readPage(), languages: typeof navigator === "undefined" ? [] : navigator.languages });
}

function snapshot(): CountryResolution {
  current ??= compute();
  return current;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Choose a country (or null to go back to automatic). */
export function setManualCountry(code: string | null) {
  const before = snapshot().countryCode;
  try {
    if (code) localStorage.setItem(COUNTRY_KEY, code);
    else localStorage.removeItem(COUNTRY_KEY);
  } catch {
    /* Private mode: the choice holds for this page only. */
  }
  current = code ? resolveCountry({ manual: code }) : resolveCountry({ page: readPage(), languages: navigator.languages });
  track("country_manually_changed", { previous: before ?? "none", next: current.countryCode ?? "none", automatic: code === null });
  listeners.forEach((fn) => fn());
}

export function useCountry() {
  const resolution = useSyncExternalStore(subscribe, snapshot, snapshot);
  const choose = useCallback((code: string | null) => setManualCountry(code), []);
  return { resolution, name: resolution.countryCode ? countryName(resolution.countryCode) : null, choose };
}

/** The preview code from `?photos=XX`, only for countries in the registry. */
export function previewCode(params: URLSearchParams): string | null {
  const cc = validCountry(params.get("photos"));
  return cc && COUNTRY_COLLECTIONS[cc] ? cc : null;
}
