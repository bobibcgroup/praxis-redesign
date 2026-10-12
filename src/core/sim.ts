/**
 * Test mode: makes the services misbehave on purpose so every state of the screens can be seen and
 * tested. It is switched on per tab from /internal (never from a link), lasts until the tab closes,
 * and every screen shows a "Test mode" tag while it is on, so a simulated answer is never mistaken
 * for a real one.
 */
import { session } from "./ids";

export const SIM_SCENARIOS = {
  fast: "Fast answer",
  slow: "Slow answer",
  timeout: "No answer (times out)",
  failure: "Service error",
  partial: "Only two looks",
  empty: "No looks",
  invalid_image: "Photo can’t be read",
  unavailable_products: "Some pieces sold out",
  validation_error: "Answer fails validation",
  retry_success: "Fails once, then works",
} as const;

export type SimScenario = keyof typeof SIM_SCENARIOS;

const KEY = "praxis_sim";

export function simScenario(): SimScenario | null {
  try {
    const v = session()?.getItem(KEY);
    return v && v in SIM_SCENARIOS ? (v as SimScenario) : null;
  } catch {
    return null;
  }
}

export function setSimScenario(scenario: SimScenario | null): void {
  try {
    if (scenario) session()?.setItem(KEY, scenario);
    else session()?.removeItem(KEY);
  } catch {
    // Storage blocked: test mode simply stays off.
  }
}

/** How long the slow scenario waits: past the point where the screen says it is taking longer. */
export const SIM_SLOW_MS = 7500;

/** Waits, unless the signal aborts first. */
export function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

/** Never settles on its own; only an abort (a cancel or the service's time limit) ends it. */
export function never(signal?: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  });
}
