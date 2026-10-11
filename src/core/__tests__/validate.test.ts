/** The boundary: malformed answers fail calmly, malformed looks are dropped, nothing crashes. */
import { describe, expect, it } from "vitest";
import { mockRecommend } from "../adapters/mock";
import { buildStylingRequest } from "../request";
import { createRequestHistory, createStylingService, type RecommendationAdapter } from "../service";
import { validateStylingResponse } from "../validate";
import { ANON, FIXED_NOW, SCENARIO_A, memoryStorage } from "./helpers";

const request = buildStylingRequest(SCENARIO_A, { anonymousSessionId: ANON, now: FIXED_NOW, requestId: "req_v" });
const ADAPTER = { id: "test", version: "0" };
const good = () => JSON.parse(JSON.stringify(mockRecommend(request)));

describe("response validation", () => {
  it.each([null, "looks", 42, [], {}])("turns %j into a failure the screens can show", (raw) => {
    const { response } = validateStylingResponse(raw, request, ADAPTER);
    expect(response.status).toBe("failed");
    expect(response.outfits).toEqual([]);
    expect(response.error?.retryable).toBe(true);
    expect(response.requestId).toBe(request.requestId);
  });

  it("refuses an answer to a different request", () => {
    const raw = { ...good(), requestId: "req_other" };
    expect(validateStylingResponse(raw, request, ADAPTER).response.error?.code).toBe("mismatched_response");
  });

  it("drops a malformed look and marks the answer partial, never padding it", () => {
    const raw = good();
    delete raw.outfits[1].garments[0].product.price;
    const { response, issues } = validateStylingResponse(raw, request, ADAPTER);
    expect(response.status).toBe("partial");
    expect(response.outfits).toHaveLength(2);
    expect(response.outfits.map((o) => o.rank)).toEqual([1, 2]);
    expect(response.fallback?.code).toBe("outfits_dropped");
    expect(issues).toHaveLength(1);
  });

  it("marks an answer with no valid looks as empty", () => {
    const raw = { ...good(), outfits: [{ nonsense: true }] };
    expect(validateStylingResponse(raw, request, ADAPTER).response.status).toBe("empty");
  });

  it("refuses unsafe image links", () => {
    const raw = good();
    raw.outfits[0].visualization.url = "javascript:alert(1)";
    expect(validateStylingResponse(raw, request, ADAPTER).response.outfits.map((o) => o.outfitId)).not.toContain(raw.outfits[0].outfitId);
  });

  it("recomputes the total from the pieces", () => {
    const raw = good();
    raw.outfits[0].pricing.total = 1;
    const { response } = validateStylingResponse(raw, request, ADAPTER);
    const sum = response.outfits[0].garments.reduce((s, g) => s + (g.source === "retail" ? g.product.price : 0), 0);
    expect(response.outfits[0].pricing.total).toBe(sum);
  });

  it("treats unstated stock as unknown and drops unknown factors", () => {
    const raw = good();
    delete raw.outfits[0].garments[0].product.availability;
    raw.outfits[0].explanation.contributingFactors.push({ factor: "astrology", value: "Leo" });
    const { response } = validateStylingResponse(raw, request, ADAPTER);
    const first = response.outfits[0].garments[0];
    expect(first.source === "retail" && first.product.availability).toBe("unknown");
    expect(response.outfits[0].explanation.contributingFactors.map((f) => f.factor)).not.toContain("astrology");
  });

  it("never lets the mock call its looks personalized", () => {
    const raw = { ...good(), mode: "personalized" };
    expect(validateStylingResponse(raw, request, { id: "mock", version: "1" }).response.mode).toBe("demonstration");
  });
});

describe("styling service", () => {
  const history = () => createRequestHistory(() => memoryStorage());

  it("turns an adapter that throws into a failed response", async () => {
    const broken: RecommendationAdapter = { id: "broken", version: "0", recommend: () => Promise.reject(new Error("down")) };
    const response = await createStylingService(broken, history()).recommend(request);
    expect(response).toMatchObject({ status: "failed", error: { code: "adapter_error" } });
  });

  it("records each request with its response, and finds the latest for the same inputs", async () => {
    const h = history();
    const mock: RecommendationAdapter = { id: "mock", version: "1.0.0", recommend: async (r) => mockRecommend(r) };
    const service = createStylingService(mock, h);
    const first = await service.recommend(request);
    const second = await service.recommend({ ...request, requestId: "req_v2" });
    expect(h.all()).toHaveLength(2);
    expect(h.latest(request.inputKey)?.response.recommendationId).toBe(second.recommendationId);
    expect(h.byRecommendation(first.recommendationId)?.request.requestId).toBe("req_v");
  });
});
