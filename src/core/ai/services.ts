/**
 * The nine AI services, each as a typed contract (payload and result), a runtime check for both, a
 * deterministic mock, and one registry that picks the provider. The screens call `aiServices()`;
 * which provider answers is decided here and nowhere else.
 *
 * Mocks never read a photo, never make a picture of a person and never claim live prices or stock.
 * Every mock can be made to show each state the screens must handle (see MockScenario).
 */
import { createMockAdapter, mockRecommend } from "../adapters/mock";
import type { Availability, BudgetBand, Currency, ProductRef, RecommendationFactor, Slot, StylingRequest, StylingResponse } from "../contracts";
import { createMockRetailer, type RetailerProductInfo } from "../retail";
import { IMAGE_POLICIES } from "../images";
import { simScenario, wait } from "../sim";
import { buildServiceRequest, callService, type CallOptions, type ProviderAnswer, type ServiceDefinition, type ServiceName, type ServiceProvider, type ServiceResponse } from "./envelope";
import { httpProvider } from "./http";
import { AI_PROVIDERS } from "../config";

/* ------------------------------------------------------------ shapes */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const SLOTS: readonly Slot[] = ["top", "bottom", "shoes", "extras"];
const AVAILABILITY: readonly Availability[] = ["in_stock", "out_of_stock", "unknown"];

/** A photo as a service sees it: a reference and its facts, never the pixels in a log. */
export interface ImageRef {
  ref: string;
  width: number;
  height: number;
  consentVersion: string;
}

function checkImage(v: unknown, category: keyof typeof IMAGE_POLICIES): string | null {
  if (!isObj(v) || !isStr(v.ref)) return "image missing";
  if (!isNum(v.width) || !isNum(v.height) || Math.min(v.width, v.height) < IMAGE_POLICIES[category].minEdge) return "image too small";
  if (v.consentVersion !== IMAGE_POLICIES[category].consentVersion) return "consent missing or out of date";
  return null;
}

/* 1. Styling recommendation: StylingRequest in, StylingResponse out (src/core/contracts.ts). */
export type StylingPayload = StylingRequest;
export type StylingResult = StylingResponse;

/* 2. Styling explanation: why one look suits the brief. */
export interface ExplanationPayload {
  request: StylingRequest;
  outfitId: string;
  /** The looks to write for in one go (the three of a response): names and pieces, never a photo. */
  looks?: LookBrief[];
}
export interface LookBrief {
  outfitId: string;
  role: string;
  title: string;
  pieces: { slot: Slot; name: string; owned?: boolean }[];
}
export interface ExplanationResult {
  outfitId: string;
  summary: string;
  factors: RecommendationFactor[];
  source: "mock_rules" | "model";
  /** With `looks` in the payload: the stylist's line (summary) and note for each look it could write. */
  looks?: { outfitId: string; summary: string; note: string }[];
}

/* 3. Outfit visualization: a picture of the look itself (no person). */
export interface VisualizationPayload {
  outfitId: string;
  garmentIds: string[];
  /** The full composition to render (src/core/catalogue/visualize.ts): pieces, their pictures, the model setup and the cache key. */
  spec?: unknown;
}
export interface VisualizationResult {
  outfitId: string;
  imageUrl: string;
  /** exact: shows these very garments. representative: a similar look. */
  fidelity: "exact" | "representative";
  generated: boolean;
  /** What the server's checks of a generated picture found. */
  checks?: { check: string; ok: boolean; note?: string }[];
}

/* 4. Virtual try-on: see src/core/tryon.ts for the customer flow; this is its contract here. */
export interface TryOnPayload {
  outfitId: string;
  garmentIds: string[];
  person: ImageRef;
}
export interface TryOnResult {
  outfitId: string;
  imageUrl: string;
}

/* 5. Face colour analysis. */
export interface ColourPayload {
  image: ImageRef;
}
export interface ColourResult {
  undertone: "cool" | "warm" | "neutral";
  contrast: "high" | "medium" | "low";
  /** sample: a fixed example, not read from the photo. model: read by an analysis. */
  source: "sample" | "model";
}

/* 6. Body and fit analysis. */
export interface BodyFitPayload {
  /** What the customer said about fit. */
  preferredFit?: "SLIM" | "REGULAR" | "RELAXED";
  /** A full-length photo, once fit analysis asks for one (not collected today). */
  image?: ImageRef;
}
export interface BodyFitResult {
  recommendedFit: "SLIM" | "REGULAR" | "RELAXED";
  /** self_reported: what the customer said. model: read from a photo. */
  source: "self_reported" | "model";
  notes: string[];
}

