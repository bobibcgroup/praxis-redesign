/**
 * The hybrid step of the styling pipeline (src/core/service.ts), run when the server has a free store
 * feed this tab may use (see wantsRealStock in src/core/ai/stock.ts):
 *
 *   recommended looks -> styling spec per look -> store search for every part (one call)
 *   -> composition per look (store piece or Praxis reference, owned pieces kept) -> one picture per look
 *
 * Only the parts' kinds, colours and names go to the store search, never anything about the customer.
 * If the store can't be read, the looks stay as the engine sent them (example pieces) and say why.
 */
import type { StylingRequest, StylingResponse } from "../contracts";
import { callService, buildServiceRequest } from "../ai/envelope";
import { httpProvider, AI_ENDPOINT } from "../ai/http";
import { DEFINITIONS, type MatchPayload, type MatchResult } from "../ai/services";
import { liveServices } from "../ai/words";
import { STOCK_TIMEOUT_MS, wantsRealStock } from "../ai/stock";
import { compose, specFromLook, toOutfit, type ComposedLook } from "./compose";
import { fromStoreProduct, type CatalogueGarment, type StoreProduct } from "./garment";
import { visualizationProviderInUse, visualizeLooks, type OutfitVisualizationProvider } from "./visualize";

export interface HybridOptions {
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  /** Whether this tab asked for the test store (default: ?stock=live). */
  wanted?: () => boolean;
  /** The picture provider (default: the server's when it has one that may run, else the mock). */
  visualizer?: OutfitVisualizationProvider;
  /** Where the tab keeps its pictures and ledger (tests). */
  store?: Storage;
  /** Receives each look's composition record, for the history and tests. */
  onComposed?: (looks: ComposedLook[]) => void;
}

/** Composes every look from the store and the reference catalogue, then pictures each. Returns the response unchanged when no store applies. */
export async function composeHybrid(response: StylingResponse, request: StylingRequest, options: HybridOptions = {}): Promise<StylingResponse> {
  if (response.outfits.length === 0 || (response.status !== "completed" && response.status !== "partial")) return response;
  const feed = (await liveServices(options.fetcher)).find((s) => s.service === "product_matching" && !s.billable);
  if (!feed || options.signal?.aborted) return response;
  if (feed.testOnly && !(options.wanted ?? wantsRealStock)()) return response;

  const specs = response.outfits.map(specFromLook);
  const garments: MatchPayload["garments"] = specs.flatMap((spec) =>
    spec.parts
      .filter((p) => !spec.owned.some((o) => o.partId === p.partId))
      .map((p) => ({ garmentId: `${spec.outfitId}_${p.partId}`, slot: p.slot, name: p.name, ...(p.layer ? { layer: p.layer } : {}), subcategory: p.subcategory, ...(p.colour ? { colour: p.colour } : {}), formality: p.formality })),
  );
  if (!garments.length) return response;

  const provider = httpProvider<MatchPayload, MatchResult>("product_matching", AI_ENDPOINT, options.fetcher, { id: feed.provider, version: feed.version, billable: false });
  const answer = await callService(DEFINITIONS.product_matching, provider, buildServiceRequest("product_matching", { garments, budget: request.budget.band, currency: "USD" }, { anonymousSessionId: request.anonymousSessionId, userId: request.userId }), {
    signal: options.signal,
    timeoutMs: STOCK_TIMEOUT_MS,
    retries: 0,
  });
  if (answer.status !== "succeeded" && answer.status !== "partial") {
    if (options.signal?.aborted) return response;
    return { ...response, fallback: { code: "store_unavailable", message: "The store couldn’t be read, so these are example pieces." } };
  }

  const byPart = new Map<string, CatalogueGarment[]>();
  for (const m of answer.result?.matches ?? []) {
    const found = (m.products ?? []).map((p) => fromStoreProduct(p as StoreProduct)).filter((g): g is CatalogueGarment => g !== null);
    byPart.set(m.garmentId, found);
  }
  const composed = specs.map((spec) =>
    compose(spec, Object.fromEntries(spec.parts.map((p) => [p.partId, byPart.get(`${spec.outfitId}_${p.partId}`) ?? []])), { budgetMax: request.budget.maximum }),
  );
  options.onComposed?.(composed);

  const outfits = response.outfits.flatMap((o, i) => (composed[i].status === "unavailable" ? [] : [toOutfit(o, composed[i])])).map((o, i) => ({ ...o, rank: i + 1 }));
  if (!outfits.length) return { ...response, status: "empty", outfits: [], fallback: { code: "no_complete_look", message: "I couldn’t complete a look from the store and my references." } };
  const status = outfits.length < response.outfits.length || composed.some((c) => c.status === "partial") ? "partial" : response.status;
  const next: StylingResponse = { ...response, status, outfits };

  if (options.signal?.aborted) return next;
  const visualizer = options.visualizer ?? (await visualizationProviderInUse({ anonymousSessionId: request.anonymousSessionId, userId: request.userId }, options.fetcher));
  return visualizeLooks(next, visualizer, { signal: options.signal, store: options.store });
}
