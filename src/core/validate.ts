/**
 * The guard between the recommendation service and the screens. Whatever an adapter returns is
 * checked here before anything renders it: a malformed response becomes a calm failure, a malformed
 * look is dropped (and the response marked partial), and an unknown factor is left out. Nothing a
 * model returns can crash the interface. Hand-written so the app takes on no schema library.
 */
import {
  CONTRACT_VERSION,
  type Availability,
  type FactorKind,
  type Garment,
  type OutfitRecommendation,
  type OutfitRole,
  type PriceStatus,
  type PurchaseRoute,
  type RecommendationFactor,
  type ResponseStatus,
  type Slot,
  type StylingRequest,
  type StylingResponse,
  type Visualization,
} from "./contracts";

/** How many looks a complete answer has. Fewer is partial, never padded. */
export const EXPECTED_OUTFITS = 3;

/** Ids travel into analytics, which refuses strings over 160 characters. */
const ID_MAX = 120;

const SLOTS: readonly Slot[] = ["top", "bottom", "shoes", "extras"];
const ROLES: readonly OutfitRole[] = ["classic", "sharper", "relaxed"];
const PRICE_STATUS: readonly PriceStatus[] = ["example", "estimated", "live"];
const AVAILABILITY: readonly Availability[] = ["in_stock", "out_of_stock", "unknown"];
const FACTORS: readonly FactorKind[] = ["occasion", "venue", "time", "style", "budget", "body", "colour", "wardrobe", "weather"];
const STATUSES: readonly ResponseStatus[] = ["completed", "partial", "empty", "failed"];
const VIS_KINDS: readonly Visualization["kind"][] = ["product_photo", "styled_visualization", "try_on"];
const VIS_STATUS: readonly Visualization["status"][] = ["ready", "pending", "failed", "unavailable"];

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown, max = 600): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const oneOf = <T extends string>(v: unknown, list: readonly T[]): v is T => typeof v === "string" && (list as readonly string[]).includes(v);
const optStr = (v: unknown, max = 600): string | undefined => (isStr(v, max) ? v : undefined);