/* 7. Wardrobe garment recognition. */
export interface GarmentPayload {
  image: ImageRef;
  /** The slot the customer picked, used by the mock and as a hint by a model. */
  slotHint?: Slot;
}
export interface GarmentResult {
  slot: Slot;
  category: string;
  colour?: string;
  source: "customer" | "model";
}

/* 8. Retailer product matching. */
export interface MatchPayload {
  /** Each part to fill. The ontology fields (src/shared/ontology.mjs) let a store feed search by kind, not by name alone. */
  garments: { garmentId: string; slot: Slot; name: string; layer?: "outer" | "base"; subcategory?: string; colour?: string; formality?: number }[];
  budget: BudgetBand;
  currency: Currency;
  /** Two-letter country, for which retailers and currency apply. */
  country?: string;
}
export interface MatchResult {
  matches: { garmentId: string; products: ProductRef[] }[];
}

/* 9. Inventory and price verification. */
export interface InventoryPayload {
  products: { productId: string; retailerId: string }[];
}
/**
 * What the retailer says about one product now. A field left out is not known; price only when the
 * retailer gives one, with how sure it is.
 */
export interface InventoryItem extends RetailerProductInfo {
  retailerId: string;
  /** When the retailer was asked. */
  checkedAt: string;
  /** live: asked just now. cached: an earlier answer, see checkedAt. example: invented for the demonstration. */
  freshness: "live" | "cached" | "example";
}
export interface InventoryResult {
  items: InventoryItem[];
}

/* ------------------------------------------------------------ definitions */

const BASE = { retries: 1, backoffMs: 400 };

export const DEFINITIONS = {
  styling_recommendation: {
    service: "styling_recommendation",
    ...BASE,
    timeoutMs: 20_000,
    checkPayload: (p) => (isObj(p) && isStr(p.requestId) && isStr(p.occasion) && isObj(p.venue) && isStr(p.venue.type) && isStr(p.timeOfDay) && isStr(p.preferredVibe) && isObj(p.budget) && isStr(p.budget.band) ? null : "incomplete styling request"),
    checkResult: (r) => (isObj(r) && isStr(r.recommendationId) && Array.isArray(r.outfits) ? null : "not a styling response"),
  } satisfies ServiceDefinition<StylingPayload, StylingResult>,
  styling_explanation: {
    service: "styling_explanation",
    ...BASE,
    timeoutMs: 10_000,
    checkPayload: (p) => (isObj(p) && isObj(p.request) && isStr(p.outfitId) ? null : "outfit or request missing"),
    checkResult: (r) => (isObj(r) && isStr(r.outfitId) && isStr(r.summary) && Array.isArray(r.factors) ? null : "not an explanation"),
  } satisfies ServiceDefinition<ExplanationPayload, ExplanationResult>,
  outfit_visualization: {
    service: "outfit_visualization",
    ...BASE,
    timeoutMs: 180_000,
    checkPayload: (p) => (isObj(p) && isStr(p.outfitId) && Array.isArray(p.garmentIds) && p.garmentIds.length > 0 ? null : "outfit or garments missing"),
    checkResult: (r) => (isObj(r) && isStr(r.outfitId) && isStr(r.imageUrl) && /^(https:|\/|data:image\/)/.test(r.imageUrl) && (r.fidelity === "exact" || r.fidelity === "representative") ? null : "not a picture of the outfit"),
  } satisfies ServiceDefinition<VisualizationPayload, VisualizationResult>,
  virtual_try_on: {
    service: "virtual_try_on",
    ...BASE,
    timeoutMs: 45_000,
    checkPayload: (p) => (isObj(p) && isStr(p.outfitId) && Array.isArray(p.garmentIds) && p.garmentIds.length > 0 ? checkImage(p.person, "try_on") : "outfit or garments missing"),
    checkResult: (r) => (isObj(r) && isStr(r.outfitId) && isStr(r.imageUrl) && /^(https:|data:image\/)/.test(r.imageUrl) ? null : "not a try-on picture"),
  } satisfies ServiceDefinition<TryOnPayload, TryOnResult>,
  face_colour_analysis: {
    service: "face_colour_analysis",
    ...BASE,
    timeoutMs: 15_000,
    checkPayload: (p) => (isObj(p) ? checkImage(p.image, "face_colour") : "image missing"),
    checkResult: (r) => (isObj(r) && ["cool", "warm", "neutral"].includes(r.undertone as string) && ["high", "medium", "low"].includes(r.contrast as string) && (r.source === "sample" || r.source === "model") ? null : "not a colour reading"),
  } satisfies ServiceDefinition<ColourPayload, ColourResult>,
  body_fit_analysis: {
    service: "body_fit_analysis",
    ...BASE,
    timeoutMs: 15_000,
    checkPayload: (p) => (!isObj(p) ? "payload missing" : p.image !== undefined ? checkImage(p.image, "body_fit") : p.preferredFit === undefined ? "nothing to go on" : null),
    checkResult: (r) => (isObj(r) && ["SLIM", "REGULAR", "RELAXED"].includes(r.recommendedFit as string) && Array.isArray(r.notes) ? null : "not a fit reading"),
  } satisfies ServiceDefinition<BodyFitPayload, BodyFitResult>,
  garment_recognition: {
    service: "garment_recognition",
    ...BASE,
    timeoutMs: 15_000,
    checkPayload: (p) => (isObj(p) ? checkImage(p.image, "wardrobe_garment") : "image missing"),
    checkResult: (r) => (isObj(r) && SLOTS.includes(r.slot as Slot) && isStr(r.category) ? null : "not a garment reading"),
  } satisfies ServiceDefinition<GarmentPayload, GarmentResult>,
  product_matching: {
    service: "product_matching",
    ...BASE,
    timeoutMs: 10_000,
    checkPayload: (p) => (isObj(p) && Array.isArray(p.garments) && p.garments.length > 0 && isStr(p.currency) ? null : "no garments to match"),
    checkResult: (r) =>
      isObj(r) && Array.isArray(r.matches) && r.matches.every((m) => isObj(m) && isStr(m.garmentId) && Array.isArray(m.products) && m.products.every((x) => isObj(x) && isStr(x.productId) && isStr(x.retailerId) && isNum(x.price) && isStr(x.currency)))
        ? null
        : "not a list of matches",
  } satisfies ServiceDefinition<MatchPayload, MatchResult>,
  inventory_pricing: {
    service: "inventory_pricing",
    ...BASE,
    timeoutMs: 8_000,
    checkPayload: (p) => (isObj(p) && Array.isArray(p.products) && p.products.length > 0 ? null : "no products to check"),
    checkResult: (r) =>
      isObj(r) && Array.isArray(r.items) && r.items.every((i) => isObj(i) && isStr(i.productId) && (i.price === undefined || (isNum(i.price) && i.price >= 0 && isStr(i.priceStatus))) && (i.availability === undefined || AVAILABILITY.includes(i.availability as Availability)) && isStr(i.checkedAt) && ["live", "cached", "example"].includes(i.freshness as string))
        ? null
        : "not a stock and price answer",
  } satisfies ServiceDefinition<InventoryPayload, InventoryResult>,
} as const;

