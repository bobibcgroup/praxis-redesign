/** Phase 2: the envelope every AI service runs through, the nine contracts and their mocks. */
import { describe, expect, it, vi } from "vitest";
import { buildServiceRequest, callService, SERVICE_CONTRACT_VERSION, type ServiceDefinition, type ServiceProvider } from "../ai/envelope";
import { readProviderAnswer, httpProvider } from "../ai/http";
import { aiServices, DEFINITIONS, MOCKS, SERVICE_NAMES, type MockScenario, type PayloadOf } from "../ai/services";
import { mockRecommend } from "../adapters/mock";
import { IMAGE_POLICIES } from "../images";
import { buildStylingRequest } from "../request";
import { ANON, FIXED_NOW, SCENARIO_A } from "./helpers";
// @ts-expect-error plain JavaScript module
import { AI_SERVICES, checkEnvelope } from "../../../server/ai.mjs";

const who = { anonymousSessionId: ANON, userId: "user_1" };
const styling = buildStylingRequest(SCENARIO_A, { anonymousSessionId: ANON, now: FIXED_NOW, requestId: "req_a" });
const image = (category: keyof typeof IMAGE_POLICIES) => ({ ref: "local:photo", width: 1024, height: 1024, consentVersion: IMAGE_POLICIES[category].consentVersion });

/** A valid payload for every service. */
const PAYLOADS: { [K in (typeof SERVICE_NAMES)[number]]: PayloadOf<K> } = {
  styling_recommendation: styling,
  styling_explanation: { request: styling, outfitId: mockRecommend(styling).outfits[0].outfitId },
  outfit_visualization: { outfitId: "o1", garmentIds: ["g1"] },
  virtual_try_on: { outfitId: "o1", garmentIds: ["g1"], person: image("try_on") },
  face_colour_analysis: { image: image("face_colour") },
  body_fit_analysis: { preferredFit: "SLIM" },
  garment_recognition: { image: image("wardrobe_garment"), slotHint: "shoes" },
  product_matching: { garments: [{ garmentId: "g1", slot: "top", name: "Shirt" }, { garmentId: "g2", slot: "shoes", name: "Loafer" }], budget: "ELEVATED", currency: "USD" },
  inventory_pricing: { products: [{ productId: "sample_dinner_top", retailerId: "atelier-nord" }, { productId: "sample_dinner_shoes", retailerId: "atelier-nord" }] },
};

const fast = { backoffMs: 1, timeoutMs: 100 };

async function run(service: (typeof SERVICE_NAMES)[number], scenario: MockScenario) {
  const provider = (MOCKS[service] as (s: () => MockScenario) => ServiceProvider<unknown, unknown>)(() => scenario);
  return aiServices({ [service]: provider }).call(service, PAYLOADS[service] as never, who, fast);
}

