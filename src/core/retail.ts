/**
 * Product matching: after a recommendation is validated, each retail piece is looked up with the
 * retailer that sells it, for sizes, stock, price freshness and how it can be bought. Today the only
 * retailer adapter is a mock for the invented sample houses: it lists sizes, reports stock as unknown
 * and says the pieces cannot be bought. A real retailer feed replaces it behind the same interface.
 */
import type { Availability, ProductRef, PurchaseRoute, Slot, StylingResponse } from "./contracts";

/** What a retailer says about one product, right now. Fields left out keep what the recommendation said. */
export interface RetailerProductInfo {
  productId: string;
  category?: string;
  price?: number;
  priceStatus?: ProductRef["priceStatus"];
  availability?: Availability;
  availableSizes?: string[];
  sizeAvailability?: Record<string, Availability>;
  productUrl?: string;
  purchase?: PurchaseRoute;
  deliveryEstimate?: string;
  lastUpdatedAt?: string;
}

export interface RetailerAdapter {
  readonly id: string;
  /** Looks products up; products it does not know are simply left out of the answer. */
  lookup(products: readonly ProductRef[], options?: { signal?: AbortSignal }): Promise<RetailerProductInfo[]>;
}

const SIZES: Record<Slot, string[]> = {
  top: ["S", "M", "L", "XL"],
  bottom: ["30", "32", "34", "36"],
  shoes: ["40", "41", "42", "43", "44", "45"],
  extras: ["One size"],
};

const CATEGORY: Record<Slot, string> = { top: "Tops", bottom: "Trousers", shoes: "Shoes", extras: "Accessories" };

/** The slot a sample product id was made for: sample_<outfit>_<slot>. */
function slotOf(productId: string): Slot | null {
  const slot = productId.split("_").pop();
  return slot === "top" || slot === "bottom" || slot === "shoes" || slot === "extras" ? slot : null;
}

/**
 * The sample houses do not exist, so nothing about stock is known and nothing can be bought.
 * `outOfStock` lets the test mode mark products as sold out.
 */
export function createMockRetailer(outOfStock: (productId: string) => boolean = () => false): RetailerAdapter {
  return {
    id: "mock-retailer",
    async lookup(products) {
      return products.flatMap((p) => {
        const slot = slotOf(p.productId);
        if (!slot) return [];
        const sold = outOfStock(p.productId);
        return [
          {
            productId: p.productId,
            category: CATEGORY[slot],
            availability: sold ? "out_of_stock" : "unknown",
            availableSizes: SIZES[slot],
            sizeAvailability: sold ? Object.fromEntries(SIZES[slot].map((s) => [s, "out_of_stock" as const])) : undefined,
            purchase: { kind: "none", reason: "example_product" },
          },
        ];
      });
    },
  };
}

/** Folds the retailer's answer into the response. A failed lookup leaves the pieces as they were. */
export async function matchProducts(response: StylingResponse, retailer: RetailerAdapter, options: { signal?: AbortSignal } = {}): Promise<StylingResponse> {
  const products = response.outfits.flatMap((o) => o.garments.flatMap((g) => (g.source === "retail" ? [g.product] : [])));
  if (!products.length) return response;
  let info: RetailerProductInfo[];
  try {
    info = await retailer.lookup(products, options);
  } catch {
    return response;
  }
  const byId = new Map(info.map((i) => [i.productId, i]));
  return {
    ...response,
    outfits: response.outfits.map((o) => ({
      ...o,
      garments: o.garments.map((g) => {
        if (g.source !== "retail") return g;
        const i = byId.get(g.product.productId);
        return i ? { ...g, product: mergeProduct(g.product, i) } : g;
      }),
    })),
  };
}

function mergeProduct(p: ProductRef, i: RetailerProductInfo): ProductRef {
  const merged: ProductRef = { ...p };
  if (i.category) merged.category = i.category;
  // A price only replaces the recommendation's when the retailer says how sure it is.
  if (typeof i.price === "number" && i.price >= 0 && i.priceStatus) {
    merged.price = i.price;
    merged.priceStatus = i.priceStatus;
  }
  if (i.availability) merged.availability = i.availability;
  if (i.availableSizes?.length) merged.availableSizes = [...i.availableSizes];
  if (i.sizeAvailability) merged.sizeAvailability = { ...i.sizeAvailability };
  if (i.productUrl) merged.productUrl = i.productUrl;
  if (i.purchase) merged.purchase = i.purchase;
  if (i.deliveryEstimate) merged.deliveryEstimate = i.deliveryEstimate;
  if (i.lastUpdatedAt) merged.lastUpdatedAt = i.lastUpdatedAt;
  return merged;
}

/** Stock for one size: the size's own figure; a size the feed left out is unknown. Without sizes, the product's. */
export function stockFor(p: Pick<ProductRef, "availability" | "sizeAvailability">, size?: string): Availability {
  if (size && p.sizeAvailability) return p.sizeAvailability[size] ?? "unknown";
  return p.availability;
}

/** Whether a piece can be bought from here at all. */
export function canPurchase(p: Pick<ProductRef, "purchase" | "availability">): boolean {
  return Boolean(p.purchase && p.purchase.kind !== "none" && p.availability !== "out_of_stock");
}
