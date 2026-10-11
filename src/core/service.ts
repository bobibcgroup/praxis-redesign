/**
 * The styling service: the one door the screens use to ask for looks. It hands the request to an
 * adapter (the mock today, a production engine later), validates whatever comes back, and records
 * the pair in the request history. Swapping the adapter changes nothing above this file.
 */
import { createMockAdapter } from "./adapters/mock";
import { RECOMMENDATION_ADAPTER } from "./config";
import type { StylingRequest, StylingResponse } from "./contracts";
import { local, readJson, writeJson } from "./ids";
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

export function createStylingService(adapter: RecommendationAdapter, history: RequestHistory | null = requestHistory): StylingService {
  const meta = { id: adapter.id, version: adapter.version };
  return {
    adapter: meta,
    async recommend(request, options = {}) {
      let response: StylingResponse;
      try {
        const raw = await adapter.recommend(request, options);
        response = validateStylingResponse(raw, request, meta).response;
      } catch {
        response = failedResponse(request, meta, "adapter_error", "The service did not answer.");
      }
      history?.record(request, response);
      return response;
    },
  };
}

/* ------------------------------------------------------ request history */

export interface HistoryEntry {
  request: StylingRequest;
  response: StylingResponse;
}

export interface RequestHistory {
  record(request: StylingRequest, response: StylingResponse): void;
  /** The newest answer for these exact inputs, if it succeeded. */
  latest(inputKey: string): HistoryEntry | null;
  byRecommendation(recommendationId: string): HistoryEntry | null;
  all(): HistoryEntry[];
  clear(): void;
}

const HISTORY_KEY = "praxis_styling_history";
/** Enough to come back to recent looks; old entries fall away. */
const HISTORY_LIMIT = 20;

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
    latest(inputKey) {
      return read().find((e) => e.request.inputKey === inputKey && e.response.status !== "failed") ?? null;
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
    service = createStylingService(createMockAdapter());
  }
  return service;
}