/* ------------------------------------------------------------ mocks */

/**
 * The states every mock can be made to show. Deterministic: the same scenario and attempt always
 * give the same answer. retry_success fails the first attempt and succeeds on the second.
 */
export type MockScenario = "success" | "delayed" | "partial" | "empty" | "validation_error" | "failure" | "timeout" | "retry_success";

export const MOCK_DELAY_MS = 2500;

/** The scenario from test mode, if any (src/core/sim.ts). */
export function scenarioFromTestMode(): MockScenario {
  switch (simScenario()) {
    case "slow":
      return "delayed";
    case "partial":
      return "partial";
    case "empty":
      return "empty";
    case "failure":
      return "failure";
    case "timeout":
      return "timeout";
    case "invalid_image":
    case "validation_error":
      return "validation_error";
    case "retry_success":
      return "retry_success";
    default:
      return "success";
  }
}

interface MockSpec<P, R> {
  id: string;
  run: (payload: P) => R | null;
  /** A smaller but valid answer, for the partial scenario. */
  partial?: (r: R) => R;
  /** A valid answer with nothing in it, for the empty scenario. */
  empty?: (r: R) => R;
  /** Answer "disabled" instead of a result: the capability is not connected. */
  disabledOnSuccess?: boolean;
}

export function mockProvider<P, R>(spec: MockSpec<P, R>, scenario: () => MockScenario = scenarioFromTestMode): ServiceProvider<P, R> {
  return {
    id: spec.id,
    version: "1.0.0",
    mode: "mock",
    processing: "none",
    billable: false,
    async run(request, { signal }): Promise<ProviderAnswer<R>> {
      const s = scenario();
      if (s === "timeout") await wait(10 * 60_000, signal);
      if (s === "delayed") await wait(MOCK_DELAY_MS, signal);
      if (s === "failure") return { status: "failed", error: { code: "provider_error", message: "Simulated provider failure.", retryable: true } };
      if (s === "retry_success" && request.attempt === 1) return { status: "failed", error: { code: "provider_error", message: "Simulated first failure.", retryable: true }, metadata: { scenario: s } };
      if (s === "validation_error") return { status: "succeeded", result: { malformed: true } as unknown as R, metadata: { scenario: s } };
      if (spec.disabledOnSuccess) return { status: "disabled", error: { code: "not_connected", message: "This capability is not connected; nothing was made.", retryable: false }, metadata: { scenario: s } };
      const result = spec.run(request.payload);
      if (result === null) return { status: "empty", metadata: { scenario: s } };
      if (s === "empty" && spec.empty) return { status: "empty", result: spec.empty(result), metadata: { scenario: s } };
      if (s === "partial" && spec.partial) return { status: "partial", result: spec.partial(result), metadata: { scenario: s } };
      return { status: "succeeded", result, metadata: { scenario: s } };
    },
  };
}

