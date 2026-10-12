/** The hybrid catalogue: reference pieces, composing looks from a store and the references, and the outfit pictures. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockRecommend } from "../adapters/mock";
import { buildStylingRequest } from "../request";
import { validateStylingResponse } from "../validate";
import { resetLiveServices } from "../ai/words";
import type { OutfitRecommendation, ProductRef, StylingResponse, WardrobeGarment } from "../contracts";
import { REFERENCE_CATALOGUE, referenceOutfit } from "../catalogue/reference";
import { compose, scoreFor, specFromLook, STORE_BAR, toOutfit, type StylingSpec } from "../catalogue/compose";
import { fromStoreProduct, type CatalogueGarment } from "../catalogue/garment";
import { composeHybrid } from "../catalogue/hybrid";
import { clearVisualizations, MAX_VISUALIZATIONS_PER_TAB, mockVisualizationProvider, visualizationLedger, visualizationSpec, visualize, visualizeLooks, withVisualization, type OutfitVisualizationProvider } from "../catalogue/visualize";
import { ANON, SCENARIO_A, memoryStorage } from "./helpers";
// @ts-expect-error plain JavaScript module
import * as library from "../../../server/providers/library-visualization.mjs";
// @ts-expect-error plain JavaScript module
import { afterVisual, beforeVisual, ledger as serverLedger, resetVisuals } from "../../../server/visuals.mjs";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const request = () => buildStylingRequest(SCENARIO_A, { anonymousSessionId: ANON });
const looks = () => mockRecommend(request());
const sharper = () => looks().outfits.find((o) => o.outfitId === "dinner_sharper_01")!;

/** A store piece as the feed sends it, read into the catalogue shape. */
let next = 0;
function piece(title: string, price: number, extra: Partial<ProductRef> = {}): CatalogueGarment {
  next += 1;
  const g = fromStoreProduct({ productId: `shopify_test_${next}`, retailerId: "test", retailerName: "Test Tailors", price, currency: "USD", priceStatus: "live", availability: "in_stock", productUrl: `https://test.example.com/products/${next}`, purchase: { kind: "retailer_site", url: `https://test.example.com/products/${next}` }, title, photos: [{ src: `https://cdn.example.com/${next}.jpg` }], ...extra } as never);
  if (!g) throw new Error(`not a piece: ${title}`);
  return g;
}

afterEach(() => {
  resetLiveServices();
  vi.unstubAllEnvs();
});

describe("the reference catalogue", () => {
  it("files every piece in the fifteen library photographs, never for sale", () => {
    expect(REFERENCE_CATALOGUE.size).toBeGreaterThanOrEqual(55);
    for (const g of REFERENCE_CATALOGUE.values()) {
      expect(g).toMatchObject({ source: "reference", availability: "not_for_sale" });
      expect(g.product).toBeUndefined();
      expect(g.attribution && g.usageRights && g.subcategory && g.colour && g.material && g.fit && g.silhouette).toBeTruthy();
      expect(g.formality).toBeGreaterThanOrEqual(1);
    }
    expect(referenceOutfit("dinner_sharper_01").map((g) => g.name)).toEqual(["Charcoal tweed blazer", "Navy fitted knit", "Black tailored trousers", "Black leather Chelsea boots"]);
    expect(referenceOutfit("dinner_sharper_01")[3].image).toEqual({ src: "/images/dinner_sharper_01.jpg", region: expect.objectContaining({ y: 0.84 }) });
  });
});

