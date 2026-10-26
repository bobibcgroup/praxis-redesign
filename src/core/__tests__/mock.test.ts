/**
 * The mock adapter: deterministic, distinguishable between scenarios, explained by the rules it
 * actually used, and always inside the contract. It proves the plumbing, not the styling.
 */
import { describe, expect, it } from "vitest";
import { mockRecommend } from "../adapters/mock";
import { SPEND, TIMES, VENUES, VIBES, timesFor, type OccasionId } from "../../shared/catalog";
import { buildStylingRequest, wardrobeRef, type MomentInputs } from "../request";
import { validateStylingResponse } from "../validate";
import { ANON, FIXED_NOW, SCENARIO_A, SCENARIO_B } from "./helpers";

const req = (inputs: MomentInputs, extra = {}) => buildStylingRequest(inputs, { anonymousSessionId: ANON, now: FIXED_NOW, requestId: "req_test", ...extra });
const ADAPTER = { id: "mock", version: "1.0.0" };

describe("mock adapter", () => {
  it("answers the same request the same way", () => {
    expect(mockRecommend(req(SCENARIO_A))).toEqual(mockRecommend(req(SCENARIO_A)));
  });

  it("returns distinguishable looks for scenario A and scenario B", () => {
    const a = mockRecommend(req(SCENARIO_A));
    const b = mockRecommend(req(SCENARIO_B));
    expect(a.outfits[0].outfitId).toBe("dinner_sharper_01");
    expect(b.outfits[0].outfitId).toBe("dinner_relaxed_01");
    expect(a.outfits.map((o) => o.outfitId)).not.toEqual(b.outfits.map((o) => o.outfitId));
    expect(a.outfits[0].explanation.summary).not.toBe(b.outfits[0].explanation.summary);
    expect(a.outfits[0].pricing.total).toBeGreaterThan(b.outfits[0].pricing.total);
  });

  it("lets the place change the order, not only the feel, and the time change the words", () => {
    const dateWalkDay = mockRecommend(req({ occasion: "DATE", venue: "WALK", time: "DAY", vibe: "SHARP", spend: "SENSIBLE" }));
    const dateRestaurantNight = mockRecommend(req({ occasion: "DATE", venue: "RESTAURANT", time: "NIGHT", vibe: "SHARP", spend: "SENSIBLE" }));
    expect(dateWalkDay.outfits.map((o) => o.outfitId)).not.toEqual(dateRestaurantNight.outfits.map((o) => o.outfitId));
    const workDay = mockRecommend(req({ occasion: "WORK", venue: "OFFICE", time: "DAY", vibe: "SAFE", spend: "ELEVATED" }));
    const workNight = mockRecommend(req({ occasion: "WORK", venue: "OFFICE", time: "NIGHT", vibe: "SAFE", spend: "ELEVATED" }));
    const timeLine = (r: typeof workDay) => r.outfits[0].explanation.contributingFactors.find((f) => f.factor === "time")?.influence;
    expect(timeLine(workDay)).not.toBe(timeLine(workNight));
  });

  it("explains each look with the factors it used, never with a model's reasoning", () => {
    const r = mockRecommend(req(SCENARIO_A));
    for (const o of r.outfits) {
      expect(o.explanation.source).toBe("mock_rules");
      expect(o.explanation.contributingFactors.map((f) => f.factor)).toEqual(["occasion", "venue", "time", "style", "budget"]);
      // The occasion carries no line of its own: the setting line says why the look suits it.
      expect(o.explanation.contributingFactors.filter((f) => f.factor !== "occasion").every((f) => f.influence && f.influence.length > 0)).toBe(true);
    }
    expect(r.outfits[0].explanation.summary).toBe("Sharp, as you asked, for dinner at a restaurant at night.");
    expect(r.outfits[0].explanation.contributingFactors.find((f) => f.factor === "venue")?.influence).toBe("A blazer over a fitted knit is refined for a restaurant without feeling stiff.");
    // The other looks say what they offer instead of the feel asked for.
    expect(r.outfits[2].explanation.summary).toMatch(/^The (easier|classic) option/);
  });

  it("says plainly when a look is dressier than the place, instead of hiding it", () => {
    const r = mockRecommend(req(SCENARIO_B));
    const sharper = r.outfits.find((o) => o.outfitId === "dinner_sharper_01");
    expect(sharper?.explanation.contributingFactors.find((f) => f.factor === "venue")?.influence).toMatch(/^Dressier than most dinners at home\./);
  });

  it("is a demonstration with example prices and unknown stock", () => {
    const r = mockRecommend(req(SCENARIO_A));
    expect(r.mode).toBe("demonstration");
    for (const o of r.outfits) {
      expect(o.pricing.status).toBe("example");
      expect(o.visualization.fidelity).toBe("representative");
      for (const g of o.garments) if (g.source === "retail") expect(g.product).toMatchObject({ priceStatus: "example", availability: "unknown" });
    }
  });

  it("keeps example prices inside the chosen budget", () => {
    for (const spend of ["SENSIBLE", "ELEVATED"] as const) {
      const r = mockRecommend(req({ ...SCENARIO_A, spend }));
      for (const o of r.outfits) {
        if (spend === "SENSIBLE") expect(o.pricing.total).toBeLessThanOrEqual(300);
        else expect(o.pricing.total).toBeGreaterThanOrEqual(300), expect(o.pricing.total).toBeLessThanOrEqual(900);
      }
    }
  });

  it("puts an owned piece in every look as the customer's, outside the total", () => {
    const owned = wardrobeRef("top", "Your navy overshirt", "sample");
    const r = mockRecommend(req(SCENARIO_A, { wardrobe: [owned] }));
    for (const o of r.outfits) {
      const top = o.garments.find((g) => g.slot === "top");
      expect(top).toMatchObject({ source: "wardrobe", wardrobeItemId: owned.wardrobeItemId, name: "Your navy overshirt" });
      const retail = o.garments.reduce((sum, g) => sum + (g.source === "retail" ? g.product.price : 0), 0);
      expect(o.pricing.total).toBe(retail);
      expect(o.explanation.contributingFactors.at(-1)).toMatchObject({ factor: "wardrobe", value: "Your navy overshirt" });
    }
  });

  it("produces a valid response for every combination of answers", () => {
    let combos = 0;
    for (const occasion of Object.keys(VENUES) as OccasionId[]) {
      for (const venue of VENUES[occasion]) {
        for (const time of timesFor(occasion)) {
          for (const vibe of VIBES) {
            for (const spend of SPEND) {
              const request = req({ occasion, venue: venue.id, time: time.id, vibe: vibe.id, spend: spend.id });
              const raw = mockRecommend(request);
              const { response, issues } = validateStylingResponse(raw, request, ADAPTER);
              expect(issues).toEqual([]);
              expect(response.status).toBe("completed");
              expect(response.outfits).toHaveLength(3);
              expect(response.outfits.map((o) => o.rank)).toEqual([1, 2, 3]);
              combos += 1;
            }
          }
        }
      }
    }
    expect(combos).toBeGreaterThan(400);
    expect(TIMES).toHaveLength(4);
  });
});