/** Only http(s) links and the app's own paths may reach an img src or a link. */
function safeUrl(v: unknown): string | undefined {
  if (!isStr(v, 2048)) return undefined;
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  try {
    const url = new URL(v);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function factor(v: unknown): RecommendationFactor | null {
  if (!isObj(v) || !oneOf(v.factor, FACTORS) || !isStr(v.value, 120)) return null;
  const out: RecommendationFactor = { factor: v.factor, value: v.value };
  const influence = optStr(v.influence, 200);
  if (influence) out.influence = influence;
  return out;
}

function garment(v: unknown): Garment | null {
  if (!isObj(v) || !isStr(v.garmentId, 200) || !oneOf(v.slot, SLOTS) || !isStr(v.name, 200)) return null;
  const base = { garmentId: v.garmentId, slot: v.slot, name: v.name };
  if (v.source === "wardrobe") return isStr(v.wardrobeItemId, 200) ? { ...base, source: "wardrobe", wardrobeItemId: v.wardrobeItemId } : null;
  if (v.source !== "retail" || !isObj(v.product)) return null;
  const p = v.product;
  if (!isStr(p.productId, 200) || !isStr(p.retailerId, 200) || !isStr(p.retailerName, 120)) return null;
  if (!isNum(p.price) || p.price < 0 || p.currency !== "USD" || !oneOf(p.priceStatus, PRICE_STATUS)) return null;
  return {
    ...base,
    source: "retail",
    product: {
      productId: p.productId,
      retailerId: p.retailerId,
      retailerName: p.retailerName,
      price: p.price,
      currency: "USD",
      priceStatus: p.priceStatus,
      // Anything not stated as in or out of stock is unknown, never assumed available.
      availability: oneOf(p.availability, AVAILABILITY) ? p.availability : "unknown",
      productUrl: safeUrl(p.productUrl),
      imageUrl: safeUrl(p.imageUrl),
      lastUpdatedAt: optStr(p.lastUpdatedAt, 40),
      category: optStr(p.category, 60),
      availableSizes: sizes(p.availableSizes),
      sizeAvailability: sizeStock(p.sizeAvailability),
      purchase: purchaseRoute(p.purchase),
      deliveryEstimate: optStr(p.deliveryEstimate, 60),
    },
  };
}

function sizes(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((s): s is string => isStr(s, 20)).slice(0, 30);
  return out.length ? out : undefined;
}

function sizeStock(v: unknown): Record<string, Availability> | undefined {
  if (!isObj(v)) return undefined;
  const entries = Object.entries(v).filter((e): e is [string, Availability] => e[0].length <= 20 && oneOf(e[1], AVAILABILITY));
  return entries.length ? Object.fromEntries(entries.slice(0, 30)) : undefined;
}

/** A way to buy is accepted only when it can be followed: an https link, or a named integration. */
function purchaseRoute(v: unknown): PurchaseRoute | undefined {
  if (!isObj(v)) return undefined;
  if ((v.kind === "retailer_site" || v.kind === "affiliate") && typeof v.url === "string" && /^https:\/\//i.test(v.url) && safeUrl(v.url)) return { kind: v.kind, url: v.url };
  if ((v.kind === "retailer_integration" || v.kind === "native") && isStr(v.integrationId, 80)) return { kind: v.kind, integrationId: v.integrationId };
  if (v.kind === "none") return { kind: "none", reason: v.reason === "not_supported" ? "not_supported" : "example_product" };
  return undefined;
}

function visualization(v: unknown, outfitId: string): Visualization | null {
  if (!isObj(v) || !isStr(v.imageId, 200) || !oneOf(v.kind, VIS_KINDS) || !isStr(v.provider, 120)) return null;
  const url = safeUrl(v.url);
  if (!url) return null;
  return {
    imageId: v.imageId,
    outfitId,
    kind: v.kind,
    url,
    provider: v.provider,
    // A picture is representative unless the response says it shows these exact garments.
    fidelity: v.fidelity === "exact" ? "exact" : "representative",
    sourceGarmentIds: Array.isArray(v.sourceGarmentIds) ? v.sourceGarmentIds.filter((id): id is string => isStr(id, 200)) : [],
    status: oneOf(v.status, VIS_STATUS) ? v.status : "ready",
    width: isNum(v.width) ? v.width : undefined,
    height: isNum(v.height) ? v.height : undefined,
    createdAt: optStr(v.createdAt, 40),
  };
}

function outfit(v: unknown): OutfitRecommendation | null {
  if (!isObj(v) || !isStr(v.outfitId, ID_MAX) || !isNum(v.rank) || !oneOf(v.role, ROLES) || !isStr(v.title, 120) || !isStr(v.rationale, 400)) return null;
  if (!isObj(v.explanation) || !isStr(v.explanation.summary, 400)) return null;
  const garments = Array.isArray(v.garments) ? v.garments.map(garment) : [];
  // A look missing any piece is dropped whole, so a picture never pairs with the wrong pieces.
  if (garments.length === 0 || garments.some((g) => g === null)) return null;
  const pieces = garments as Garment[];
  if (new Set(pieces.map((g) => g.garmentId)).size !== pieces.length) return null;
  const vis = visualization(v.visualization, v.outfitId);
  if (!vis) return null;
  const factors = Array.isArray(v.explanation.contributingFactors) ? v.explanation.contributingFactors.map(factor).filter((f): f is RecommendationFactor => f !== null) : [];
  const retail = pieces.filter((g): g is Extract<Garment, { source: "retail" }> => g.source === "retail");
  const statuses = new Set(retail.map((g) => g.product.priceStatus));
  return {
    outfitId: v.outfitId,
    rank: v.rank,
    role: v.role,
    title: v.title,
    rationale: v.rationale,
    explanation: { summary: v.explanation.summary, contributingFactors: factors, source: v.explanation.source === "model" ? "model" : "mock_rules" },
    garments: pieces,
    visualization: vis,
    // The total is recomputed from the pieces, so a model can never show a sum that does not add up.
    pricing: {
      total: retail.reduce((sum, g) => sum + g.product.price, 0),
      currency: "USD",
      // The least certain price decides; a look with nothing to buy is never called live.
      status: statuses.has("example") || statuses.size === 0 ? "example" : statuses.has("estimated") ? "estimated" : "live",
    },
  };
}

export interface ValidationResult {
  response: StylingResponse;
  issues: string[];
}

/** A failure the screens know how to show, tied to the request it answers. */
export function failedResponse(request: StylingRequest, adapter: { id: string; version: string }, code: string, message: string, retryable = true): StylingResponse {
  return {
    recommendationId: `rec_failed_${request.requestId}`,
    requestId: request.requestId,
    inputKey: request.inputKey,
    contractVersion: CONTRACT_VERSION,
    adapter,
    mode: "demonstration",
    status: "failed",
    outfits: [],
    error: { code, message, retryable },
    createdAt: new Date().toISOString(),
  };
}

export function validateStylingResponse(raw: unknown, request: StylingRequest, adapter: { id: string; version: string }): ValidationResult {
  const issues: string[] = [];
  if (!isObj(raw)) return { response: failedResponse(request, adapter, "malformed_response", "The response was not an object."), issues: ["not an object"] };
  if (raw.requestId !== request.requestId || raw.inputKey !== request.inputKey) {
    return { response: failedResponse(request, adapter, "mismatched_response", "The response answers a different request."), issues: ["request mismatch"] };
  }
  if (!isStr(raw.recommendationId, ID_MAX) || !oneOf(raw.status, STATUSES) || !Array.isArray(raw.outfits)) {
    return { response: failedResponse(request, adapter, "malformed_response", "The response is missing required fields."), issues: ["missing fields"] };
  }
  const claimed = raw.status;
  if (claimed === "failed") {
    const err = isObj(raw.error) ? raw.error : {};
    return {
      response: failedResponse(request, adapter, optStr(err.code, 80) ?? "service_failed", optStr(err.message, 300) ?? "The service could not style this request.", err.retryable !== false),
      issues,
    };
  }

  const seen = new Set<string>();
  const outfits: OutfitRecommendation[] = [];
  raw.outfits.forEach((o, i) => {
    const valid = outfit(o);
    if (!valid) issues.push(`outfit ${i} dropped: malformed`);
    else if (seen.has(valid.outfitId)) issues.push(`outfit ${i} dropped: duplicate ${valid.outfitId}`);
    else {
      seen.add(valid.outfitId);
      outfits.push(valid);
    }
  });
  outfits.sort((a, b) => a.rank - b.rank);
  outfits.forEach((o, i) => (o.rank = i + 1));

  const status: ResponseStatus = outfits.length === 0 ? "empty" : outfits.length < EXPECTED_OUTFITS || claimed === "partial" ? "partial" : "completed";
  const fallback = isObj(raw.fallback) && isStr(raw.fallback.code, 80) && isStr(raw.fallback.message, 300) ? { code: raw.fallback.code, message: raw.fallback.message } : undefined;

  return {
    response: {
      recommendationId: raw.recommendationId,
      requestId: request.requestId,
      inputKey: request.inputKey,
      contractVersion: isStr(raw.contractVersion, 20) ? raw.contractVersion : CONTRACT_VERSION,
      adapter,
      // Only a real engine may call its looks personalized; anything unsure is a demonstration.
      mode: raw.mode === "personalized" && adapter.id !== "mock" ? "personalized" : "demonstration",
      status,
      outfits,
      fallback: fallback ?? (status === "partial" && issues.length > 0 ? { code: "outfits_dropped", message: "Some looks could not be shown." } : undefined),
      createdAt: optStr(raw.createdAt, 40) ?? new Date().toISOString(),
    },
    issues,
  };
}
