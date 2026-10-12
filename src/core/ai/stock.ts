/**
 * Real pieces from a store, for testing: whether this tab uses the store feed, and how long the looks
 * wait for it. The composing itself is src/core/catalogue/hybrid.ts.
 *
 * While the feed is for testing only, a browser uses it only after the site was opened with
 * ?stock=live (remembered for the tab; ?stock=off stops it).
 */

const FLAG = "praxis_real_stock";
/** How long the looks may wait for the store. */
export const STOCK_TIMEOUT_MS = 8000;

/** Whether this tab asked for the test store: ?stock=live turns it on, ?stock=off turns it off. */
export function wantsRealStock(): boolean {
  try {
    const asked = new URLSearchParams(window.location.search).get("stock");
    if (asked === "live") window.sessionStorage.setItem(FLAG, "1");
    if (asked === "off") window.sessionStorage.removeItem(FLAG);
    return window.sessionStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}