describe("composing a look", () => {
  const spec = () => specFromLook(sharper());

  it("builds the spec from the look's reference pieces, layers apart", () => {
    expect(spec().parts.map((p) => [p.partId, p.slot, p.layer ?? "", p.subcategory, p.required])).toEqual([
      ["outer", "top", "outer", "blazer", true],
      ["base", "top", "base", "knit", true],
      ["bottom", "bottom", "", "trousers", true],
      ["shoes", "shoes", "", "chelsea-boots", true],
    ]);
  });

  it("uses only store pieces when each one truly fits", () => {
    const c = { outer: [piece("Wool Blazer in Charcoal", 398)], base: [piece("Merino Crew in Navy", 98)], bottom: [piece("Wool Trousers in Black", 168)], shoes: [piece("Chelsea Boot in Black Leather", 248)] };
    const look = compose(spec(), c);
    expect(look.status).toBe("complete");
    expect(look.picks.map((p) => p.kind)).toEqual(["shopify", "shopify", "shopify", "shopify"]);
  });

  it("mixes: store pieces where they fit, the reference where the store has nothing right", () => {
    const c = { outer: [piece("Wool Blazer in Charcoal", 398)], base: [piece("Merino Crew in Navy", 98)], bottom: [piece("Ripstop Pant in Black", 142), piece("Wool Trousers in Burgundy", 168)], shoes: [] };
    const look = compose(spec(), c);
    expect(look.picks.map((p) => `${p.part.partId}:${p.kind}`)).toEqual(["outer:shopify", "base:shopify", "bottom:reference", "shoes:reference"]);
    expect(look.picks[2].reason).toBe("Store piece not close enough");
    expect(look.picks[3].reason).toBe("Nothing right in the store");
  });

  it("keeps every reference when the store has nothing", () => {
    const look = compose(spec(), {});
    expect(look.status).toBe("complete");
    expect(look.picks.every((p) => p.kind === "reference")).toBe(true);
  });

  it("is partial, and says which part, when a needed part has neither a store piece nor a reference", () => {
    const s: StylingSpec = { ...spec(), parts: spec().parts.map((p) => (p.partId === "shoes" ? { ...p, reference: null } : p)) };
    const look = compose(s, {});
    expect(look).toMatchObject({ status: "partial", issues: ["missing_shoes"] });
    expect(compose({ ...s, parts: s.parts.map((p) => ({ ...p, reference: null })) }, {}).status).toBe("unavailable");
  });

  it("never lets a weaker store piece in: other kind, two steps of formality, a clashing colour, sold out", () => {
    const [outer, , , shoes] = spec().parts;
    expect(scoreFor(outer, piece("Bomber Jacket in Charcoal", 198))).toBeNull();
    expect(scoreFor(shoes, piece("Leather Sneaker in Black", 198))).toBeNull();
    expect(scoreFor(outer, piece("Wool Blazer in Burgundy", 398))!).toBeLessThan(STORE_BAR);
    expect(scoreFor(outer, piece("Wool Blazer in Charcoal", 398, { availability: "out_of_stock" }))).toBeNull();
    expect(scoreFor(outer, piece("Wool Blazer in Charcoal", 398))!).toBeGreaterThanOrEqual(STORE_BAR);
  });

  it("keeps the look inside the budget: the dearest store piece goes back to its reference", () => {
    const c = { outer: [piece("Wool Blazer in Charcoal", 698)], base: [piece("Merino Crew in Navy", 98)], bottom: [], shoes: [] };
    const look = compose(spec(), c, { budgetMax: 600 });
    expect(look.picks.map((p) => p.kind)).toEqual(["reference", "shopify", "reference", "reference"]);
    expect(look.picks[0].reason).toBe("Over your budget");
  });

  it("checks the look as a whole: no more than two accent colours", () => {
    const relaxed = specFromLook(looks().outfits.find((o) => o.outfitId === "dinner_relaxed_01")!);
    const accents = { outer: [piece("Overshirt in Light Blue", 148)], base: [piece("Tee in Red", 38)], bottom: [piece("Jeans in Indigo", 158)], shoes: [piece("Sneakers in Yellow Suede", 198)] };
    const parts = relaxed.parts.map((p) => (p.partId === "base" ? { ...p, colour: undefined } : p.partId === "shoes" ? { ...p, colour: undefined } : p));
    const look = compose({ ...relaxed, parts }, accents);
    const colours = look.picks.map((p) => p.garment?.colour);
    expect(new Set(colours.filter((c) => c && !["white", "black", "grey", "navy", "beige", "brown"].includes(c))).size).toBeLessThanOrEqual(2);
  });

  it("keeps the customer's own piece in its place", () => {
    const o = sharper();
    const owned: WardrobeGarment = { garmentId: "dinner_sharper_01_top_owned", slot: "top", name: "Your navy overshirt", source: "wardrobe", wardrobeItemId: "w1" };
    const s = specFromLook({ ...o, garments: [owned, ...o.garments.filter((g) => g.slot !== "top")] });
    expect(s.owned).toEqual([{ partId: "outer", garment: owned }]);
    expect(compose(s, {}).picks[0]).toMatchObject({ kind: "wardrobe", owned });
  });

  it("returns a look whose price is only the store pieces, with references kept apart and never priced", () => {
    const o = sharper();
    const look = compose(specFromLook(o), { outer: [piece("Wool Blazer in Charcoal", 398)], base: [piece("Merino Crew in Navy", 98)] });
    const out = toOutfit(o, look);
    expect(out.garments.map((g) => g.source)).toEqual(["retail", "retail", "reference", "reference"]);
    expect(out.pricing).toEqual({ total: 496, currency: "USD", status: "live" });
    expect(out.explanation.contributingFactors.find((f) => f.factor === "budget")?.influence).toBe("Real prices, $496 for the 2 pieces to buy; 2 reference pieces not included");
    expect(JSON.stringify(out.garments.filter((g) => g.source === "reference"))).not.toMatch(/price|purchase|productUrl/);
    // The page's own guard reads it the same way.
    const req = request();
    const checked = validateStylingResponse({ ...mockRecommend(req), outfits: [out] } as StylingResponse, req, { id: "mock", version: "1" });
    expect(checked.issues).toEqual([]);
    expect(checked.response.outfits[0].garments.map((g) => g.source)).toEqual(["retail", "retail", "reference", "reference"]);
    expect(checked.response.outfits[0].pricing.total).toBe(496);
  });
});

