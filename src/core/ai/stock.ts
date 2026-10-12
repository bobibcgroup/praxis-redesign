/**
 * Real pieces from a store, for testing. When the server has a free product_matching feed switched on
 * (server/providers/shopify-feed.mjs), each piece to buy in a look is swapped for the store's closest
 * piece of the same kind and colour, with its real name, price, photo, sizes in stock and link.
 *
 * While the feed is for testing only, a browser uses it only after the site was opened with
 * ?stock=live (remembered for the tab; ?stock=off stops it). Anything late, refused or malformed
 * leaves the look's pieces as they were. Only the pieces' kinds and names are sent, never the customer.
 */
import type { Garment, ProductRef, StylingRequest, StylingResponse } from "../contracts";
import { purchaseRoute } from "../validate";
import { callService, buildServiceRequest } from "./envelope";
import { httpProvider, AI_ENDPOINT } from "./http";
import { DEFINITIONS, type MatchPayload, type MatchResult } from "./services";
import { liveServices } from "./words";

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

/** A matched store piece, checked like any feed's: an https link only, a real price, the right currency. */
function cleanProduct(p: ProductRef & { title?: unknown }): { product: ProductRef; title?: string } | null {
  if (!p || typeof p.price !== "number" || !(p.price > 0) || p.currency !== "USD") return null;
  const { title, ...rest } = p;
  const product: ProductRef = { ...rest, purchase: purchaseRoute(p.purchase) ?? { kind: "none", reason: "not_supported" } };
  if (product.productUrl && !/^https:\/\//i.test(product.productUrl)) delete product.productUrl;
  if (product.imageUrl && !/^https:\/\//i.test(product.imageUrl)) delete product.imageUrl;
  return { product, ...(typeof title === "string" && title.trim() ? { title: title.trim().slice(0, 80) } : {}) };
}

/** The response with each matched piece swapped in, and each look's total from its pieces. */
export function withRealPieces(response: StylingResponse, result: MatchResult | undefined): StylingResponse {
  const best = new Map<string, { product: ProductRef; title?: string }>();
  for (const m of result?.matches ?? []) {
    const first = (m.products ?? []).map((p) => cleanProduct(p)).find(Boolean);
    if (first) best.set(m.garmentId, first);
  }
  if (!best.size) return response;
  const outfits = response.outfits.map((o) => {
    let changed = false;
    const garments: Garment[] = o.garments.map((g) => {
      if (g.source !== "retail") return g;
      const hit = best.get(g.garmentId);
      if (!hit) return g;
      changed = true;
      return { ...g, name: hit.title ?? g.name, product: hit.product };
    });
    if (!changed) return o;
    const retail = garments.filter((g) => g.source === "retail");
    const total = Math.round(retail.reduce((s, g) => s + (g.source === "retail" ? g.product.price : 0), 0) * 100) / 100;
    const allLive = retail.every((g) => g.source === "retail" && g.product.priceStatus === "live");
    // The budget line spoke of example prices; with the store's prices it says what the pieces cost.
    const factors = allLive ? o.explanation.contributingFactors.map((f) => (f.factor === "budget" ? { ...f, influence: `Real prices, $${Math.round(total)} for the pieces to buy` } : f)) : o.explanation.contributingFactors;
    return { ...o, garments, explanation: { ...o.explanation, contributingFactors: factors }, pricing: { ...o.pricing, total, status: allLive ? ("live" as const) : o.pricing.status } };
  });
  return { ...response, outfits };
}

/**
 * Asks the server's store feed for real pieces when it has one this browser may use, and returns the
 * response with them. Otherwise, or on any problem, returns the response as it was.
 */
export async function addRealPieces(response: StylingResponse, request: StylingRequest, options: { signal?: AbortSignal; fetcher?: typeof fetch; wanted?: () => boolean } = {}): Promise<StylingResponse> {
  if (response.outfits.length === 0 || (response.status !== "completed" && response.status !== "partial")) return response;
  const feed = (await liveServices(options.fetcher)).find((s) => s.service === "product_matching" && !s.billable);
  if (!feed || options.signal?.aborted) return response;
  if ((feed as { testOnly?: boolean }).testOnly && !(options.wanted ?? wantsRealStock)()) return response;
  const garments = response.outfits.flatMap((o) => o.garments.filter((g) => g.source === "retail").map((g) => ({ garmentId: g.garmentId, slot: g.slot, name: g.name })));
  if (!garments.length) return response;
  const provider = httpProvider<MatchPayload, MatchResult>("product_matching", AI_ENDPOINT, options.fetcher, { id: feed.provider, version: feed.version, billable: false });
  const payload: MatchPayload = { garments, budget: request.budget.band, currency: "USD" };
  const answer = await callService(DEFINITIONS.product_matching, provider, buildServiceRequest("product_matching", payload, { anonymousSessionId: request.anonymousSessionId, userId: request.userId }), {
    signal: options.signal,
    timeoutMs: STOCK_TIMEOUT_MS,
    retries: 0,
  });
  return answer.status === "succeeded" || answer.status === "partial" ? withRealPieces(response, answer.result) : response;
}