const CATEGORY: Record<Slot, string> = { top: "Tops", bottom: "Trousers", shoes: "Shoes", extras: "Accessories" };
const SAMPLE_PRICE: Record<BudgetBand, Record<Slot, number>> = {
  SENSIBLE: { top: 69, bottom: 59, shoes: 85, extras: 25 },
  ELEVATED: { top: 195, bottom: 160, shoes: 195, extras: 95 },
  OPEN: { top: 420, bottom: 320, shoes: 420, extras: 180 },
};

export const MOCKS = {
  styling_recommendation: (scenario?: () => MockScenario) =>
    mockProvider<StylingPayload, StylingResult>({
      id: createMockAdapter().id,
      run: (req) => mockRecommend(req),
      partial: (r) => ({ ...r, status: "partial", outfits: r.outfits.slice(0, 2) }),
      empty: (r) => ({ ...r, status: "empty", outfits: [] }),
    }, scenario),
  styling_explanation: (scenario?: () => MockScenario) =>
    mockProvider<ExplanationPayload, ExplanationResult>({
      id: "mock-explanation",
      run: ({ request, outfitId }) => {
        const o = mockRecommend(request).outfits.find((x) => x.outfitId === outfitId);
        return o ? { outfitId, summary: o.explanation.summary, factors: o.explanation.contributingFactors, source: "mock_rules" } : null;
      },
      partial: (r) => ({ ...r, factors: r.factors.slice(0, 2) }),
      empty: (r) => ({ ...r, factors: [] }),
    }, scenario),
  outfit_visualization: (scenario?: () => MockScenario) =>
    mockProvider<VisualizationPayload, VisualizationResult>({
      id: "mock-visualization",
      // No picture is made: the screens keep the library photograph of the look, which is not generated.
      run: () => null,
      disabledOnSuccess: true,
    }, scenario),
  virtual_try_on: (scenario?: () => MockScenario) =>
    mockProvider<TryOnPayload, TryOnResult>({
      id: "mock-try-on",
      // Never a picture of the customer: the mock answers that try-on is not connected.
      run: () => null,
      disabledOnSuccess: true,
    }, scenario),
  face_colour_analysis: (scenario?: () => MockScenario) =>
    mockProvider<ColourPayload, ColourResult>({
      id: "mock-colour",
      run: () => ({ undertone: "cool", contrast: "high", source: "sample" }),
    }, scenario),
  body_fit_analysis: (scenario?: () => MockScenario) =>
    mockProvider<BodyFitPayload, BodyFitResult>({
      id: "mock-body-fit",
      run: ({ preferredFit }) => ({ recommendedFit: preferredFit ?? "REGULAR", source: "self_reported", notes: ["Based on what you told me; no photo was read."] }),
      partial: (r) => ({ ...r, notes: [] }),
    }, scenario),
  garment_recognition: (scenario?: () => MockScenario) =>
    mockProvider<GarmentPayload, GarmentResult>({
      id: "mock-garment",
      run: ({ slotHint }) => (slotHint ? { slot: slotHint, category: CATEGORY[slotHint], source: "customer" } : null),
    }, scenario),
  product_matching: (scenario?: () => MockScenario) =>
    mockProvider<MatchPayload, MatchResult>({
      id: "mock-retailer",
      run: ({ garments, budget, currency }) => ({
        matches: garments.map((g) => ({
          garmentId: g.garmentId,
          products: [
            {
              productId: `sample_${g.garmentId}`,
              retailerId: "atelier-nord",
              retailerName: "Atelier Nord",
              category: CATEGORY[g.slot],
              price: SAMPLE_PRICE[budget][g.slot],
              currency,
              priceStatus: "example",
              availability: "unknown",
            },
          ],
        })),
      }),
      partial: (r) => ({ matches: r.matches.slice(0, Math.max(1, r.matches.length - 1)) }),
      empty: (r) => ({ matches: r.matches.map((m) => ({ ...m, products: [] })) }),
    }, scenario),
  inventory_pricing: (scenario?: () => MockScenario) => {
    const retailer = createMockRetailer();
    return mockProvider<InventoryPayload, InventoryResult>({
      id: retailer.id,
      // The sample houses do not exist: sizes are listed, stock stays unknown, no price is confirmed.
      run: ({ products }) => ({
        items: products.flatMap((p) => {
          const slot = p.productId.split("_").pop() as Slot;
          if (!SLOTS.includes(slot)) return [];
          const item: InventoryItem = {
            productId: p.productId,
            retailerId: p.retailerId,
            category: CATEGORY[slot],
            availability: "unknown",
            purchase: { kind: "none", reason: "example_product" },
            checkedAt: new Date(0).toISOString(),
            freshness: "example",
          };
          return [item];
        }),
      }),
      partial: (r) => ({ items: r.items.slice(0, Math.max(1, r.items.length - 1)) }),
      empty: () => ({ items: [] }),
    }, scenario);
  },
} satisfies { [K in keyof typeof DEFINITIONS]: (scenario?: () => MockScenario) => ServiceProvider<never, unknown> };

