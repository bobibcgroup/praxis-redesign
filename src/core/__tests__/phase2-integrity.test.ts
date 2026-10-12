/** Phase 2: every answer reaches the request, and the engine uses Style DNA, feedback and budget. */
import { describe, expect, it } from "vitest";
import { dnaTier, mockRecommend } from "../adapters/mock";
import { serviceColourAdapter, serviceRetailer } from "../ai/bridge";
import { aiServices, MOCKS } from "../ai/services";
import type { PreferenceSnapshot, StyleProfileSummary } from "../contracts";
import { IMAGE_POLICIES } from "../images";
import { buildStylingRequest, inputKeyFor, wardrobeRef } from "../request";
import { ANON, FIXED_NOW, SCENARIO_A, SCENARIO_B } from "./helpers";

const base = { anonymousSessionId: ANON, now: FIXED_NOW, requestId: "req_t" };
const prefs = (p: Partial<PreferenceSnapshot>): PreferenceSnapshot => ({ likedOutfitIds: [], rejectedOutfitIds: [], reasonCounts: {}, dislikedGarmentIds: [], ...p });

describe("request integrity", () => {
  it("carries every answer, the owned piece, the Style DNA and the feedback", () => {
    const owned = wardrobeRef("shoes", "Brown loafers", "upload", "abc");
    const dna: StyleProfileSummary = { tastes: ["classic-tailored"], fit: { value: "SLIM", basis: "confirmed" } };
    const r = buildStylingRequest(SCENARIO_A, { ...base, userId: "user_1", wardrobe: [owned], styleProfileId: "dna_1", styleProfile: dna, preferences: prefs({ likedOutfitIds: ["x"] }) });
    expect(r).toMatchObject({
      occasion: "DINNER",
      venue: { type: "RESTAURANT" },
      timeOfDay: "NIGHT",
      preferredVibe: "SHARP",
      budget: { band: "ELEVATED", minimum: 300, maximum: 900, currency: "USD" },
      wardrobeItems: [owned],
      userId: "user_1",
      anonymousSessionId: ANON,
      styleProfileId: "dna_1",
      styleProfile: dna,
      preferences: { likedOutfitIds: ["x"] },
    });
  });

  it("gives a different key whenever an answer, the owned piece or the Style DNA changes", () => {
    const keys = new Set([
      inputKeyFor(SCENARIO_A),
      inputKeyFor(SCENARIO_B),
      inputKeyFor({ ...SCENARIO_A, spend: "OPEN" }),
      inputKeyFor({ ...SCENARIO_A, time: "SUNSET" }),
      inputKeyFor({ ...SCENARIO_A, vibe: "RELAXED" }),
      inputKeyFor(SCENARIO_A, [wardrobeRef("top", "Shirt", "sample")]),
      inputKeyFor(SCENARIO_A, [], "dna_1"),
    ]);
    expect(keys.size).toBe(7);
  });
});

describe("the engine uses what it is given", () => {
  it("moves a look the client rejected down, and one they liked up", () => {
    const plain = mockRecommend(buildStylingRequest(SCENARIO_A, base));
    const first = plain.outfits[0].outfitId;
    const rejected = mockRecommend(buildStylingRequest(SCENARIO_A, { ...base, preferences: prefs({ rejectedOutfitIds: [first] }) }));
    expect(rejected.outfits[0].outfitId).not.toBe(first);
    const last = plain.outfits[plain.outfits.length - 1].outfitId;
    const liked = mockRecommend(buildStylingRequest(SCENARIO_A, { ...base, preferences: prefs({ likedOutfitIds: [last] }) }));
    expect(liked.outfits.findIndex((o) => o.outfitId === last)).toBeLessThanOrEqual(plain.outfits.findIndex((o) => o.outfitId === last));
  });

  it("reads a tier from Style DNA only when tastes and week agree", () => {
    expect(dnaTier({ tastes: ["relaxed-weekend", "smart-casual"] })).toBe("RELAXED");
    expect(dnaTier({ tastes: ["relaxed-weekend", "classic-tailored"] })).toBeNull();
    expect(dnaTier(undefined)).toBeNull();
  });

  it("says when Style DNA or feedback shaped a look", () => {
    const r = mockRecommend(buildStylingRequest(SCENARIO_A, { ...base, styleProfile: { tastes: ["classic-tailored", "elevated-street"] } }));
    expect(r.outfits.some((o) => o.explanation.contributingFactors.some((f) => f.factor === "style_dna"))).toBe(true);
  });

  it("never shows a look whose example total is over the budget", () => {
    for (const s of [SCENARIO_A, SCENARIO_B]) {
      const req = buildStylingRequest(s, base);
      const r = mockRecommend(req);
      for (const o of r.outfits) expect(o.pricing.total).toBeLessThanOrEqual(req.budget.maximum ?? Infinity);
      expect(r.outfits.map((o) => o.rank)).toEqual(r.outfits.map((_, i) => i + 1));
    }
  });
});

describe("the bridge to the screens", () => {
  it("turns the colour service into the adapter the Style DNA screen uses, labelled as a sample", async () => {
    const adapter = serviceColourAdapter(aiServices({ face_colour_analysis: MOCKS.face_colour_analysis(() => "success") }));
    const out = await adapter.analyse({ ref: "x", category: "face_colour", width: 800, height: 800, consentVersion: IMAGE_POLICIES.face_colour.consentVersion });
    expect(out).toMatchObject({ status: "completed", undertone: { value: "cool", source: "sample" } });
  });

  it("leaves pieces as they were when the stock check fails", async () => {
    const retailer = serviceRetailer(aiServices({ inventory_pricing: MOCKS.inventory_pricing(() => "failure") }));
    expect(await retailer.lookup([{ productId: "sample_x_top", retailerId: "r", retailerName: "R", price: 10, currency: "USD", priceStatus: "example", availability: "unknown" }])).toEqual([]);
  });
});
