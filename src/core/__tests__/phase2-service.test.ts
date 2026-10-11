/** F7 and F9: product matching, time limits, cancelling, test mode, and the processing states. */
import { describe, expect, it } from "vitest";
import { mockRecommend } from "../adapters/mock";
import { MAX_ATTEMPTS, processingReducer, resubmit, type ProcessingState } from "../processing";
import { buildStylingRequest } from "../request";
import { canPurchase, createMockRetailer, matchProducts, stockFor } from "../retail";
import { createRequestHistory, createStylingService, withSimulation, type RecommendationAdapter } from "../service";
import type { SimScenario } from "../sim";
import { validateStylingResponse } from "../validate";
import { ANON, FIXED_NOW, SCENARIO_A, memoryStorage } from "./helpers";

const request = buildStylingRequest(SCENARIO_A, { anonymousSessionId: ANON, now: FIXED_NOW, requestId: "req_p2" });
const mock: RecommendationAdapter = { id: "mock", version: "1.0.0", recommend: async (r) => mockRecommend(r) };
const history = () => createRequestHistory(() => memoryStorage());
const retailPieces = (r: Awaited<ReturnType<ReturnType<typeof createStylingService>["recommend"]>>) =>
  r.outfits.flatMap((o) => o.garments.flatMap((g) => (g.source === "retail" ? [g.product] : [])));

describe("product matching", () => {
  it("adds sizes and a category, keeps stock unknown, and says the sample pieces cannot be bought", async () => {
    const service = createStylingService(mock, history(), { retailer: createMockRetailer() });
    const products = retailPieces(await service.recommend(request));
    expect(products.length).toBeGreaterThan(0);
    for (const p of products) {
      expect(p.availableSizes?.length).toBeGreaterThan(0);
      expect(p.category).toBeTruthy();
      expect(p.availability).toBe("unknown");
      expect(p.priceStatus).toBe("example");
      expect(p.purchase).toEqual({ kind: "none", reason: "example_product" });
      expect(canPurchase(p)).toBe(false);
    }
  });

  it("marks sold out pieces per size when the retailer says so", async () => {
    const service = createStylingService(mock, history(), { retailer: createMockRetailer((id) => id.endsWith("_shoes")) });
    const shoes = retailPieces(await service.recommend(request)).filter((p) => p.productId.endsWith("_shoes"));
    expect(shoes.length).toBeGreaterThan(0);
    for (const p of shoes) {
      expect(p.availability).toBe("out_of_stock");
      expect(stockFor(p, p.availableSizes?.[0])).toBe("out_of_stock");
    }
  });

  it("leaves the pieces alone when the retailer lookup fails", async () => {
    const validated = validateStylingResponse(mockRecommend(request), request, mock).response;
    const out = await matchProducts(validated, { id: "down", lookup: () => Promise.reject(new Error("down")) });
    expect(out).toEqual(validated);
  });

  it("only takes a retailer price when the retailer says how sure it is", async () => {
    const validated = validateStylingResponse(mockRecommend(request), request, mock).response;
    const first = retailPieces(validated)[0];
    const out = await matchProducts(validated, { id: "r", lookup: async () => [{ productId: first.productId, price: 1 }] });
    expect(retailPieces(out)[0].price).toBe(first.price);
    const live = await matchProducts(validated, { id: "r", lookup: async () => [{ productId: first.productId, price: 1, priceStatus: "live" }] });
    expect(retailPieces(live)[0]).toMatchObject({ price: 1, priceStatus: "live" });
  });

  it("accepts a real purchase link only over https", () => {
    const raw = JSON.parse(JSON.stringify(mockRecommend(request)));
    raw.outfits[0].garments[0].product.purchase = { kind: "retailer_site", url: "http://shop.example/item" };
    raw.outfits[0].garments[1].product.purchase = { kind: "affiliate", url: "https://shop.example/item" };
    const { response } = validateStylingResponse(raw, request, mock);
    const [a, b] = response.outfits[0].garments;
    expect(a.source === "retail" && a.product.purchase).toBeUndefined();
    expect(b.source === "retail" && b.product.purchase).toEqual({ kind: "affiliate", url: "https://shop.example/item" });
  });
});

