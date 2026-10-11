/** F1: every answer reaches the styling request, and changing one changes the request. */
import { describe, expect, it } from "vitest";
import { buildStylingRequest, inputKeyFor, wardrobeRef, type MomentInputs } from "../request";
import { ANON, FIXED_NOW, SCENARIO_A } from "./helpers";

const base = (inputs: MomentInputs = SCENARIO_A, extra: Partial<Parameters<typeof buildStylingRequest>[1]> = {}) =>
  buildStylingRequest(inputs, { anonymousSessionId: ANON, now: FIXED_NOW, requestId: "req_fixed", ...extra });

describe("styling request", () => {
  it("carries every answer, with the place and time the old engine dropped", () => {
    const owned = wardrobeRef("top", "Your navy overshirt", "sample");
    const r = base(SCENARIO_A, {
      userId: "user_1",
      wardrobe: [owned],
      styleProfileId: "dna_1",
      preferences: { likedOutfitIds: ["a"], rejectedOutfitIds: [], reasonCounts: { too_formal: 1 }, dislikedGarmentIds: [] },
    });
    expect(r).toMatchObject({
      requestId: "req_fixed",
      contractVersion: "1.0",
      journey: "style_a_moment",
      anonymousSessionId: ANON,
      userId: "user_1",
      occasion: "DINNER",
      venue: { type: "RESTAURANT", label: "Restaurant" },
      timeOfDay: "NIGHT",
      preferredVibe: "SHARP",
      budget: { band: "ELEVATED", minimum: 300, maximum: 900, currency: "USD" },
      styleProfileId: "dna_1",
      wardrobeItems: [owned],
      generatedAt: FIXED_NOW.toISOString(),
    });
    expect(r.preferences?.reasonCounts.too_formal).toBe(1);
  });

  it("states budget bounds as numbers, and none for no limit", () => {
    expect(base({ ...SCENARIO_A, spend: "SENSIBLE" }).budget).toEqual({ band: "SENSIBLE", maximum: 300, currency: "USD" });
    expect(base({ ...SCENARIO_A, spend: "OPEN" }).budget).toEqual({ band: "OPEN", currency: "USD" });
  });

  it.each([
    ["venue", { venue: "BAR" }],
    ["time", { time: "SUNSET" }],
    ["vibe", { vibe: "RELAXED" }],
    ["spend", { spend: "OPEN" }],
    ["occasion", { occasion: "DATE", venue: "RESTAURANT" }],
  ] as const)("changes the payload and the input key when the %s changes", (_, change) => {
    const a = base();
    const b = base({ ...SCENARIO_A, ...change } as MomentInputs);
    expect(b.inputKey).not.toBe(a.inputKey);
    expect({ ...b, requestId: "", inputKey: "" }).not.toEqual({ ...a, requestId: "", inputKey: "" });
  });

  it("changes the input key for an owned piece or a Style DNA, not for feedback", () => {
    const key = inputKeyFor(SCENARIO_A);
    expect(inputKeyFor(SCENARIO_A, [wardrobeRef("shoes", "Your black loafers", "sample")])).not.toBe(key);
    expect(inputKeyFor(SCENARIO_A, [], "dna_1")).not.toBe(key);
    const withPrefs = base(SCENARIO_A, { preferences: { likedOutfitIds: ["x"], rejectedOutfitIds: [], reasonCounts: {}, dislikedGarmentIds: [] } });
    expect(withPrefs.inputKey).toBe(base().inputKey);
  });

  it("gives the same inputs the same key and every submission its own id", () => {
    const one = buildStylingRequest(SCENARIO_A, { anonymousSessionId: ANON });
    const two = buildStylingRequest(SCENARIO_A, { anonymousSessionId: ANON });
    expect(one.inputKey).toBe(two.inputKey);
    expect(one.requestId).not.toBe(two.requestId);
    expect(one.requestId).toMatch(/^req_/);
  });

  it("keeps the same owned piece the same item, and never carries its photo", () => {
    const a = wardrobeRef("top", "Your own top", "upload", "hash1");
    expect(wardrobeRef("top", "Your own top", "upload", "hash1")).toEqual(a);
    expect(wardrobeRef("top", "Your own top", "upload", "hash2").wardrobeItemId).not.toBe(a.wardrobeItemId);
    expect(JSON.stringify(base(SCENARIO_A, { wardrobe: [a] }))).not.toMatch(/data:|base64/);
  });
});
