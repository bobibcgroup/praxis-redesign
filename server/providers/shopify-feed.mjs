/**
 * Real pieces for testing, from one menswear store's public Shopify product list (/products.json):
 * names, prices, photos and stock by size. Answers product_matching: for each piece of a look, the
 * store's closest piece of the same kind and colour, in stock first.
 *
 * Free and keyless, but not an official API: it is for private testing. Before customers see a
 * store's pieces, the store has to agree (or an affiliate feed takes over).
 *
 * RETAIL_SHOPIFY_STORE  the store's address, for example www.taylorstitch.com. Unset: off.
 * RETAIL_SHOPIFY_NAME   the name shown on its pieces (default: the store's own name).
 * RETAIL_SHOPIFY_FOR    "test" (default): only a browser that opened the site with ?stock=live uses it.
 *                       "everyone": every visitor.
 *
 * Nothing about the customer is sent to the store: the list is read whole and matched here.
 */
export const id = "shopify-feed";
export const billable = false;
export const SERVICES = ["product_matching"];

const STORE = () => (process.env.RETAIL_SHOPIFY_STORE ?? "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
export const version = STORE() || "off";
/** Stores are read over https; a store on this machine (a stand-in for tests) over plain http. */
const base = (store) => `${/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(store) ? "http" : "https"}://${store}`;
/** Whether only test browsers use it (see liveServices in server/ai.mjs). */
export const testOnly = () => (process.env.RETAIL_SHOPIFY_FOR ?? "test").trim() !== "everyone";

const PAGES = 4;
const KEEP_MS = 30 * 60 * 1000;

/** The kind of piece, from how the store files and names it. Null for anything Praxis doesn't style. */
const KINDS = [
  // "Oxford" and "derby" name shirts as often as shoes, so they count as shoes only beside "shoe".
  ["shoes", /\b(footwear|boots?|shoes?|sneakers?|trainers?|loafers?|chukkas?|sandals?|mules?|(oxford|derby) shoes?)\b/],
  ["bottom", /\b(pants?|trousers?|chinos?|jeans?|denim|shorts?|joggers?|slacks)\b/],
  ["extras", /\b(belts?|hats?|caps?|beanies?|scarf|scarves|bags?|totes?|socks?|wallets?|sunglasses|ties?)\b/],
  ["top", /\b(outerwear|oxfords?|shirts?|tees?|t-shirts?|polos?|henleys?|sweaters?|knits?|knitwear|cardigans?|crews?|crewnecks?|hoodies?|sweatshirts?|jackets?|overshirts?|blazers?|coats?|parkas?|vests?|gilets?|tops?|turtlenecks?|quarter zips?)\b/],
];
const SKIP = /\b(gift ?cards?|women'?s?|womens|kids?|sample sale|e-?gift|insurance|shipping protection)\b/;

export function slotOf(product) {
  const text = `${product.product_type ?? ""} ${product.title ?? ""} ${(Array.isArray(product.tags) ? product.tags : String(product.tags ?? "").split(",")).join(" ")}`.toLowerCase();
  if (SKIP.test(text)) return null;
  const type = String(product.product_type ?? "").toLowerCase();
  // The store's own filing decides first; the title and tags only when the type says nothing.
  for (const [slot, re] of KINDS) if (re.test(type)) return slot;
  for (const [slot, re] of KINDS) if (re.test(text)) return slot;
  return null;
}

const COLOURS = ["black", "white", "ivory", "ecru", "cream", "grey", "gray", "charcoal", "navy", "blue", "indigo", "green", "olive", "sage", "khaki", "stone", "sand", "beige", "tan", "camel", "brown", "chocolate", "rust", "burgundy", "red", "pink", "orange", "yellow", "purple", "oat", "natural", "denim"];
const SAME = { gray: "grey", cream: "ivory", ecru: "ivory", natural: "ivory", oat: "beige", sand: "beige", stone: "beige", chocolate: "brown", indigo: "navy" };
const colourWords = (text) => new Set(COLOURS.filter((c) => new RegExp(`\\b${c}\\b`).test(text)).map((c) => SAME[c] ?? c));
const words = (text) => new Set(String(text).toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2 && !COLOURS.includes(w)));

/** A store piece in Praxis's ProductRef shape. Sizes come from the variant option named Size, else the first option. */
export function toProduct(p, store, name, at) {
  const sizeIndex = Math.max(0, (p.options ?? []).findIndex((o) => /size/i.test(o?.name ?? "")));
  const key = `option${sizeIndex + 1}`;
  const sizeAvailability = {};
  for (const v of p.variants ?? []) {
    const size = String(v[key] ?? v.title ?? "").trim();
    if (!size || size === "Default Title") continue;
    sizeAvailability[size] = v.available ? "in_stock" : sizeAvailability[size] === "in_stock" ? "in_stock" : "out_of_stock";
  }
  const sizes = Object.keys(sizeAvailability);
  const anyIn = (p.variants ?? []).some((v) => v.available);
  const prices = (p.variants ?? []).map((v) => Number(v.price)).filter((n) => Number.isFinite(n) && n > 0);
  const url = `https://${store}/products/${encodeURIComponent(p.handle)}`;
  return {
    productId: `shopify_${store}_${p.id}`,
    retailerId: store,
    retailerName: name,
    category: p.product_type || undefined,
    price: prices.length ? Math.min(...prices) : 0,
    currency: "USD",
    priceStatus: "live",
    availability: anyIn ? "in_stock" : "out_of_stock",
    ...(sizes.length ? { availableSizes: sizes, sizeAvailability } : {}),
    productUrl: url,
    ...(p.images?.[0]?.src ? { imageUrl: String(p.images[0].src).replace(/^\/\//, "https://") } : {}),
    lastUpdatedAt: at,
    purchase: { kind: "retailer_site", url },
    title: p.title,
  };
}

/** How well a store piece fits a look's piece: same kind is required; colour counts most, then words, then stock. */
export function score(garment, product, slot) {
  if (slot !== garment.slot) return -1;
  const text = `${product.title} ${product.product_type ?? ""} ${(product.variants ?? []).map((v) => v.option1).join(" ")}`.toLowerCase();
  const want = colourWords(garment.name.toLowerCase());
  const have = colourWords(text);
  let s = 0;
  for (const c of want) if (have.has(c)) s += 5;
  const w = words(text);
  for (const x of words(garment.name)) if (w.has(x) || w.has(x.replace(/s$/, ""))) s += 3;
  // A sold out piece can't be bought, so stock outweighs a colour match.
  if ((product.variants ?? []).some((v) => v.available)) s += 6;
  return s;
}

let catalogue = null;
export function resetCatalogue() {
  catalogue = null;
}

async function readCatalogue(store, fetcher, signal) {
  if (catalogue && catalogue.store === store && Date.now() - catalogue.at < KEEP_MS) return catalogue;
  const products = [];
  for (let page = 1; page <= PAGES; page += 1) {
    const res = await fetcher(`${base(store)}/products.json?limit=250&page=${page}`, { signal, headers: { Accept: "application/json", "User-Agent": "Praxis/1.0 (styling test)" } });
    if (!res.ok) {
      if (page === 1) throw Object.assign(new Error(`The store answered ${res.status}.`), { status: res.status });
      break;
    }
    const batch = (await res.json())?.products;
    if (!Array.isArray(batch) || !batch.length) break;
    products.push(...batch);
    if (batch.length < 250) break;
  }
  let name = (process.env.RETAIL_SHOPIFY_NAME ?? "").trim();
  if (!name) {
    try {
      name = String((await (await fetcher(`${base(store)}/meta.json`, { signal })).json())?.name ?? "").trim();
    } catch {
      /* the address stands in */
    }
  }
  const usable = products.map((p) => ({ p, slot: slotOf(p) })).filter((x) => x.slot && x.p.handle);
  catalogue = { store, name: name || store.replace(/^www\./, ""), at: Date.now(), checkedAt: new Date().toISOString(), items: usable };
  return catalogue;
}

export async function run(request, { signal, fetcher = fetch } = {}) {
  const store = STORE();
  if (!store) return { status: "disabled", error: { code: "not_connected", message: "No store is set on the server.", retryable: false } };
  if (request?.service !== "product_matching") return { status: "disabled", error: { code: "not_connected", message: "The store feed matches pieces only.", retryable: false } };
  const garments = Array.isArray(request.payload?.garments) ? request.payload.garments.slice(0, 24) : [];
  if (!garments.length) return { status: "failed", error: { code: "validation_error", message: "No pieces to match.", retryable: false } };
  let cat;
  try {
    cat = await readCatalogue(store, fetcher, signal);
  } catch (e) {
    return { status: "failed", error: { code: "provider_error", message: String(e?.message ?? "The store could not be read."), retryable: !(e?.status >= 400 && e?.status < 500) } };
  }
  const matches = garments.map((g) => {
    const ranked = cat.items
      .map(({ p, slot }) => ({ p, s: score(g, p, slot) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 2);
    return { garmentId: String(g.garmentId), products: ranked.map(({ p }) => toProduct(p, store, cat.name, cat.checkedAt)) };
  });
  const found = matches.filter((m) => m.products.length).length;
  return {
    status: found === 0 ? "empty" : found === matches.length ? "succeeded" : "partial",
    result: { matches },
    metadata: { store, catalogue: cat.items.length },
  };
}