/* ------------------------------------------------------------ registry */

export type PayloadOf<K extends ServiceName> = K extends "styling_recommendation"
  ? StylingPayload
  : K extends "styling_explanation"
    ? ExplanationPayload
    : K extends "outfit_visualization"
      ? VisualizationPayload
      : K extends "virtual_try_on"
        ? TryOnPayload
        : K extends "face_colour_analysis"
          ? ColourPayload
          : K extends "body_fit_analysis"
            ? BodyFitPayload
            : K extends "garment_recognition"
              ? GarmentPayload
              : K extends "product_matching"
                ? MatchPayload
                : InventoryPayload;
export type ResultOf<K extends ServiceName> = K extends "styling_recommendation"
  ? StylingResult
  : K extends "styling_explanation"
    ? ExplanationResult
    : K extends "outfit_visualization"
      ? VisualizationResult
      : K extends "virtual_try_on"
        ? TryOnResult
        : K extends "face_colour_analysis"
          ? ColourResult
          : K extends "body_fit_analysis"
            ? BodyFitResult
            : K extends "garment_recognition"
              ? GarmentResult
              : K extends "product_matching"
                ? MatchResult
                : InventoryResult;

export type ProviderOverrides = { [K in ServiceName]?: ServiceProvider<PayloadOf<K>, ResultOf<K>> };

/**
 * The provider for a service: an override (tests), then a live provider when the deployment names
 * one in VITE_AI_PROVIDERS (it posts to this app's server, never to a provider directly), else the mock.
 */
export function providerFor<K extends ServiceName>(service: K, overrides: ProviderOverrides = {}): ServiceProvider<PayloadOf<K>, ResultOf<K>> {
  const override = overrides[service] as ServiceProvider<PayloadOf<K>, ResultOf<K>> | undefined;
  if (override) return override;
  if (AI_PROVIDERS.includes(service)) return httpProvider<PayloadOf<K>, ResultOf<K>>(service);
  return (MOCKS[service] as unknown as () => ServiceProvider<PayloadOf<K>, ResultOf<K>>)();
}

/** Calls any of the nine services through the envelope. */
export function aiServices(overrides: ProviderOverrides = {}) {
  return {
    call<K extends ServiceName>(service: K, payload: PayloadOf<K>, who: { anonymousSessionId: string; userId?: string }, options?: CallOptions): Promise<ServiceResponse<ResultOf<K>>> {
      const def = DEFINITIONS[service] as unknown as ServiceDefinition<PayloadOf<K>, ResultOf<K>>;
      return callService(def, providerFor(service, overrides), buildServiceRequest(service, payload, who), options);
    },
    provider<K extends ServiceName>(service: K) {
      const p = providerFor(service, overrides);
      return { id: p.id, version: p.version, mode: p.mode, processing: p.processing, billable: p.billable };
    },
  };
}

export const SERVICE_NAMES = Object.keys(DEFINITIONS) as ServiceName[];