describe("the outfit picture", () => {
  const blazer = piece("Wool Blazer in Charcoal", 398, { productId: "shopify_test_blazer" });
  const mixed = (): OutfitRecommendation => {
    const o = sharper();
    return toOutfit(o, compose(specFromLook(o), { outer: [blazer] }));
  };

  it("asks for exactly the look's pieces, on the one model, and never sends a customer photo", () => {
    const o = mixed();
    const spec = visualizationSpec(o, mockVisualizationProvider());
    expect(spec.garments.map((g) => g.garmentId)).toEqual(o.garments.map((g) => g.garmentId));
    expect(spec.garments.map((g) => g.source)).toEqual(["shopify", "reference", "reference", "reference"]);
    expect(spec.garments[0]).toMatchObject({ retailerProductId: "shopify_test_blazer", imageUrl: expect.stringMatching(/^https:/) });
    expect(spec.model.modelId).toBe("praxis-model-01");
    const owned = { ...o, garments: [{ garmentId: "own", slot: "top" as const, name: "Your navy overshirt", source: "wardrobe" as const, wardrobeItemId: "w1" }, ...o.garments.slice(1)] };
    expect(visualizationSpec(owned, mockVisualizationProvider()).garments[0]).toEqual({ garmentId: "own", slot: "top", name: "Your navy overshirt", source: "wardrobe" });
  });

  it("names each composition: the same pieces give the same key, any other piece a new one", () => {
    const p = mockVisualizationProvider();
    expect(visualizationSpec(mixed(), p).cacheKey).toBe(visualizationSpec(mixed(), p).cacheKey);
    const other = { ...mixed(), garments: mixed().garments.map((g, i) => (i === 0 && g.source === "retail" ? { ...g, product: { ...g.product, productId: "shopify_test_other" } } : g)) };
    expect(visualizationSpec(other, p).cacheKey).not.toBe(visualizationSpec(mixed(), p).cacheKey);
    expect(visualizationSpec(mixed(), p, { ...visualizationSpec(mixed(), p).model, pose: "walking" }).cacheKey).not.toBe(visualizationSpec(mixed(), p).cacheKey);
  });

  it("mock: the look's library photograph, marked mock and illustrative, tied to the outfit", async () => {
    const store = memoryStorage();
    const p = mockVisualizationProvider();
    const o = mixed();
    const out = await visualize(visualizationSpec(o, p), p, { store });
    expect(out).toMatchObject({ status: "mock", imageUrl: "/images/dinner_sharper_01.jpg", fidelity: "illustrative", costUsd: 0 });
    const shown = withVisualization(o, out);
    expect(shown.visualization).toMatchObject({ outfitId: o.outfitId, status: "mock", fidelity: "representative", sourceGarmentIds: o.garments.map((g) => g.garmentId), cacheKey: out.cacheKey });
  });

  it("mock: waits while processing and stops when the customer leaves", async () => {
    const p = mockVisualizationProvider({ delayMs: 50 });
    const stop = new AbortController();
    const asked = p.visualize(visualizationSpec(mixed(), p), { signal: stop.signal });
    stop.abort();
    await expect(asked).rejects.toThrow();
  });

  it("mock: a failure keeps the look's own photo; one retry gets a picture", async () => {
    const store = memoryStorage();
    const always = mockVisualizationProvider({ fail: () => true });
    const failed = await visualize(visualizationSpec(mixed(), always), always, { store });
    expect(failed.status).toBe("failed");
    expect(withVisualization(mixed(), failed).visualization).toMatchObject({ url: "/images/dinner_sharper_01.jpg", fidelity: "representative" });
    expect(visualizationLedger(store)).toMatchObject({ requests: 2, failures: 1 });
    const once = mockVisualizationProvider({ fail: (_, attempt) => attempt === 1 });
    expect((await visualize(visualizationSpec(mixed(), once), once, { store: memoryStorage() })).status).toBe("mock");
  });

  it("never makes the same composition twice in a tab", async () => {
    const store = memoryStorage();
    const p = mockVisualizationProvider();
    const spy = vi.spyOn(p, "visualize");
    const spec = visualizationSpec(mixed(), p);
    await visualize(spec, p, { store });
    await visualize(spec, p, { store });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(visualizationLedger(store)).toMatchObject({ requests: 1, cacheHits: 1 });
    clearVisualizations(store);
    expect(visualizationLedger(store).requests).toBe(0);
  });

  it("refuses a picture made for other pieces", async () => {
    const liar: OutfitVisualizationProvider = { id: "liar", version: "1", billable: false, visualize: async () => ({ status: "ready", imageUrl: "/x.jpg", fidelity: "verified", provider: "liar", cacheKey: "vis_00000000", costUsd: 0 }) };
    expect((await visualize(visualizationSpec(mixed(), liar), liar, { store: memoryStorage() })).status).toBe("failed");
  });

  it("makes no paid call while paid pictures are off, and stops at the tab's ceiling", async () => {
    const paid: OutfitVisualizationProvider = { id: "paid", version: "1", billable: true, visualize: vi.fn() };
    const out = await visualize(visualizationSpec(mixed(), paid), paid, { store: memoryStorage(), allowBillable: false });
    expect(out).toMatchObject({ status: "failed", error: "Paid pictures are switched off." });
    expect(paid.visualize).not.toHaveBeenCalled();
    const store = memoryStorage();
    store.setItem("praxis_visual_ledger", JSON.stringify({ requests: MAX_VISUALIZATIONS_PER_TAB, cacheHits: 0, failures: 0, refused: 0, costUsd: 0 }));
    const free = mockVisualizationProvider();
    expect((await visualize(visualizationSpec(mixed(), free), free, { store })).error).toMatch(/Too many/);
  });

  it("pictures all three looks of a response, each for its own outfit", async () => {
    const r = looks();
    const out = await visualizeLooks(r, mockVisualizationProvider(), { store: memoryStorage() });
    expect(out.outfits.map((o) => [o.outfitId, o.visualization.outfitId, o.visualization.url])).toEqual(r.outfits.map((o) => [o.outfitId, o.outfitId, `/images/${o.outfitId}.jpg`]));
    expect(new Set(out.outfits.map((o) => o.visualization.cacheKey)).size).toBe(3);
  });
});

