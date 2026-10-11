/** Shared test fixtures: an in-memory Storage and the two scenarios from the brief. */
import type { MomentInputs } from "../request";

export function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => (data.has(k) ? (data.get(k) as string) : null),
    key: (i) => Array.from(data.keys())[i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

/** A storage whose writes always fail, as when it is full or blocked. */
export function brokenStorage(): Storage {
  const s = memoryStorage();
  return {
    ...s,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
}

/** Scenario A: dinner at a restaurant at night, sharp, $300 to $900. */
export const SCENARIO_A: MomentInputs = { occasion: "DINNER", venue: "RESTAURANT", time: "NIGHT", vibe: "SHARP", spend: "ELEVATED" };

/** Scenario B: dinner at someone's home at sunset (dinner has no daytime), relaxed, under $300. */
export const SCENARIO_B: MomentInputs = { occasion: "DINNER", venue: "HOME", time: "SUNSET", vibe: "RELAXED", spend: "SENSIBLE" };

export const ANON = "anon_test";
export const FIXED_NOW = new Date("2026-10-10T12:00:00.000Z");
