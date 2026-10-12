/** The Shopify store feed on the server: reading, paging, filing pieces by the ontology, prices, stock, failures. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fromStoreProduct } from "../catalogue/garment";
// @ts-expect-error plain JavaScript module
import * as feed from "../../../server/providers/shopify-feed.mjs";
// @ts-expect-error plain JavaScript module
import { liveServices as serverLive, providerName } from "../../../server/ai.mjs";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const variant = (id: number, size: string, price: string, available: boolean) => ({ id, option1: size, title: size, price, available });
const STORE_PRODUCTS = [
  { id: 1, handle: "navy-merino-crew", title: "The Merino Crew in Navy", vendor: "Test Tailors", product_type: "Sweaters", tags: ["Knitwear", "Slim"], body_html: "<p>Fine merino wool.</p>", options: [{ name: "Size" }], variants: [variant(11, "S", "98.00", false), variant(12, "M", "98.00", true)], images: [{ src: "https://cdn.example.com/navy.jpg", alt: "Crew", width: 1200, height: 1500 }] },
  { id: 2, handle: "black-crew", title: "The Merino Crew in Black", product_type: "Sweaters", tags: [], options: [{ name: "Size" }], variants: [variant(21, "M", "98.00", true)], images: [] },
  { id: 3, handle: "grey-chino", title: "The Democratic Chino in Grey", product_type: "Pants", tags: [], options: [{ name: "Size" }], variants: [variant(31, "32", "128.00", true)], images: [] },
  { id: 4, handle: "suede-boot", title: "The Ranch Boot in Brown Suede", product_type: "Footwear", tags: ["boots"], options: [{ name: "Size" }], variants: [variant(41, "10", "298.00", false)], images: [] },
  { id: 6, handle: "jack-oxford", title: "The Jack in Marsh Check Oxford", product_type: "", tags: [], options: [{ name: "Size" }, { name: "Color" }], variants: [{ ...variant(61, "M", "128.00", true), option2: "Olive" }], images: [] },
  { id: 7, handle: "navy-blazer", title: "The Sport Coat in Navy Hopsack", product_type: "Outerwear", tags: [], options: [{ name: "Size" }], variants: [variant(71, "40", "448.00", true)], images: [] },
  { id: 5, handle: "gift-card", title: "Gift Card", product_type: "Gift Card", tags: [], options: [], variants: [variant(51, "Default Title", "50.00", true)], images: [] },
];
const store = vi.fn(async (url: string) => (url.includes("/products.json") ? json(200, { products: url.includes("page=1") ? STORE_PRODUCTS : [] }) : json(200, { name: "Test Tailors" })));

afterEach(() => {
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

  it("files the store's pieces by the shared ontology and leaves out what Praxis doesn't style", () => {
    expect(STORE_PRODUCTS.map((p) => feed.slotOf(p))).toEqual(["top", "top", "bottom", "shoes", "top", "top", null]);
    expect(feed.attributesOf(STORE_PRODUCTS[0])).toMatchObject({ subcategory: "knit", slot: "top", layer: "base", formality: 3, colour: "navy", material: "merino", fit: "slim", brand: "Test Tailors", variantId: "12" });
    expect(feed.attributesOf(STORE_PRODUCTS[4])).toMatchObject({ subcategory: "shirt", layer: "base", colour: "green" });
    expect(feed.attributesOf(STORE_PRODUCTS[5])).toMatchObject({ subcategory: "blazer", layer: "outer", formality: 4, colour: "navy" });
  });

  it("reads every page until a short one", async () => {
    vi.stubEnv("RETAIL_SHOPIFY_STORE", "www.example.com");
    const many = Array.from({ length: 250 }, (_, i) => ({ ...STORE_PRODUCTS[1], id: 1000 + i, handle: `crew-${i}` }));
    const paged = vi.fn(async (url: string) => (url.includes("/products.json") ? json(200, { products: url.includes("page=1") ? many : url.includes("page=2") ? STORE_PRODUCTS : [] }) : json(200, { name: "Paged" })));
    const out = await feed.run({ service: "product_matching", payload: { garments: [{ garmentId: "g", slot: "top", layer: "outer", subcategory: "blazer", name: "Navy blazer" }], currency: "USD" } }, { fetcher: paged });
    expect(paged.mock.calls.filter(([u]) => String(u).includes("products.json")).map(([u]) => /page=(\d)/.exec(String(u))?.[1])).toEqual(["1", "2"]);
    expect(out.metadata.catalogue).toBe(256);
    expect(out.result.matches[0].products[0].title).toBe("The Sport Coat in Navy Hopsack");
  });

  it("gives up to four candidates of the same kind per part, in stock first, with the store's own ids, prices, sizes and link", async () => {
    vi.stubEnv("RETAIL_SHOPIFY_STORE", "https://www.example.com/");
    const out = await feed.run(
      {
        service: "product_matching",
        payload: {
          garments: [
            { garmentId: "g1", slot: "top", layer: "base", subcategory: "knit", colour: "navy", formality: 3, name: "Navy merino crew neck" },
            { garmentId: "g2", slot: "shoes", subcategory: "boots", formality: 3, name: "Brown suede boots" },
            { garmentId: "g3", slot: "extras", subcategory: "belt", name: "Leather belt" },
          ],
          budget: "ELEVATED",
          currency: "USD",
        },
      },
      { fetcher: store },
    );
    expect(out.status).toBe("partial");
    const [top, shoes, belt] = out.result.matches;
    expect(top.products.map((p: { title: string }) => p.title)).toEqual(["The Merino Crew in Navy", "The Merino Crew in Black"]);
    expect(top.products[0]).toMatchObject({ productId: "shopify_www.example.com_1", retailerName: "Test Tailors", price: 98, currency: "USD", priceStatus: "live", availability: "in_stock", availableSizes: ["S", "M"], sizeAvailability: { S: "out_of_stock", M: "in_stock" }, productUrl: "https://www.example.com/products/navy-merino-crew", purchase: { kind: "retailer_site", url: "https://www.example.com/products/navy-merino-crew" } });
    expect(top.products[0].photos[0]).toMatchObject({ src: "https://cdn.example.com/navy.jpg", width: 1200, height: 1500 });
    expect(shoes.products[0]).toMatchObject({ title: "The Ranch Boot in Brown Suede", availability: "out_of_stock" });
    expect(belt.products).toEqual([]);
    expect(store.mock.calls.every(([u]) => String(u).startsWith("https://www.example.com/"))).toBe(true);
  });

  it("never offers a piece of another kind, even when the words match", async () => {
    vi.stubEnv("RETAIL_SHOPIFY_STORE", "www.example.com");
    const out = await feed.run({ service: "product_matching", payload: { garments: [{ garmentId: "g", slot: "top", layer: "outer", subcategory: "overshirt", name: "Navy merino overshirt" }], currency: "USD" } }, { fetcher: store });
    expect(out.result.matches[0].products).toEqual([]);
  });

  it("reads the store once and keeps it for a while", async () => {
    vi.stubEnv("RETAIL_SHOPIFY_STORE", "www.example.com");
    const ask = () => feed.run({ service: "product_matching", payload: { garments: [{ garmentId: "g", slot: "bottom", name: "Grey trousers" }], currency: "USD" } }, { fetcher: store });
    await ask();
    const calls = store.mock.calls.length;
    await ask();
    expect(store.mock.calls.length).toBe(calls);
  });

  it("says what went wrong when the store refuses or breaks", async () => {
    vi.stubEnv("RETAIL_SHOPIFY_STORE", "www.example.com");
    const ask = (fetcher: () => Promise<Response>) => feed.run({ service: "product_matching", payload: { garments: [{ garmentId: "g", slot: "top", name: "Shirt" }], currency: "USD" } }, { fetcher });
    const refused = await ask(async () => json(403, {}));
    expect(refused).toMatchObject({ status: "failed", error: { code: "provider_error", retryable: false } });
    expect(refused.error.message).toContain("403");
    feed.resetCatalogue();
    expect(await ask(async () => json(503, {}))).toMatchObject({ status: "failed", error: { retryable: true } });
    feed.resetCatalogue();
    expect(await ask(async () => new Response("not json", { status: 200 }))).toMatchObject({ status: "failed" });
  });

  it("keeps a piece with missing fields as far as it goes, and the page refuses one without a real price", () => {
    const bare = { id: 9, handle: "plain-tee", title: "Plain Tee", variants: [{ id: 91, title: "Default Title", price: "0.00", available: true }] };
    const product = feed.toProduct(bare, "www.example.com", "Test Tailors", "2026-10-12T00:00:00.000Z");
    expect(product).toMatchObject({ price: 0, availability: "in_stock", attributes: { subcategory: "t-shirt" } });
    expect(product.availableSizes).toBeUndefined();
    expect(product.imageUrl).toBeUndefined();
    expect(fromStoreProduct(product)).toBeNull();
    const priced = feed.toProduct({ ...bare, variants: [{ id: 92, title: "Default Title", price: "35.00", available: false }] }, "www.example.com", "Test Tailors", "2026-10-12T00:00:00.000Z");
    expect(fromStoreProduct(priced)).toMatchObject({ source: "shopify", subcategory: "t-shirt", availability: "out_of_stock", formality: 1, product: { price: 35, priceStatus: "live" } });
  });
});