describe("time limit, cancel and test mode", () => {
  const sim = (s: SimScenario | null) => withSimulation(mock, () => s);

  it("gives up on a silent service and says it timed out", async () => {
    const h = history();
    const r = await createStylingService(sim("timeout"), h, { timeoutMs: 30 }).recommend(request);
    expect(r).toMatchObject({ status: "failed", error: { code: "timeout", retryable: true } });
    expect(h.all()).toHaveLength(1);
  });

  it("answers a cancelled request as not retryable and keeps no record of it", async () => {
    const h = history();
    const controller = new AbortController();
    const pending = createStylingService(sim("timeout"), h, { timeoutMs: 5000 }).recommend(request, { signal: controller.signal });
    controller.abort();
    const r = await pending;
    expect(r).toMatchObject({ status: "failed", error: { code: "cancelled", retryable: false } });
    expect(h.all()).toHaveLength(0);
  });

  it.each([
    ["failure", "failed"],
    ["partial", "partial"],
    ["empty", "empty"],
    [null, "completed"],
  ] as const)("test mode %s answers %s", async (scenario, status) => {
    const r = await createStylingService(sim(scenario), history()).recommend(request);
    expect(r.status).toBe(status);
    if (status === "partial") expect(r.outfits).toHaveLength(2);
  });
});

describe("processing states", () => {
  const response = (status: "completed" | "partial" | "empty" | "failed", retryable = true) => ({
    ...validateStylingResponse(mockRecommend(request), request, mock).response,
    status,
    error: status === "failed" ? { code: "timeout", message: "", retryable } : undefined,
  });
  const run = (...events: Parameters<typeof processingReducer>[1][]) => events.reduce<ProcessingState>(processingReducer, { status: "idle" });

  it("goes from idle through validation, submission and processing to completed", () => {
    expect(run({ type: "SUBMIT" }).status).toBe("validating");
    expect(run({ type: "SUBMIT" }, { type: "INPUTS_VALID" }).status).toBe("submitted");
    expect(run({ type: "SUBMIT" }, { type: "INPUTS_VALID" }, { type: "STARTED" }).status).toBe("processing");
    expect(run({ type: "SUBMIT" }, { type: "INPUTS_VALID" }, { type: "STARTED" }, { type: "SLOW" }).status).toBe("delayed");
    expect(run({ type: "SUBMIT" }, { type: "INPUTS_VALID" }, { type: "STARTED" }, { type: "SLOW" }, { type: "ANSWERED", response: response("completed") }).status).toBe("completed");
  });

  it("keeps partial and empty answers apart from success", () => {
    const base = [{ type: "SUBMIT" }, { type: "INPUTS_VALID" }, { type: "STARTED" }] as const;
    expect(run(...base, { type: "ANSWERED", response: response("partial") }).status).toBe("partial");
    expect(run(...base, { type: "ANSWERED", response: response("empty") }).status).toBe("empty");
  });

  it("allows a set number of tries, then stops offering Try again", () => {
    let s = run({ type: "SUBMIT" }, { type: "INPUTS_VALID" }, { type: "STARTED" }, { type: "ANSWERED", response: response("failed") });
    expect(s).toMatchObject({ status: "failed", attempt: 1 });
    for (let attempt = 2; attempt <= MAX_ATTEMPTS; attempt += 1) {
      s = processingReducer(s, { type: "RETRY" });
      expect(s).toMatchObject({ status: "retry_requested", attempt });
      s = resubmit(s);
      s = processingReducer(processingReducer(s, { type: "STARTED" }), { type: "ANSWERED", response: response("failed") });
    }
    expect(s).toMatchObject({ status: "retry_exhausted", attempt: MAX_ATTEMPTS });
    expect(processingReducer(s, { type: "RETRY" })).toBe(s);
  });

  it("does not retry what cannot be retried", () => {
    const s = run({ type: "SUBMIT" }, { type: "INPUTS_VALID" }, { type: "STARTED" }, { type: "ANSWERED", response: response("failed", false) });
    expect(s.status).toBe("retry_exhausted");
  });

  it("can be cancelled while working, and ignores an answer that arrives after", () => {
    const s = run({ type: "SUBMIT" }, { type: "INPUTS_VALID" }, { type: "STARTED" }, { type: "CANCEL" });
    expect(s.status).toBe("cancelled");
    expect(processingReducer(s, { type: "ANSWERED", response: response("completed") }).status).toBe("cancelled");
  });

  it("ignores events that make no sense in a state", () => {
    const idle: ProcessingState = { status: "idle" };
    expect(processingReducer(idle, { type: "STARTED" })).toBe(idle);
    expect(processingReducer(idle, { type: "RETRY" })).toBe(idle);
    expect(processingReducer(idle, { type: "CANCEL" })).toBe(idle);
  });
});
