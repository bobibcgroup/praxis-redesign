/**
 * The country picker behind the home's small "Location" line. It changes the occasion photos only:
 * never the language, prices, questions or looks. A chosen country is kept in this browser until
 * Automatic is chosen again. Searchable, keyboard friendly, and a bottom sheet on a phone.
 */
import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { COUNTRY_COLLECTIONS } from "../../config/occasionCollections";
import { COUNTRY_CODES, countryName } from "../../shared/countries";
import { resolveCountry, useCountry } from "../lib/country";
import { Sheet } from "./Sheet";

const ALL = COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name, "en"));
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function CountrySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { resolution, choose } = useCountry();
  const [query, setQuery] = useState("");
  const manual = resolution.source === "manual";
  const detected = useMemo(() => {
    const meta = typeof document === "undefined" ? null : document.querySelector<HTMLMetaElement>('meta[name="praxis-country"]');
    return resolveCountry({ page: meta ? { code: meta.content, source: meta.dataset.source ?? null } : null, languages: typeof navigator === "undefined" ? [] : navigator.languages }).countryCode;
  }, []);
  const shown = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return ALL;
    /* Names that start with the search first, then names with a word that does, then the rest. */
    const rank = (name: string) => (name.startsWith(q) ? 0 : name.split(/\s+/).some((w) => w.startsWith(q)) ? 1 : 2);
    return ALL.filter((c) => fold(c.name).includes(q) || c.code.toLowerCase() === q).sort((a, b) => rank(fold(a.name)) - rank(fold(b.name)));
  }, [query]);

  const pick = (code: string | null) => {
    choose(code);
    setQuery("");
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} label="Location">
      <p className="text-[15px] leading-6 text-[var(--muted)]">
        I choose the occasion photos for where you are. If you’re travelling or using a VPN, pick the country you’d like to see.
      </p>
      <button type="button" className="a-country-row a-transition mt-6" aria-pressed={!manual} onClick={() => pick(null)}>
        <span>
          Automatic
          {detected ? <span className="hint">{countryName(detected)}</span> : null}
        </span>
        {!manual ? <Check size={16} strokeWidth={1.5} aria-hidden="true" /> : null}
      </button>
      <label className="mt-6 block">
        <span className="a-label text-[var(--muted)]">Search countries</span>
        <input className="a-input a-country-search mt-2" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Poland" autoComplete="off" />
      </label>
      <ul className="a-country-list mt-3" aria-label="Countries">
        {shown.map((c) => {
          const current = manual && resolution.countryCode === c.code;
          const own = COUNTRY_COLLECTIONS[c.code]?.status === "active";
          return (
            <li key={c.code}>
              <button type="button" className="a-country-row a-transition" aria-pressed={current} onClick={() => pick(c.code)}>
                <span>
                  {c.name}
                  {own ? <span className="hint">Own photos</span> : null}
                </span>
                {current ? <Check size={16} strokeWidth={1.5} aria-hidden="true" /> : null}
              </button>
            </li>
          );
        })}
        {shown.length === 0 ? <li className="py-3 text-[15px] text-[var(--muted)]">No country matches that.</li> : null}
      </ul>
      <p className="mt-6 text-[13px] leading-5 text-[var(--muted)]">
        I only use your country, never your exact location.{" "}
        <a href="https://db-ip.com" target="_blank" rel="noreferrer" className="underline underline-offset-4">
          IP Geolocation by DB-IP
        </a>
      </p>
    </Sheet>
  );
}
