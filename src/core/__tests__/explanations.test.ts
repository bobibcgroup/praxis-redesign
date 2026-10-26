/**
 * Why this look, across every answer the journey offers: five occasions, each place, each time, each
 * feel and each budget. These check the demonstration rules (mock_rules) only. They prove the reasons
 * are consistent with the answers and true to the pieces in each photograph; they say nothing about
 * how good a production styling engine's choices would be.
 */
import { describe, expect, it } from "vitest";
import { mockRecommend } from "../adapters/mock";
import { FEEL_LINE, OPTION_LINE, SETTING_LINE, TIME_LINE } from "../adapters/mockWords";
import { OUTFITS } from "../../lib/outfitLibrary";
import { SPEND, VENUES, VIBES, timesFor, type OccasionId } from "../../shared/catalog";
import { buildStylingRequest, wardrobeRef, type MomentInputs } from "../request";
import { whyRows } from "../../a/ui/LookWhy";
import type { OutfitRecommendation } from "../contracts";
import { ANON, FIXED_NOW } from "./helpers";

const req = (inputs: MomentInputs, extra = {}) => buildStylingRequest(inputs, { anonymousSessionId: ANON, now: FIXED_NOW, requestId: "req_test", ...extra });
const line = (o: OutfitRecommendation, kind: string) => o.explanation.contributingFactors.find((f) => f.factor === kind)?.influence ?? "";
const ROLE_FOR_VIBE = { SAFE: "classic", SHARP: "sharper", RELAXED: "relaxed" } as const;

/** Every combination of answers the journey can produce. */
function* everyAnswer(): Generator<MomentInputs> {
  for (const occasion of Object.keys(VENUES) as OccasionId[])
    for (const venue of VENUES[occasion])
      for (const time of timesFor(occasion))
        for (const vibe of VIBES) for (const spend of SPEND) yield { occasion, venue: venue.id, time: time.id, vibe: vibe.id, spend: spend.id };
}

/** Wording the first review found generic, contradictory or negative. None of it may come back. */
const RETIRED = [/Less usual/i, /More of a daytime look/i, /More of an evening look/i, /Works day or night/i, /alternative/i, /^One of my/i, /^Right for /i, /Made for the (day|evening)$/];