describe("on the server", () => {
  afterEach(() => resetVisuals());
  const body = (outfitId: string, key = "vis_0123abcd", who = "anon_a") => ({ requestId: "req_1", anonymousSessionId: who, payload: { outfitId, garmentIds: ["a"], spec: { cacheKey: key } } });

  it("the library stand-in answers with the look's photograph, not generated and free", async () => {
    expect(library).toMatchObject({ billable: false, costPerImageUsd: 0 });
    expect(await library.run({ payload: { outfitId: "dinner_sharper_01" } })).toEqual({ status: "succeeded", result: { outfitId: "dinner_sharper_01", imageUrl: "/images/dinner_sharper_01.jpg", fidelity: "representative", generated: false } });
  });

  it("caches by composition, refuses a picture for another outfit, counts cost, and has a daily ceiling", () => {
    const engine = { id: "paid-model", costPerImageUsd: 0.04 };
    expect(beforeVisual(body("dinner_sharper_01"))).toBeNull();
    const answer = afterVisual(body("dinner_sharper_01"), engine, { status: "succeeded", result: { outfitId: "dinner_sharper_01", imageUrl: "https://img.example.com/a.png", fidelity: "representative", generated: true } });
    expect(answer.metadata.costUsd).toBe(0.04);
    expect(beforeVisual(body("dinner_sharper_01"))?.answer.metadata).toMatchObject({ cached: true, costUsd: 0 });
    expect(afterVisual(body("x"), engine, { status: "succeeded", result: { outfitId: "y" } })).toMatchObject({ status: "failed" });
    expect(serverLedger).toMatchObject({ requests: 2, cacheHits: 1, failures: 1, costUsd: 0.04 });
    vi.stubEnv("VISUALIZATION_DAILY_CAP", "1");
    expect(beforeVisual(body("work_safest_01", "vis_ffff0000", "anon_b"))).toBeNull();
    expect(beforeVisual(body("work_safest_01", "vis_ffff0001", "anon_b"))?.answer.error.code).toBe("rate_limited");
  });
});