describe("the envelope", () => {
  const def: ServiceDefinition<{ n: number }, { n: number }> = {
    service: "body_fit_analysis",
    checkPayload: (p) => (typeof (p as { n?: unknown }).n === "number" ? null : "n missing"),
    checkResult: (r) => (typeof (r as { n?: unknown })?.n === "number" ? null : "bad"),
    timeoutMs: 50,
    retries: 2,
    backoffMs: 1,
  };
  const provider = (run: ServiceProvider<{ n: number }, { n: number }>["run"], billable = false): ServiceProvider<{ n: number }, { n: number }> => ({ id: "t", version: "9", mode: "mock", processing: "none", billable, run });
  const req = () => buildServiceRequest("body_fit_analysis", { n: 1 }, who, "body_1");

  it("gives each request an id, the person, the contract version and the first attempt", () => {
    const r = req();
    expect(r).toMatchObject({ requestId: "body_1", service: "body_fit_analysis", contractVersion: SERVICE_CONTRACT_VERSION, anonymousSessionId: ANON, userId: "user_1", attempt: 1 });
    expect(buildServiceRequest("body_fit_analysis", {}, who).requestId).not.toBe(buildServiceRequest("body_fit_analysis", {}, who).requestId);
  });

  it("refuses an incomplete payload before calling the provider", async () => {
    const spy = vi.fn();
    const out = await callService(def, provider(spy), buildServiceRequest("body_fit_analysis", {} as { n: number }, who));
    expect(out.status).toBe("failed");
    expect(out.error?.code).toBe("validation_error");
    expect(spy).not.toHaveBeenCalled();
  });

  it("never runs a paid provider while paid calls are off", async () => {
    const spy = vi.fn();
    const out = await callService(def, provider(spy, true), req(), { allowBillable: false });
    expect(out).toMatchObject({ status: "disabled", error: { code: "billing_blocked" }, attempts: 0 });
    expect(spy).not.toHaveBeenCalled();
  });

  it("retries a retryable failure, then answers with the provider's version and the attempts used", async () => {
    let n = 0;
    const out = await callService(def, provider(async () => (++n < 3 ? { status: "failed", error: { code: "provider_error", message: "x", retryable: true } } : { status: "succeeded", result: { n: 7 } })), req());
    expect(out).toMatchObject({ status: "succeeded", result: { n: 7 }, attempts: 3, provider: { id: "t", version: "9", mode: "mock" }, requestId: "body_1" });
  });

  it("stops after the last retry and does not retry what cannot be retried", async () => {
    const spy = vi.fn(async () => ({ status: "failed" as const, error: { code: "provider_error" as const, message: "x", retryable: false } }));
    const out = await callService(def, provider(spy), req());
    expect(out.status).toBe("failed");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("times out each attempt and says so", async () => {
    const out = await callService(def, provider((_r, { signal }) => new Promise((_, rej) => signal.addEventListener("abort", () => rej(new Error("abort"))))), req(), { retries: 0 });
    expect(out).toMatchObject({ status: "timed_out", error: { code: "timeout", retryable: true } });
  });

  it("cancels when asked, without retrying", async () => {
    const c = new AbortController();
    const p = callService(def, provider((_r, { signal }) => new Promise((_, rej) => signal.addEventListener("abort", () => rej(new Error("abort"))))), req(), { signal: c.signal, timeoutMs: 5000 });
    c.abort();
    expect((await p).status).toBe("cancelled");
  });

  it("turns a malformed result into a failure, never a crash", async () => {
    const out = await callService(def, provider(async () => ({ status: "succeeded", result: { n: "seven" } as unknown as { n: number } })), req());
    expect(out).toMatchObject({ status: "failed", error: { code: "invalid_response" } });
  });

  it("turns a provider that throws into a retryable failure", async () => {
    const out = await callService(def, provider(async () => { throw new Error("down"); }), req(), { retries: 0 });
    expect(out).toMatchObject({ status: "failed", error: { code: "provider_error", retryable: true } });
  });
});

describe("the nine services", () => {
  it("cover every service the brief names, on the page and on the server", () => {
    expect(SERVICE_NAMES.sort()).toEqual([...AI_SERVICES].sort());
    expect(SERVICE_NAMES).toHaveLength(9);
  });

  it("use the free mock by default, which is never billable and processes nothing", () => {
    const ai = aiServices();
    for (const s of SERVICE_NAMES) expect(ai.provider(s)).toMatchObject({ mode: "mock", billable: false, processing: "none" });
  });

  it.each(SERVICE_NAMES)("%s accepts its valid payload and refuses an empty one", (s) => {
    expect(DEFINITIONS[s].checkPayload(PAYLOADS[s])).toBeNull();
    expect(DEFINITIONS[s].checkPayload({})).not.toBeNull();
  });

  it("refuse a photo given without the current consent", () => {
    expect(DEFINITIONS.face_colour_analysis.checkPayload({ image: { ...image("face_colour"), consentVersion: "old" } })).toMatch(/consent/);
    expect(DEFINITIONS.virtual_try_on.checkPayload({ ...PAYLOADS.virtual_try_on, person: { ...image("try_on"), width: 100 } })).toMatch(/small/);
  });
});

describe("the mocks, in every scenario", () => {
  const ANSWERING = SERVICE_NAMES.filter((s) => s !== "virtual_try_on" && s !== "outfit_visualization");

  it.each(ANSWERING)("%s succeeds with a result that passes its own check", async (s) => {
    const out = await run(s, "success");
    expect(out.status).toBe("succeeded");
    expect(DEFINITIONS[s].checkResult(out.result)).toBeNull();
    expect(out.provider.mode).toBe("mock");
  });

  it.each(SERVICE_NAMES)("%s fails, times out and catches a malformed answer", async (s) => {
    expect((await run(s, "failure")).status).toBe("failed");
    expect((await run(s, "timeout")).status).toBe("timed_out");
    expect((await run(s, "validation_error")).error?.code).toBe("invalid_response");
  });

  it.each(SERVICE_NAMES)("%s recovers on the second attempt in retry_success", async (s) => {
    const out = await run(s, "retry_success");
    expect(out.attempts).toBe(2);
    expect(["succeeded", "disabled", "empty"]).toContain(out.status);
  });

  it("is deterministic: the same scenario gives the same answer", async () => {
    const a = await run("product_matching", "success");
    const b = await run("product_matching", "success");
    expect(a.result).toEqual(b.result);
  });

  it("answers the slow scenario after a delay, within the time limit", async () => {
    const provider = MOCKS.face_colour_analysis(() => "delayed");
    const out = await aiServices({ face_colour_analysis: provider }).call("face_colour_analysis", PAYLOADS.face_colour_analysis, who);
    expect(out.status).toBe("succeeded");
    expect(out.durationMs).toBeGreaterThanOrEqual(2000);
  }, 10_000);

  it("gives partial and empty answers that are still valid", async () => {
    const partial = await run("styling_recommendation", "partial");
    expect(partial.status).toBe("partial");
    expect((partial.result as { outfits: unknown[] }).outfits).toHaveLength(2);
    const empty = await run("styling_recommendation", "empty");
    expect(empty.status).toBe("empty");
    expect((empty.result as { outfits: unknown[] }).outfits).toHaveLength(0);
    expect((await run("product_matching", "partial")).result).toMatchObject({ matches: [{ garmentId: "g1" }] });
  });

  it("never makes a picture of the customer or of a look", async () => {
    for (const s of ["virtual_try_on", "outfit_visualization"] as const) {
      const out = await run(s, "success");
      expect(out.status).toBe("disabled");
      expect(out.result).toBeUndefined();
      expect(out.error?.code).toBe("not_connected");
    }
  });

  it("labels colour as a sample and fit as self reported, never as read from a photo", async () => {
    expect((await run("face_colour_analysis", "success")).result).toMatchObject({ source: "sample" });
    expect((await run("body_fit_analysis", "success")).result).toMatchObject({ recommendedFit: "SLIM", source: "self_reported" });
  });

  it("never presents mock prices or stock as live", async () => {
    const m = await run("product_matching", "success");
    for (const x of (m.result as { matches: { products: { priceStatus: string; availability: string }[] }[] }).matches.flatMap((y) => y.products)) {
      expect(x.priceStatus).toBe("example");
      expect(x.availability).toBe("unknown");
    }
    const inv = await run("inventory_pricing", "success");
    for (const i of (inv.result as { items: { freshness: string; availability: string; price?: number }[] }).items) {
      expect(i).toMatchObject({ freshness: "example", availability: "unknown" });
      expect(i.price).toBeUndefined();
    }
  });

  it("explains the look the engine picked, with the same factors", async () => {
    const rec = await run("styling_recommendation", "success");
    const first = (rec.result as { outfits: { outfitId: string; explanation: { summary: string } }[] }).outfits[0];
    const provider = MOCKS.styling_explanation(() => "success");
    const out = await aiServices({ styling_explanation: provider }).call("styling_explanation", { request: styling, outfitId: first.outfitId }, who, fast);
    expect(out.status).toBe("succeeded");
    expect(out.result?.summary).toBe(first.explanation.summary);
    expect(out.result?.factors.length).toBeGreaterThan(0);
  });
});

describe("the live provider", () => {
  it("posts the envelope to this app's server, never to a provider, and is billable", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ status: "disabled", error: { code: "not_connected", message: "none", retryable: false } }), { status: 200 }));
    const p = httpProvider("face_colour_analysis", "/api/ai", fetcher as unknown as typeof fetch);
    expect(p).toMatchObject({ mode: "live", billable: true, processing: "server" });
    const out = await callService(DEFINITIONS.face_colour_analysis, p, buildServiceRequest("face_colour_analysis", PAYLOADS.face_colour_analysis, who), { allowBillable: true });
    expect(fetcher).toHaveBeenCalledWith("/api/ai/face_colour_analysis", expect.objectContaining({ method: "POST" }));
    expect(out.status).toBe("disabled");
  });

  it("reads an unreadable server answer as a failure", () => {
    expect(readProviderAnswer("<html>", 502)).toMatchObject({ status: "failed", error: { retryable: true } });
  });

  it("is checked on the server before any provider runs", () => {
    expect(checkEnvelope("face_colour_analysis", buildServiceRequest("face_colour_analysis", PAYLOADS.face_colour_analysis, who))).toBeNull();
    expect(checkEnvelope("face_colour_analysis", buildServiceRequest("product_matching", PAYLOADS.product_matching, who))).toMatch(/service/);
    expect(checkEnvelope("face_colour_analysis", { service: "face_colour_analysis" })).toMatch(/requestId/);
  });
});
