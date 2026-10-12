/**
 * The styling service: the one door the screens use to ask for looks. It hands the request to an
 * adapter (the mock today, a production engine later), validates whatever comes back, and records
 * the pair in the request history. Swapping the adapter changes nothing above this file.
 */
import { createMockAdapter } from "./adapters/mock";
import { isLive, serviceRecommendationAdapter, serviceRetailer } from "./ai/bridge";
import { RECOMMENDATION_ADAPTER } from "./config";
import type { StylingRequest, StylingResponse } from "./contracts";
import { local, readJson, writeJson } from "./ids";
import { TIMEOUT_MS } from "./processing";
import { createMockRetailer, matchProducts, type RetailerAdapter } from "./retail";
import { never, simScenario, SIM_SLOW_MS, wait, type SimScenario } from "./sim";
import { failedResponse, validateStylingResponse } from "./validate";

export interface RecommendationAdapter {
  readonly id: string;
  readonly version: string;
  /** Returns the raw answer; the service validates it, so an adapter can never break a screen. */
  recommend(request: StylingRequest, options: { signal?: AbortSignal }): Promise<unknown>;
}

export interface StylingService {
  readonly adapter: { id: string; version: string };
  recommend(request: StylingRequest, options?: { signal?: AbortSignal }): Promise<StylingResponse>;
}

export interface ServiceOptions {
  /** Looks up sizes, stock and how to buy, after validation. None: pieces stay as the engine sent them. */
  retailer?: RetailerAdapter;
  /** Gives up after this long. A function so test mode can shorten it. */
  timeoutMs?: number | (() => number);
}

/**
 * Validation, then product matching, then the history. A request the caller cancels is answered
 * as failed and not retryable, and is not kept in the history.
 */
export function createStylingService(adapter: RecommendationAdapter, history: RequestHistory | null = requestHistory, opts: ServiceOptions = {}): StylingService {
  const meta = { id: adapter.id, version: adapter.version };
  return {
    adapter: meta,
    async recommend(request, options = {}) {
      const limit = typeof opts.timeoutMs === "function" ? opts.timeoutMs() : (opts.timeoutMs ?? TIMEOUT_MS);
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, limit);
      const onCancel = () => controller.abort();
      if (options.signal?.aborted) controller.abort();
      options.signal?.addEventListener("abort", onCancel, { once: true });

      let response: StylingResponse;
      try {
        const raw = await adapter.recommend(request, { signal: controller.signal });
        if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
        response = validateStylingResponse(raw, request, meta).response;
        if (opts.retailer && (response.status === "completed" || response.status === "partial")) {
          response = await matchProducts(response, opts.retailer, { signal: controller.signal });
          if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
        }
      } catch {
        if (timedOut) response = failedResponse(request, meta, "timeout", "The service took too long to answer.");
        else if (options.signal?.aborted) response = failedResponse(request, meta, "cancelled", "The request was cancelled.", false);
        else response = failedResponse(request, meta, "adapter_error", "The service did not answer.");
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", onCancel);
      }
      if (response.error?.code !== "cancelled") history?.record(request, response);
      return response;
    },
  };
}

/**
 * Wraps an adapter so test mode can make it slow, silent, broken, short or empty. With test mode
 * off it passes everything straight through.
 */
export function withSimulation(adapter: RecommendationAdapter, scenario: () => SimScenario | null = simScenario): RecommendationAdapter {
  /** Inputs already failed once in the "fails once, then works" scenario. */
  const failedOnce = new Set<string>();
  return {
    id: adapter.id,
    version: adapter.version,
    async recommend(request, options) {
      const s = scenario();
      if (s === "slow") await wait(SIM_SLOW_MS, options.signal);
      if (s === "timeout") await never(options.signal);
      if (s === "failure") throw new Error("Simulated service error");
      if (s === "retry_success" && !failedOnce.has(request.inputKey)) {
        failedOnce.add(request.inputKey);
        throw new Error("Simulated first failure");
      }
      // An answer that does not match the contract: the validator must turn it into a clean failure.
      if (s === "validation_error") return { recommendationId: 42, outfits: "not a list" };
      const raw = await adapter.recommend(request, options);
      if ((s === "partial" || s === "empty") && raw && typeof raw === "object" && Array.isArray((raw as { outfits?: unknown }).outfits)) {
        const outfits = (raw as { outfits: unknown[] }).outfits;
        return { ...raw, outfits: s === "partial" ? outfits.slice(0, 2) : [] };
      }
      return raw;
    },
  };
}

/** In test mode the time limit is shorter, so a timeout can be seen without a long wait. */
const SIM_TIMEOUT_MS = 9000;

/* ------------------------------------------------------ request history */

export interface HistoryEntry {
  request: StylingRequest;
  response: StylingResponse;
}

export interface RequestHistory {
  record(request: StylingRequest, response: StylingResponse): void;
  /** The newest answer for these exact inputs, if it succeeded. */
  /** The latest answer worth showing for these inputs, made for this person only (never another account's). */
  latest(inputKey: string, owner?: RequestOwner): HistoryEntry | null;
  byRecommendation(recommendationId: string): HistoryEntry | null;
  all(): HistoryEntry[];
  clear(): void;
}

const HISTORY_KEY = "praxis_styling_history";
/** Enough to come back to recent looks; old entries fall away. */
const HISTORY_LIMIT = 20;

export interface RequestOwner {
  anonymousSessionId: string;
  userId?: string;
}

function madeFor(request: StylingRequest, owner: RequestOwner): boolean {
  return owner.userId ? request.userId === owner.userId : !request.userId && request.anonymousSessionId === owner.anonymousSessionId;
}

export function createRequestHistory(storage: () => Storage | undefined = local): RequestHistory {
  let memory: HistoryEntry[] | null = null;
  const read = (): HistoryEntry[] => memory ?? (memory = readJson<HistoryEntry[]>(storage(), HISTORY_KEY) ?? []);
  const write = (entries: HistoryEntry[]) => {
    memory = entries;
    writeJson(storage(), HISTORY_KEY, entries);
  };
  return {
    record(request, response) {
      const rest = read().filter((e) => e.request.requestId !== request.requestId);
      write([{ request, response }, ...rest].slice(0, HISTORY_LIMIT));
    },
    latest(inputKey, owner) {
      return read().find((e) => e.request.inputKey === inputKey && e.response.status !== "failed" && (!owner || madeFor(e.request, owner))) ?? null;
    },
    byRecommendation(id) {
      return read().find((e) => e.response.recommendationId === id) ?? null;
    },
    all: () => [...read()],
    clear: () => write([]),
  };
}

export const requestHistory = createRequestHistory();

let service: StylingService | null = null;

/** The service the app uses, built from the configuration. Unknown adapters fall back to the mock. */
export function stylingService(): StylingService {
  if (!service) {
    if (RECOMMENDATION_ADAPTER !== "mock" && typeof console !== "undefined") console.warn(`Unknown recommendation adapter "${RECOMMENDATION_ADAPTER}"; using the mock.`);
    // A service listed in VITE_AI_PROVIDERS answers through src/core/ai (the server holds its keys).
    const adapter = isLive("styling_recommendation") ? serviceRecommendationAdapter() : createMockAdapter();
    service = createStylingService(withSimulation(adapter), requestHistory, {
      retailer: isLive("inventory_pricing") ? serviceRetailer() : createMockRetailer((productId) => simScenario() === "unavailable_products" && productId.endsWith("_shoes")),
      timeoutMs: () => (simScenario() === "timeout" ? SIM_TIMEOUT_MS : TIMEOUT_MS),
    });
  }
  return service;
}