describe("the hybrid step", () => {
  const live = (testOnly = true) => json(200, { live: [{ service: "product_matching", provider: "shopify-feed", version: "test", billable: false, ...(testOnly ? { testOnly: true } : {}) }] });
  const product = (id: string, title: string, price: number) => ({ productId: id, retailerId: "test", retailerName: "Test Tailors", price, currency: "USD", priceStatus: "live", availability: "in_stock", purchase: { kind: "retailer_site", url: `https://test.example.com/products/${id}` }, title });

  it("leaves the looks alone for a tab that didn't ask for the test store", async () => {
    const r = looks();
    const fetcher = vi.fn(async () => live());
    expect(await composeHybrid(r, request(), { fetcher: fetcher as unknown as typeof fetch, wanted: () => false })).toBe(r);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("composes all three looks from the store and the references, sending only the parts, then pictures them", async () => {
    const r = looks();
    let sent: { garments: Record<string, unknown>[] } | null = null;
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/ai") return live();
      sent = JSON.parse(String(init?.body)).payload;
      return json(200, {
        status: "succeeded",
        result: {
          matches: sent!.garments.map((g) => ({
            garmentId: g.garmentId,
            products: g.subcategory === "knit" ? [product(`p_${g.garmentId}`, `Merino Crew in ${g.colour === "navy" ? "Navy" : "Grey"}`, 98)] : [],
          })),
        },
      });
    });
    const composed: unknown[] = [];
    const out = await composeHybrid(r, request(), { fetcher: fetcher as unknown as typeof fetch, wanted: () => true, visualizer: mockVisualizationProvider(), store: memoryStorage(), onComposed: (c) => composed.push(...c) });
    expect(Object.keys(sent!.garments[0]).sort()).toEqual(["formality", "garmentId", "layer", "name", "slot", "subcategory", "colour"].sort());
    expect(JSON.stringify(sent)).not.toContain(ANON);
    expect(composed).toHaveLength(3);
    expect(out.outfits).toHaveLength(3);
    for (const o of out.outfits) {
      expect(o.visualization).toMatchObject({ outfitId: o.outfitId, status: "mock", fidelity: "representative" });
      expect(o.garments.every((g) => g.source === "reference" || (g.source === "retail" && g.product.priceStatus === "live"))).toBe(true);
    }
    const knitLook = out.outfits.find((o) => o.garments.some((g) => g.source === "retail"))!;
    expect(knitLook.pricing.status).toBe("live");
  });

  it("says so, and keeps the looks, when the store can't be read", async () => {
    const r = looks();
    const fetcher = vi.fn(async (url: string) => (url === "/api/ai" ? live() : json(200, { status: "failed", error: { code: "provider_error", message: "The store answered 503.", retryable: true } })));
    const out = await composeHybrid(r, request(), { fetcher: fetcher as unknown as typeof fetch, wanted: () => true, store: memoryStorage() });
    expect(out.outfits).toBe(r.outfits);
    expect(out.fallback?.code).toBe("store_unavailable");
  });
});
