/**
 * Plugs the service layer into the interfaces the screens already use (the recommendation adapter,
 * the image adapters and the retailer adapter), so turning a live provider on for a service is a
 * deployment setting (VITE_AI_PROVIDERS) and not a code change. With nothing listed, the screens keep
 * their own mocks and none of this runs.
 */
import type { StylingRequest } from "../contracts";
import type { RetailerAdapter } from "../retail";
import type { ColourAnalysisAdapter, GarmentRecognitionAdapter, ImageInput } from "../vision";
import { AI_PROVIDERS } from "../config";
import { anonymousId } from "../identity";
import type { ServiceName } from "./envelope";
import { aiServices, type ImageRef } from "./services";

export function isLive(service: ServiceName): boolean {
  return AI_PROVIDERS.includes(service);
}

const ref = (image: ImageInput): ImageRef => ({ ref: image.ref, width: image.width, height: image.height, consentVersion: image.consentVersion });

/** Styling through the service layer: the answer is still validated by src/core/service.ts. */
export function serviceRecommendationAdapter(ai = aiServices()) {
  const p = ai.provider("styling_recommendation");
  return {
    id: p.id,
    version: p.version,
    async recommend(request: StylingRequest, options: { signal?: AbortSignal }): Promise<unknown> {
      const out = await ai.call("styling_recommendation", request, { anonymousSessionId: request.anonymousSessionId, userId: request.userId }, { signal: options.signal, retries: 0 });
      if (out.result && (out.status === "succeeded" || out.status === "partial" || out.status === "empty")) return out.result;
      throw new Error(out.error?.code ?? out.status);
    },
  };
}

export function serviceColourAdapter(ai = aiServices()): ColourAnalysisAdapter {
  const p = ai.provider("face_colour_analysis");
  return {
    id: p.id,
    version: p.version,
    billable: p.billable,
    async analyse(image, options) {
      const out = await ai.call("face_colour_analysis", { image: ref(image) }, { anonymousSessionId: anonymousId() }, { signal: options?.signal });
      if (out.status === "disabled") return { status: "disabled" };
      if (out.status !== "succeeded" || !out.result) return { status: out.error?.code === "validation_error" ? "unreadable" : "failed" };
      const at = { source: out.result.source === "model" ? ("model" as const) : ("sample" as const), adapter: p.id };
      return { status: "completed", undertone: { value: out.result.undertone, ...at }, contrast: { value: out.result.contrast, ...at } };
    },
  };
}

export function serviceGarmentAdapter(ai = aiServices()): GarmentRecognitionAdapter {
  const p = ai.provider("garment_recognition");
  return {
    id: p.id,
    version: p.version,
    billable: p.billable,
    async recognise(image, options) {
      const out = await ai.call("garment_recognition", { image: ref(image) }, { anonymousSessionId: anonymousId() }, { signal: options?.signal });
      if (out.status === "disabled") return { status: "disabled" };
      if (out.status !== "succeeded" || !out.result) return { status: "failed" };
      const at = { source: out.result.source === "model" ? ("model" as const) : ("sample" as const), adapter: p.id };
      return { status: "completed", slot: { value: out.result.slot, ...at }, category: { value: out.result.category, ...at }, ...(out.result.colour ? { colour: { value: out.result.colour, ...at } } : {}) };
    },
  };
}

/** Stock and prices through the service layer. A failed check leaves the pieces as they were. */
export function serviceRetailer(ai = aiServices()): RetailerAdapter {
  return {
    id: ai.provider("inventory_pricing").id,
    async lookup(products, options) {
      const out = await ai.call("inventory_pricing", { products: products.map((p) => ({ productId: p.productId, retailerId: p.retailerId })) }, { anonymousSessionId: anonymousId() }, { signal: options?.signal });
      if (!out.result || (out.status !== "succeeded" && out.status !== "partial")) return [];
      return out.result.items.map((i) => ({ ...i, lastUpdatedAt: i.freshness === "example" ? undefined : i.checkedAt }));
    },
  };
}
