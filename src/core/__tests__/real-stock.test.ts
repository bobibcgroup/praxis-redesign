/** Real pieces from a store for testing: the Shopify feed on the server, and how the page takes them. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockRecommend } from "../adapters/mock";
import { buildStylingRequest } from "../request";
import { resetLiveServices } from "../ai/words";
import { addRealPieces, withRealPieces } from "../ai/stock";
import { ANON, SCENARIO_A } from "./helpers";
// @ts-expect-error plain JavaScript module
import * as feed from "../../../server/providers/shopify-feed.mjs";
// @ts-expect-error plain JavaScript module
import { liveServices as serverLive, providerName } from "../../../server/ai.mjs";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const variant = (id: number, size: string, price: string, available: boolean) => ({ id, option1: size, title: size, price, available });
const STORE_PRODUCTS = [
  { id: 1, handle: "navy-merino-crew", title: "The Merino Crew in Navy", product_type: "Sweaters", tags: [], options: [{ name: "Size" }], variants: [variant(11, "S", "98.00", false), variant(12, "M", "98.00", true)], images: [{ src: "https://cdn.example.com/navy.jpg" }] },
  { id: 2, handle: "black-crew", title: "The Merino Crew in Black", product_type: "Sweaters", tags: [], options: [{ name: "Size" }], variants: [variant(21, "M", "98.00", true)], images: [] },
  { id: 3, handle: "grey-chino", title: "The Democratic Chino in Grey", product_type: "Pants", tags: [], options: [{ name: "Size" }], variants: [variant(31, "32", "128.00", true)], images: [] },
  { id: 4, handle: "suede-boot", title: "The Ranch Boot in Brown Suede", product_type: "Footwear", tags: ["boots"], options: [{ name: "Size" }], variants: [variant(41, "10", "298.00", false)], images: [] },
  { id: 6, handle: "jack-oxford", title: "The Jack in Marsh Check Oxford", product_type: "", tags: [], options: [{ name: "Size" }], variants: [variant(61, "M", "128.00", true)], images: [] },
  { id: 5, handle: "gift-card", title: "Gift Card", product_type: "Gift Card", tags: [], options: [], variants: [variant(51, "Default Title", "50.00", true)], images: [] },
];
const store = vi.fn(async (url: string) => (url.includes("/products.json") ? json(200, { products: url.includes("page=1") ? STORE_PRODUCTS : [] }) : json(200, { name: "Test Tailors" })));

afterEach(() => {
  resetLiveServices();
  feed.resetCatalogue();
  vi.unstubAllEnvs();
  store.mockClear();
});

describe("the store feed on the server", () => {
  it("switches itself on with a store address, for test browsers unless told otherwise", async () => {
    expect(providerName("product_matching", {})).toBe("");
    expect(providerName("product_matching", { RETAIL_SHOPIFY_STORE: "www.example.com" })).toBe("shopify-feed");
    vi.stubEnv("RETAIL_SHOPIFY_STORE", "www.example.com");
    expect((await serverLive()).find((s: { service: string }) => s.service === "product_matching")).toMatchObject({ provider: "shopify-feed", billable: false, testOnly: true });
    vi.stubEnv("RETAIL_SHOPIFY_FOR", "everyone");
    expect((await serverLive()).find((s: { service: string }) => s.service === "product_matching").testOnly).toBeUndefined();
  });

  it("files the store's pieces by kind and leaves out what Praxis doesn't style", () => {
    expect(STORE_PRODUCTS.map((p) => feed.slotOf(p))).toEqual(["top", "top", "bottom", "shoes", "top", null]);
  });

  it("matches each piece to the same kind and colour, in stock first, with real sizes and a link", async () => {
    vi.stubEnv("RETAIL_SHOPIFY_STORE", "https://www.example.com/");
    const out = await feed.run(
      { service: "product_matching", payload: { garments: [{ garmentId: "g1", slot: "top", name: "Navy merino knit" }, { garmentId: "g2", slot: "shoes", name: "Brown suede boots" }, { garmentId: "g3", slot: "extras", name: "Leather belt" }], budget: "ELEVATED", currency: "USD" } },
      { fetcher: store },
    );
    expect(out.status).toBe("partial");
    const [top, shoes, belt] = out.result.matches;
    expect(top.products[0]).toMatchObject({ retailerName: "Test Tailors", title: "The Merino Crew in Navy", price: 98, currency: "USD", priceStatus: "live", availability: "in_stock", availableSizes: ["S", "M"], sizeAvailability: { S: "out_of_stock", M: "in_stock" }, productUrl: "https://www.example.com/products/navy-merino-crew", purchase: { kind: "retailer_site", url: "https://www.example.com/products/navy-merino-crew" } });
    expect(shoes.products[0]).toMatchObject({ title: "The Ranch Boot in Brown Suede", availability: "out_of_stock" });
    expect(belt.products).toEqual([]);
    expect(store.mock.calls.every(([u]) => String(u).startsWith("https://www.example.com/"))).toBe(true);
  });

  it("reads the store once and keeps it for a while", async () => {
    vi.stubEnv("RETAIL_SHOPIFY_STORE", "www.example.com");
    const ask = () => feed.run({ service: "product_matching", payload: { garments: [{ garmentId: "g", slot: "bottom", name: "Grey trousers" }], currency: "USD" } }, { fetcher: store });
    await ask();
    const calls = store.mock.calls.length;
    await ask();
    expect(store.mock.calls.length).toBe(calls);
  });

  it("says what went wrong when the store refuses", async () => {
    vi.stubEnv("RETAIL_SHOPIFY_STORE", "www.example.com");
    const out = await feed.run({ service: "product_matching", payload: { garments: [{ garmentId: "g", slot: "top", name: "Shirt" }], currency: "USD" } }, { fetcher: async () => json(403, {}) });
    expect(out).toMatchObject({ status: "failed", error: { code: "provider_error", retryable: false } });
    expect(out.error.message).toContain("403");
  });
});

describe("the page with a store feed", () => {
  const request = () => buildStylingRequest(SCENARIO_A, { anonymousSessionId: ANON });
  const liveFeed = (testOnly: boolean) => json(200, { live: [{ service: "product_matching", provider: "shopify-feed", version: "www.example.com", billable: false, ...(testOnly ? { testOnly: true } : {}) }] });

  it("swaps in the store's pieces and adds the look up from them", () => {
    const response = mockRecommend(request());
    const look = response.outfits[0];
    const retail = look.garments.filter((g) => g.source === "retail");
    const result = {
      matches: retail.map((g, i) => ({
        garmentId: g.garmentId,
        products: [{ productId: `p${i}`, retailerId: "www.example.com", retailerName: "Test Tailors", price: 100 + i, currency: "USD" as const, priceStatus: "live" as const, availability: "in_stock" as const, purchase: { kind: "retailer_site" as const, url: "https://www.example.com/products/x" }, title: `Real piece ${i}` }],
      })),
    };
    const out = withRealPieces(response, result).outfits[0];
    expect(out.garments.filter((g) => g.source === "retail").map((g) => g.name)).toEqual(retail.map((_, i) => `Real piece ${i}`));
    expect(out.pricing).toMatchObject({ total: retail.reduce((s, _, i) => s + 100 + i, 0), status: "live" });
    expect(JSON.stringify(out)).not.toContain('"title":"Real piece');
  });

  it("refuses a piece without a real price or with a link that isn't https", () => {
    const response = mockRecommend(request());
    const g = response.outfits[0].garments.find((x) => x.source === "retail")!;
    const bad = { matches: [{ garmentId: g.garmentId, products: [{ productId: "p", retailerId: "s", retailerName: "S", price: 0, currency: "USD" as const, priceStatus: "live" as const, availability: "in_stock" as const }] }] };
    expect(withRealPieces(response, bad)).toBe(response);
    const http = { matches: [{ garmentId: g.garmentId, products: [{ productId: "p", retailerId: "s", retailerName: "S", price: 10, currency: "USD" as const, priceStatus: "live" as const, availability: "in_stock" as const, purchase: { kind: "retailer_site" as const, url: "http://insecure.example.com" } }] }] };
    const piece = withRealPieces(response, http).outfits[0].garments.find((x) => x.garmentId === g.garmentId)!;
    expect(piece.source === "retail" && piece.product.purchase).toEqual({ kind: "none", reason: "not_supported" });
  });

  it("leaves the looks alone for a browser that didn't ask for the test store", async () => {
    const response = mockRecommend(request());
    const fetcher = vi.fn(async () => liveFeed(true));
    expect(await addRealPieces(response, request(), { fetcher: fetcher as unknown as typeof fetch, wanted: () => false })).toBe(response);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("asks the store for a browser that asked, sending only the pieces' kinds and names", async () => {
    const r = request();
    const response = mockRecommend(r);
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/ai") return liveFeed(true);
      const body = JSON.parse(String(init?.body));
      expect(Object.keys(body.payload.garments[0]).sort()).toEqual(["garmentId", "name", "slot"]);
      expect(JSON.stringify(body.payload)).not.toContain(ANON);
      return json(200, { status: "succeeded", result: { matches: [] } });
    });
    await addRealPieces(response, r, { fetcher: fetcher as unknown as typeof fetch, wanted: () => true });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