describe("Why this look across every answer", () => {
  const all = [...everyAnswer()].map((inputs) => ({ inputs, response: mockRecommend(req(inputs)) }));

  it("covers all five occasions and every place, time, feel and budget", () => {
    expect(new Set(all.map((a) => a.inputs.occasion)).size).toBe(5);
    expect(all.length).toBe(504);
  });

  it("never uses the retired wording, dashes, or anything that reads as unsuitable", () => {
    for (const { response } of all)
      for (const o of response.outfits) {
        const words = [o.explanation.summary, ...o.explanation.contributingFactors.map((f) => f.influence ?? "")];
        for (const w of words) {
          for (const r of RETIRED) expect(w, w).not.toMatch(r);
          expect(w, w).not.toMatch(/[–—]| - /);
          expect(w, w).not.toMatch(/unsuitable|wrong|not ideal/i);
        }
      }
  });

  it("puts the feel the customer asked for first, and it fits the place and the time", () => {
    for (const { inputs, response } of all) {
      const top = response.outfits[0];
      expect(top.role, JSON.stringify(inputs)).toBe(ROLE_FOR_VIBE[inputs.vibe as keyof typeof ROLE_FOR_VIBE]);
      expect(line(top, "style")).toBe(FEEL_LINE[top.outfitId]);
      expect(line(top, "time")).toBe(TIME_LINE[top.outfitId][inputs.time]);
      expect(line(top, "venue")).toBe(SETTING_LINE[top.outfitId][inputs.venue]);
    }
  });

  it("describes the other two looks as options, not as the feel that was asked for", () => {
    for (const { response } of all)
      for (const o of response.outfits.slice(1)) {
        expect(line(o, "style")).toBe(OPTION_LINE[o.outfitId]);
        expect(o.explanation.summary).toMatch(/^The (classic|sharper|easier) option for /);
      }
  });

  it("speaks to the hour chosen: no night words for the day, no daylight for the evening", () => {
    for (const { inputs, response } of all)
      for (const o of response.outfits) {
        const time = line(o, "time");
        if (inputs.time === "DAY" || inputs.time === "SUNRISE") expect(time, time).not.toMatch(/night|after dark|evening light|reception/i);
        if (inputs.time === "NIGHT" || inputs.time === "SUNSET") expect(time, time).not.toMatch(/daytime|daylight|morning/i);
        expect(o.explanation.summary).toContain({ SUNRISE: "at sunrise", DAY: "during the day", SUNSET: "in the early evening", NIGHT: "at night" }[inputs.time]);
      }
  });

  it("keeps the place lines free of the hour, so they hold by day and by night", () => {
    for (const entry of OUTFITS) {
      const hours = timesFor(entry.occasion).map((t) => t.id);
      if (!(hours.includes("DAY") && hours.includes("NIGHT"))) continue;
      for (const w of Object.values(SETTING_LINE[entry.id])) expect(w, `${entry.id}: ${w}`).not.toMatch(/\b(day|daytime|daylight|morning|night|evening|after dark|tonight)\b/i);
    }
  });

  it("gives each hour its own words for every look", () => {
    for (const entry of OUTFITS) {
      const lines = Object.values(TIME_LINE[entry.id]);
      expect(new Set(lines).size, entry.id).toBe(lines.length);
      expect(Object.keys(TIME_LINE[entry.id]).sort()).toEqual([...timesFor(entry.occasion).map((t) => t.id)].sort());
      expect(Object.keys(SETTING_LINE[entry.id]).sort()).toEqual(VENUES[entry.occasion].map((v) => v.id).sort());
    }
  });

  it("only names pieces that are in the photograph", () => {
    // Each garment word in a look's reasons must be in that look's own list of pieces.
    const NEEDS: Array<[RegExp, RegExp]> = [
      [/blazer/i, /blazer/i],
      [/\bsuit\b/i, /suit/i],
      [/\btie\b/i, /tie/i],
      [/knit/i, /knit/i],
      [/\bpolo\b/i, /polo/i],
      [/overshirt/i, /overshirt/i],
      [/\bshirt\b|collar/i, /shirt|polo/i],
      [/t-shirt/i, /t-shirt/i],
      [/bomber/i, /bomber/i],
      [/jacket/i, /jacket|blazer|suit/i],
      [/jeans/i, /jeans/i],
      [/chinos/i, /chinos/i],
      [/trousers|tailoring|tailored/i, /trousers|suit|blazer/i],
      [/sneakers/i, /sneakers/i],
      [/boots/i, /boots/i],
      [/loafers/i, /loafers/i],
      [/oxfords/i, /oxfords/i],
      [/leather shoes/i, /leather|oxfords/i],
      [/navy/i, /navy/i],
      [/charcoal/i, /charcoal/i],
      [/\bblack\b/i, /black/i],
      [/\bwhite\b/i, /white/i],
    ];
    for (const entry of OUTFITS) {
      const pieces = Object.values(entry.items).join(" ");
      const words = [...Object.values(SETTING_LINE[entry.id]), ...Object.values(TIME_LINE[entry.id]), FEEL_LINE[entry.id], OPTION_LINE[entry.id]];
      for (const w of words) for (const [said, needs] of NEEDS) if (said.test(w)) expect(pieces, `${entry.id}: "${w}"`).toMatch(needs);
    }
  });

  it("states the example total, what it covers and the budget it sits in", () => {
    for (const { inputs, response } of all)
      for (const o of response.outfits) {
        const budget = line(o, "budget");
        expect(budget).toContain(`$${o.pricing.total.toLocaleString("en-US")} for the whole look`);
        expect(budget).toMatch(/^Example prices/);
        if (inputs.spend === "SENSIBLE") expect(budget).toContain("under $300");
        if (inputs.spend === "ELEVATED") expect(budget).toContain("$300 to $900");
        if (inputs.spend === "OPEN") expect(budget).toContain("no limit");
      }
  });

  it("reads as three short groups on the page", () => {
    for (const { response } of all)
      for (const o of response.outfits) {
        const rows = whyRows(o.explanation.contributingFactors);
        expect(rows).toHaveLength(3);
        for (const r of rows) expect(r.text.length, r.text).toBeLessThanOrEqual(200);
      }
  });

  it("adds a row for an owned piece, and counts only the pieces to buy", () => {
    const owned = wardrobeRef("top", "Your navy overshirt", "sample");
    const r = mockRecommend(req({ occasion: "DATE", venue: "WALK", time: "DAY", vibe: "RELAXED", spend: "SENSIBLE" }, { wardrobe: [owned] }));
    for (const o of r.outfits) {
      const rows = whyRows(o.explanation.contributingFactors);
      expect(rows.map((x) => x.label)).toContain("Your navy overshirt");
      expect(line(o, "budget")).toContain("for the pieces to buy");
    }
  });

  it("mentions the Style DNA only when it moved the look", () => {
    const leaning = { tastes: ["classic-tailored"], week: { value: "OFFICE" as const, basis: "confirmed" as const } };
    const r = mockRecommend(req({ occasion: "DINNER", venue: "RESTAURANT", time: "NIGHT", vibe: "SAFE", spend: "ELEVATED" }, { styleProfile: leaning }));
    expect(r.outfits.some((o) => line(o, "style_dna") === "Close to the taste in your Style DNA.")).toBe(true);
    const neutral = { tastes: ["classic-tailored", "relaxed-weekend"] };
    const n = mockRecommend(req({ occasion: "DINNER", venue: "RESTAURANT", time: "NIGHT", vibe: "SAFE", spend: "ELEVATED" }, { styleProfile: neutral }));
    for (const o of n.outfits) expect(o.explanation.contributingFactors.some((f) => f.factor === "style_dna")).toBe(false);
  });
});
