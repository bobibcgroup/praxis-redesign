/**
 * Build-time configuration. Values come from Vite environment variables (VITE_*) set in the
 * deployment, never from the page, so a visitor cannot switch an adapter or a price.
 */

declare const __APP_VERSION__: string | undefined;

/** The deployed build, stamped on every analytics event. */
export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

function env(name: string): string | undefined {
  try {
    const value = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[name];
    return value && value.trim() !== "" ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** Which recommendation adapter answers styling requests. Only "mock" exists today; service.ts falls back to it. */
export const RECOMMENDATION_ADAPTER: string = env("VITE_RECOMMENDATION_ADAPTER") ?? "mock";

/**
 * The one switch for image services that cost money (analysis, generation, try-on). Off unless the
 * deployment sets VITE_ALLOW_BILLABLE_IMAGES=true; vision.ts refuses billable calls while it is off.
 */
export const ALLOW_BILLABLE_IMAGES: boolean = env("VITE_ALLOW_BILLABLE_IMAGES") === "true";

/**
 * Which try-on adapter makes the picture. "mock" (the default) makes none and says so. "http" sends the
 * photo and the look to this app's own server (POST /api/tryon), which hands it to the provider set up
 * there; provider keys live only on the server. The http adapter is billable, so it also needs
 * VITE_ALLOW_BILLABLE_IMAGES=true, and the server needs its own switch (see server/tryon.mjs).
 */
export const TRYON_ADAPTER: "mock" | "http" = env("VITE_TRYON_ADAPTER") === "http" ? "http" : "mock";

/** The one subscription. Style DNA is the experience; Premium is the subscription it belongs to. */
export const PREMIUM = {
  name: "Premium",
  amount: 9,
  currency: "USD",
  period: "month",
} as const;

/** "$9 a month", from the configuration above. */
export function premiumPrice(): string {
  return `$${PREMIUM.amount} a ${PREMIUM.period}`;
}

/** "$9", for the pay button. */
export function premiumAmount(): string {
  return `$${PREMIUM.amount}`;
}
