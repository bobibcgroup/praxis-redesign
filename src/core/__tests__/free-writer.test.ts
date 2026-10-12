/** The free stylist's words: Gemini on the server, and how the page takes them. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockRecommend } from "../adapters/mock";
import { buildStylingRequest } from "../request";
import { addStylistWords, resetLiveServices, voiceLine, withWords } from "../ai/words";
import { ANON, SCENARIO_A } from "./helpers";
// @ts-expect-error plain JavaScript module
import * as gemini from "../../../server/providers/gemini-free.mjs";
// @ts-expect-error plain JavaScript module
import { liveServices as serverLive, providerName } from "../../../server/ai.mjs";

const request = () =>
  buildStylingRequest(SCENARIO_A, {
    anonymousSessionId: ANON,
    userId: "user_sam",
    wardrobe: [{ wardrobeItemId: "w1", slot: "top", label: "Navy overshirt", source: "described", colour: "Navy" }],
    styleProfile: { undertone: { value: "cool", basis: "confirmed" }, tastes: ["Minimal"] },
  });

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  resetLiveServices();
  vi.unstubAllEnvs();
});

describe("voice rules", () => {
  it("keeps a plain line and ends it with a full stop", () => {
    expect(voiceLine("A navy knit under charcoal reads quietly sharp at night", 140)).toBe("A navy knit under charcoal reads quietly sharp at night.");
  });
  it.each([
    "An effortless look for dinner tonight.",
    "These products work well together at night.",
    "Built on your DNA for a dinner out.",
    "Sharp — and right for the restaurant.",
    "A well-cut jacket for dinner at night.",
    "My model picked this for your dinner.",
    "Perfect for tonight, enjoy!",
  ])("drops %s", (line) => expect(voiceLine(line, 140)).toBeNull());
  it("allows Style DNA in full", () => {
    expect(voiceLine("It follows your Style DNA, cool and quiet.", 140)).not.toBeNull();
  });
});

describe("the Gemini provider on the server", () => {
  it("switches itself on only when its free key is set, and can be switched off", () => {
    expect(providerName("styling_explanation", {})).toBe("");
    expect(providerName("styling_explanation", { GEMINI_API_KEY: "k" })).toBe("gemini-free");
    expect(providerName("styling_explanation", { GEMINI_API_KEY: "k", AI_PROVIDER_STYLING_EXPLANATION: "off" })).toBe("");
    expect(providerName("styling_recommendation", { GEMINI_API_KEY: "k" })).toBe("");
  });

  it("is listed as live and free once the key is set", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    expect(await serverLive()).toEqual([{ service: "styling_explanation", provider: "gemini-free", version: gemini.MODEL, billable: false }]);
  });

  it("sends the brief and the looks in words, never ids, email or a photo", () => {
    const r = request();
    const looks = mockRecommend(r).outfits.map((o) => ({ outfitId: o.outfitId, role: o.role, title: o.title, pieces: o.garments.map((g) => ({ slot: g.slot, name: g.name })) }));
    const prompt = gemini.promptFor({ request: r, outfitId: looks[0].outfitId, looks });
    expect(prompt).toContain("Occasion: dinner.");
    expect(prompt).toContain("a piece they own: Navy overshirt.");
    expect(prompt).toContain("cool undertone");
    expect(prompt).not.toContain(ANON);
    expect(prompt).not.toContain("user_sam");
    expect(prompt).not.toContain(r.requestId);
  });

  it("refuses anything with a picture in it, and answers disabled without a key", async () => {
    const fetcher = vi.fn();
    expect((await gemini.run({ service: "styling_explanation", payload: { looks: [{}] } }, { fetcher })).status).toBe("disabled");
    vi.stubEnv("GEMINI_API_KEY", "k");
    const out = await gemini.run({ service: "styling_explanation", payload: { request: { note: "data:image/jpeg;base64,AA" }, looks: [{ outfitId: "o" }] } }, { fetcher });
    expect(out.error.code).toBe("validation_error");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps only lines that keep the voice, for the looks asked about", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    const answer = {
      looks: [
        { outfitId: "a", summary: "Sharp enough for a restaurant at night, as you asked", note: "The navy knit keeps the charcoal jacket calm." },
        { outfitId: "b", summary: "An effortless choice for dinner", note: "Easy pieces that work." },
        { outfitId: "zzz", summary: "A look I was not asked about at all", note: "Should never be kept by the page." },
      ],
    };
    const fetcher = vi.fn(async () => json(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] }));
    const out = await gemini.run({ service: "styling_explanation", payload: { request: request(), outfitId: "a", looks: [{ outfitId: "a" }, { outfitId: "b" }] } }, { fetcher });
    expect(out.status).toBe("partial");
    expect(out.result.looks).toEqual([{ outfitId: "a", summary: "Sharp enough for a restaurant at night, as you asked.", note: "The navy knit keeps the charcoal jacket calm." }]);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(`/models/${gemini.MODEL}:generateContent`);
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("k");
  });

  it("says the free limit is reached instead of retrying", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    const out = await gemini.run({ service: "styling_explanation", payload: { request: request(), outfitId: "a", looks: [{ outfitId: "a" }] } }, { fetcher: async () => json(429, {}) });
    expect(out.status).toBe("failed");
    expect(out.error.retryable).toBe(false);
  });
});

describe("the page with a free writer", () => {
  it("leaves the words alone when the server has no writer", async () => {
    const r = request();
    const response = mockRecommend(r);
    const fetcher = vi.fn(async () => json(200, { live: [] }));
    expect(await addStylistWords(response, r, { fetcher: fetcher as unknown as typeof fetch })).toBe(response);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("puts the writer's lines on the looks and marks them as the model's", async () => {
    const r = request();
    const response = mockRecommend(r);
    const [first, second] = response.outfits;
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/ai") return json(200, { live: [{ service: "styling_explanation", provider: "gemini-free", version: "x", billable: false }] });
      const body = JSON.parse(String(init?.body));
      expect(body.payload.looks).toHaveLength(response.outfits.length);
      expect(JSON.stringify(body)).not.toContain("data:image");
      return json(200, {
        status: "succeeded",
        result: { outfitId: first.outfitId, summary: "x", factors: [], source: "model", looks: [{ outfitId: first.outfitId, summary: "Right for a restaurant at night, sharp as you asked", note: "The knit keeps the jacket quiet, the boots finish it." }] },
      });
    });
    const out = await addStylistWords(response, r, { fetcher: fetcher as unknown as typeof fetch });
    expect(out.outfits[0].rationale).toBe("The knit keeps the jacket quiet, the boots finish it.");
    expect(out.outfits[0].explanation.summary).toBe("Right for a restaurant at night, sharp as you asked.");
    expect(out.outfits[0].explanation.source).toBe("model");
    expect(out.outfits[0].explanation.contributingFactors).toEqual(first.explanation.contributingFactors);
    expect(out.outfits[1]).toEqual(second);
  });

  it("keeps the rules engine's words when the writer fails or breaks the voice", async () => {
    const r = request();
    const response = mockRecommend(r);
    const live = json(200, { live: [{ service: "styling_explanation", provider: "gemini-free", version: "x", billable: false }] });
    const failing = vi.fn(async (url: string) => (url === "/api/ai" ? live.clone() : json(502, { status: "failed", error: { code: "provider_error", message: "no", retryable: true } })));
    expect(await addStylistWords(response, r, { fetcher: failing as unknown as typeof fetch })).toEqual(response);
    expect(withWords(response, { outfitId: "x", summary: "x", factors: [], source: "model", looks: [{ outfitId: response.outfits[0].outfitId, summary: "Curated for your dinner tonight.", note: "Effortless pieces." }] })).toBe(response);
  });

  it("never asks a paid writer", async () => {
    const r = request();
    const response = mockRecommend(r);
    const fetcher = vi.fn(async () => json(200, { live: [{ service: "styling_explanation", provider: "paid", version: "x", billable: true }] }));
    expect(await addStylistWords(response, r, { fetcher: fetcher as unknown as typeof fetch })).toBe(response);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
