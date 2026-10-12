# API contracts

Deliverable C of the spec (section 23). This document describes every request and response shape that a production integration with the Praxis front end has to produce or accept. It is written from the code in `src/core`, and every claim points at the line that makes it true.

## 1. Where these contracts live, and what does not exist yet

| Concern | Status today | Defined in |
| --- | --- | --- |
| Styling request and response shapes | Implemented, plain TypeScript | `src/core/contracts.ts` |
| Recommendation adapter | Implemented: one deterministic mock (`id: "mock"`) | `src/core/service.ts:15`, `src/core/adapters/mock.ts:288` |
| Response validation | Implemented, hand written, no schema library | `src/core/validate.ts:193` |
| Retailer product lookup | Implemented: one mock (`id: "mock-retailer"`) | `src/core/retail.ts:24`, `src/core/retail.ts:49` |
| Colour analysis, garment recognition, visualization, try-on | Interfaces implemented; every adapter is a free mock that reads nothing | `src/core/vision.ts:70` to `src/core/vision.ts:81` |
| Feedback and preferences | Implemented; stored in the browser's `localStorage` only | `src/core/feedback.ts:47` |
| HTTP transport | **Not defined.** There is no endpoint, server, base URL, auth header or wire format in the code | none |

**Transport.** Every adapter is called in process, as a TypeScript object inside the browser bundle. `RecommendationAdapter.recommend` returns a `Promise<unknown>` and the service validates it (`src/core/service.ts:56` to `src/core/service.ts:58`). No HTTP endpoint is defined yet. A production integration plugs in by implementing one of the interfaces below; if that implementation calls a remote service, the URL, method, authentication and serialisation are decisions still to be made, and the JSON shapes in this document are what such a service would need to send and receive. The objects are JSON safe (strings, numbers, booleans, arrays, plain objects; dates as ISO 8601 strings).

**Adapter selection.** `VITE_RECOMMENDATION_ADAPTER` is read at build time (`src/core/config.ts:21`). Only `"mock"` exists; any other value logs a warning and falls back to the mock (`src/core/service.ts:151` to `src/core/service.ts:153`). A production adapter is a future integration: it implements `RecommendationAdapter` and is wired into `stylingService()` in `src/core/service.ts:151`.

## 2. Versioning

```ts
// src/core/contracts.ts:13
export const CONTRACT_VERSION = "1.0";
```

* The comment at `src/core/contracts.ts:12` defines the rule: bump it when a field changes meaning or a required field is added.
* Every `StylingRequest` carries `contractVersion: CONTRACT_VERSION` (`src/core/request.ts:59`).
* A response's `contractVersion` is copied through if it is a non-empty string of at most 20 characters, otherwise it is set to the front end's own `CONTRACT_VERSION` (`src/core/validate.ts:233`).
* **No compatibility check is made.** A response that says `"2.0"` is accepted and validated against the 1.0 rules. An engine that changes shape must still satisfy the 1.0 validator, or the front end and the validator have to be updated together.
* Adapters also carry their own `id` and `version` (for example `{ id: "mock", version: "1.0.0" }`, `src/core/adapters/mock.ts:24`). These are separate from the contract version and are stamped on responses, feedback and analytics.

## 3. Request

### 3.1 StylingRequest

```ts
// src/core/contracts.ts:54
export interface StylingRequest {
  requestId: string;              // "req_" + 32 hex, new per send (src/core/request.ts:57, src/core/ids.ts:4)
  inputKey: string;               // same answers give the same key
  contractVersion: string;        // "1.0"
  journey: "style_a_moment";
  anonymousSessionId: string;     // "anon_" + 32 hex, per browser (src/core/identity.ts:28)
  userId?: string;                // only when signed in
  occasion: Occasion;
  venue: { type: string; label: string; context?: string };
  timeOfDay: TimeOfDay;
  preferredVibe: Vibe;
  budget: { band: BudgetBand; minimum?: number; maximum?: number; currency: Currency };
  styleProfileId?: string;        // "<profileId>_v<version>", such as dna_..._v3
  styleProfile?: StyleProfileSummary;
  wardrobeItems: WardrobeItemRef[];
  preferences?: PreferenceSnapshot;
  location?: { country?: string; city?: string };
  generatedAt: string;            // ISO 8601
}
```

| Field | Values | Notes |
| --- | --- | --- |
| `occasion` | `DINNER`, `WORK`, `DATE`, `WEDDING`, `PARTY` | `src/core/contracts.ts:15` |
| `venue.type` | An answer id from `VENUES[occasion]` in `src/shared/catalog.ts:34`, such as `RESTAURANT` | Free string in the type; the mock knows 17 ids (`src/core/adapters/mock.ts:29`) |
| `venue.label` | The label the customer read, such as `Restaurant` | Falls back to the id (`src/core/request.ts:63`) |
| `venue.context` | Optional free text | Declared, never set by the app today |
| `timeOfDay` | `SUNRISE`, `DAY`, `SUNSET`, `NIGHT` | `src/core/contracts.ts:16` |
| `preferredVibe` | `SAFE`, `SHARP`, `RELAXED` | Shown as Classic, Sharp, Relaxed (`src/core/contracts.ts:18`) |
| `budget.band` | `SENSIBLE`, `ELEVATED`, `OPEN` | Bounds from `BUDGET_BOUNDS` (`src/core/request.ts:25`): SENSIBLE max 300; ELEVATED 300 to 900; OPEN none |
| `budget.currency` | `USD` only | `src/core/contracts.ts:21` |
| `location` | Optional | Declared, never set by the app today |
| `generatedAt` | ISO 8601 | Time the request was built |

**inputKey.** Built by `inputKeyFor` (`src/core/request.ts:37`) as `occasion|venue|time|vibe|spend|<owned ids sorted, joined by + , or ->|<styleProfileId or ->`. Preferences are deliberately left out. The key ties a response to the exact inputs it answered and is checked by the validator (section 6.1).

**Who builds it.** `buildStylingRequest` (`src/core/request.ts:53`), called from `requestFor` in `src/a/lib/styling.ts:43`, which adds the style profile summary and the preference snapshot from the feedback store.

### 3.2 WardrobeItemRef

```ts
// src/core/contracts.ts:26
export interface WardrobeItemRef {
  wardrobeItemId: string;   // "wardrobe_<slot>_<hash>", stable for the same piece (src/core/request.ts:32)
  slot: Slot;               // "top" | "bottom" | "shoes" | "extras"
  label: string;            // what the customer called it
  source: "sample" | "upload";
}
```

The photo is never sent. For an uploaded piece the id includes a hash of the image data so the same photo gives the same id (`src/a/lib/styling.ts:36`). The app sends at most one owned piece per request today.

### 3.3 StyleProfileSummary

```ts
// src/core/contracts.ts:43
export interface StyleProfileSummary {
  undertone?: { value: "cool" | "warm" | "neutral"; basis: AttributeBasis };
  contrast?: { value: "high" | "medium" | "low"; basis: AttributeBasis };
  fit?: { value: "SLIM" | "REGULAR" | "RELAXED"; basis: AttributeBasis };
  week?: { value: "OFFICE" | "SOCIAL" | "CASUAL" | "MIXED"; basis: AttributeBasis };
  tastes: string[];
}
export type AttributeBasis = "inferred" | "confirmed" | "corrected";  // src/core/contracts.ts:52
```

Produced by `summarize` (`src/core/styleProfile.ts:139`). A corrected value wins over a confirmed one, which wins over an inferred one. A field with no value is omitted. No photo or body measurement is ever included. An engine should treat `inferred` values as estimates; today they come only from the sample colour analysis (section 5.2), so they are not readings of the customer.

### 3.4 PreferenceSnapshot

```ts
// src/core/contracts.ts:35
export interface PreferenceSnapshot {
  likedOutfitIds: string[];
  rejectedOutfitIds: string[];
  reasonCounts: Partial<Record<FeedbackReason, number>>;
  dislikedGarmentIds: string[];
}
```

Built by `preferenceSnapshot` (`src/core/feedback.ts:87`): the newest feedback on each look decides whether it is liked or rejected; reasons and named garments are counted across every "not for me" record. Signed in, only that account's records count; as a guest, only this browser's records with no account. It is sent with every request. **The mock adapter ignores it**, and nothing in the app claims that it learns.

## 4. Response

### 4.1 StylingResponse

```ts
// src/core/contracts.ts:209
export interface StylingResponse {
  recommendationId: string;
  requestId: string;
  inputKey: string;
  contractVersion: string;
  adapter: { id: string; version: string };
  mode: "demonstration" | "personalized";
  status: "completed" | "partial" | "empty" | "failed";
  outfits: OutfitRecommendation[];
  fallback?: { code: string; message: string };   // why fewer looks came back
  error?: { code: string; message: string; retryable: boolean };
  createdAt: string;
}
```

| Field | Meaning |
| --- | --- |
| `recommendationId` | Engine's id for this answer. Max 120 chars. The mock uses `rec_` plus the request id's hex (`src/core/adapters/mock.ts:276`) |
| `requestId`, `inputKey` | Must echo the request exactly, or the whole response is rejected |
| `adapter` | Overwritten by the service with the adapter's own `id` and `version` (`src/core/validate.ts:234`) |
| `mode` | `demonstration`: looks from a fixed sample set. `personalized`: built for this customer by a real engine. Forced to `demonstration` when the adapter id is `mock` |
| `status` | Recomputed by the validator (section 6.3) |
| `fallback` | Optional explanation of a short answer |
| `error` | Present only when `status` is `failed` |

### 4.2 OutfitRecommendation

```ts
// src/core/contracts.ts:188
export interface OutfitRecommendation {
  outfitId: string;            // max 120 chars, unique within the response
  rank: number;                // 1 is the pick
  role: "classic" | "sharper" | "relaxed";
  title: string;               // max 120
  rationale: string;           // max 400, why the pieces work together
  explanation: RecommendationExplanation;
  garments: Garment[];
  visualization: Visualization;
  pricing: { total: number; currency: "USD"; status: PriceStatus };
}
```

`pricing` is always recomputed by the validator (section 6.2), so an engine may send anything there.

### 4.3 Garments

```ts
// src/core/contracts.ts:131 to 147
interface GarmentBase { garmentId: string; slot: Slot; name: string }
export interface RetailGarment extends GarmentBase { source: "retail"; product: ProductRef }
export interface WardrobeGarment extends GarmentBase { source: "wardrobe"; wardrobeItemId: string }
export type Garment = RetailGarment | WardrobeGarment;
```

Three kinds of data stay separate on purpose (`src/core/contracts.ts:7`): a retail product (can be bought), a wardrobe item (already owned, costs nothing), and a visualization (a picture, proof of nothing). A wardrobe garment must reference a `wardrobeItemId`; the mock reuses the request's `WardrobeItemRef.wardrobeItemId` and the customer's label (`src/core/adapters/mock.ts:141`).

### 4.4 ProductRef (RetailProduct)

```ts
// src/core/contracts.ts:104; RetailProduct is an alias (src/core/contracts.ts:129)
export interface ProductRef {
  productId: string;
  retailerId: string;
  retailerName: string;
  category?: string;
  price: number;
  currency: "USD";
  priceStatus: "example" | "estimated" | "live";
  availability: "in_stock" | "out_of_stock" | "unknown";
  availableSizes?: string[];
  sizeAvailability?: Record<string, Availability>;
  productUrl?: string;
  imageUrl?: string;
  lastUpdatedAt?: string;
  purchase?: PurchaseRoute;
  deliveryEstimate?: string;
}
```

| Field | Rule |
| --- | --- |
| `priceStatus` | `example` is an illustration, `estimated` is approximate, `live` comes from a retailer feed. The mock always sends `example` |
| `availability` | `unknown` unless a feed says otherwise. The screen says "In stock" only when availability is `in_stock` **and** `priceStatus` is `live` (`src/a/ui/PiecesSheet.tsx:31` to `src/a/ui/PiecesSheet.tsx:36`) |
| `sizeAvailability` | Per size stock; a size missing from the map is `unknown` (`stockFor`, `src/core/retail.ts:115`) |
| `deliveryEstimate` | Only when the retailer supplies it, such as `"2 to 4 days"` |

### 4.5 PurchaseRoute

```ts
// src/core/contracts.ts:98
export type PurchaseRoute =
  | { kind: "retailer_site" | "affiliate"; url: string }
  | { kind: "retailer_integration" | "native"; integrationId: string }
  | { kind: "none"; reason: "example_product" | "not_supported" };
```

| Kind | What the app does today |
| --- | --- |
| `retailer_site`, `affiliate` | "Buy at" opens `url` in a new tab with `noopener,noreferrer` and fires `retailer_redirected` (`src/a/ui/PiecesSheet.tsx:52` to `src/a/ui/PiecesSheet.tsx:57`) |
| `retailer_integration`, `native` | Accepted by the validator and counted by `canPurchase` (`src/core/retail.ts:121`), but **no screen acts on them yet**. A future retailer integration or Praxis checkout plugs in here, keyed by `integrationId` |
| `none` | Cannot be bought from here; the mock retailer sends `{ kind: "none", reason: "example_product" }` for every sample piece |

### 4.6 Visualization

```ts
// src/core/contracts.ts:152
export interface Visualization {
  imageId: string;
  outfitId: string;
  kind: "product_photo" | "styled_visualization" | "try_on";
  url: string;
  provider: string;                       // "praxis-library" for the curated photographs
  fidelity: "exact" | "representative";   // "exact" only when it shows these very garments
  sourceGarmentIds: string[];
  status: "ready" | "pending" | "failed" | "unavailable";
  width?: number;
  height?: number;
  createdAt?: string;
}
```

A picture shows a styling. It is never proof of stock, exact colour or fit (`src/core/contracts.ts:151`). The mock always returns the library photograph for the look, `fidelity: "representative"`, 1024 by 1024 (`src/core/adapters/mock.ts:259`).

### 4.7 Explanations and factors

```ts
// src/core/contracts.ts:168 to 184
export type FactorKind = "occasion" | "venue" | "time" | "style" | "budget" | "body" | "colour" | "wardrobe" | "weather";
export interface RecommendationFactor {
  factor: FactorKind;
  value: string;        // the input as the customer gave it, max 120
  influence?: string;   // what it did to this look, max 200
}
export interface RecommendationExplanation {
  summary: string;      // one sentence, max 400
  contributingFactors: RecommendationFactor[];
  source: "mock_rules" | "model";
}
```

The mock emits `occasion`, `venue`, `time`, `style`, `budget`, and one `wardrobe` factor per owned piece (`src/core/adapters/mock.ts:218` to `src/core/adapters/mock.ts:237`). `body`, `colour` and `weather` are accepted for a future engine. The screens read `summary` and `contributingFactors` (`src/a/lib/looks.ts:25`).

## 5. Adapter interfaces

### 5.1 RecommendationAdapter and StylingService

```ts
// src/core/service.ts:15
export interface RecommendationAdapter {
  readonly id: string;
  readonly version: string;
  /** Returns the raw answer; the service validates it, so an adapter can never break a screen. */
  recommend(request: StylingRequest, options: { signal?: AbortSignal }): Promise<unknown>;
}

// src/core/service.ts:22
export interface StylingService {
  readonly adapter: { id: string; version: string };
  recommend(request: StylingRequest, options?: { signal?: AbortSignal }): Promise<StylingResponse>;
}
```

`createStylingService` (`src/core/service.ts:38`) runs, in order: the adapter call with a timeout and the caller's abort signal; `validateStylingResponse`; `matchProducts` with the retailer adapter (only for `completed` or `partial`); then records the pair in the request history (`localStorage` key `praxis_styling_history`, newest 20, cancelled requests not kept; `src/core/service.ts:71`, `src/core/service.ts:119`). The service never throws: every outcome is a `StylingResponse`.

An adapter should honour `options.signal` (stop work when aborted). It may throw; a throw becomes `adapter_error` (section 7).

### 5.2 RetailerAdapter and RetailerProductInfo

```ts
// src/core/retail.ts:10
export interface RetailerProductInfo {
  productId: string;
  category?: string;
  price?: number;
  priceStatus?: "example" | "estimated" | "live";
  availability?: Availability;
  availableSizes?: string[];
  sizeAvailability?: Record<string, Availability>;
  productUrl?: string;
  purchase?: PurchaseRoute;
  deliveryEstimate?: string;
  lastUpdatedAt?: string;
}

// src/core/retail.ts:24
export interface RetailerAdapter {
  readonly id: string;
  /** Looks products up; products it does not know are simply left out of the answer. */
  lookup(products: readonly ProductRef[], options?: { signal?: AbortSignal }): Promise<RetailerProductInfo[]>;
}
```

Merge rules (`mergeProduct`, `src/core/retail.ts:96`):

* A field the retailer leaves out keeps what the recommendation said.
* A `price` replaces the recommendation's only when it is a number of 0 or more **and** `priceStatus` is given (`src/core/retail.ts:100`).
* Matching is by `productId`. Unknown products are skipped.
* If `lookup` throws, the response is returned unchanged (`src/core/retail.ts:79` to `src/core/retail.ts:81`).

**Links from a feed.** `mergeProduct` (`src/core/retail.ts`) runs a retailer's `purchase` through the same `purchaseRoute` check the validator uses (`src/core/validate.ts`), and keeps a `productUrl` only when it is `https`. A route that fails the check is dropped, so the piece shows no buy button. Other retailer fields (availability, sizes, delivery, price with its status) are merged as given and must follow the enums above.

The only implementation is `createMockRetailer` (`src/core/retail.ts:49`): for ids whose last `_` segment is a slot (the mock's `sample_<outfit>_<slot>`) it returns a category, a fixed size list, `availability: "unknown"` (or `out_of_stock` in test mode), and `purchase: { kind: "none", reason: "example_product" }`. A live retailer feed is a future integration behind this interface, passed as `ServiceOptions.retailer` (`src/core/service.ts:27`).

### 5.3 Image services (vision.ts)

All four are future integrations. Each adapter declares whether a call costs money:

```ts
// src/core/vision.ts:63
interface Adapter { readonly id: string; readonly version: string; readonly billable: boolean }
```

Every call goes through `imageServices()` (`src/core/vision.ts:165`), which runs `guardBillable` (`src/core/vision.ts:157`) first. When `billable` is true and `VITE_ALLOW_BILLABLE_IMAGES` is not `"true"` (`src/core/config.ts:27`), no request is made and the call returns `status: "disabled"` (or a `GeneratedImage` with `status: "disabled"`). Today every adapter has `billable: false` and reads nothing.

**Input shared by the photo based services**

```ts
// src/core/vision.ts:15
export interface ImageInput {
  ref: string;              // a data URL or object URL in this tab; a storage reference once uploads exist
  category: "face_colour" | "body_fit" | "wardrobe_garment" | "try_on";
  width: number;
  height: number;
  consentVersion: string;   // must match IMAGE_POLICIES[category].consentVersion
}

// src/core/vision.ts:25
export interface Inferred<T> { value: T; source: "sample" | "model"; adapter: string }
```

| Service | Interface | Input | Output | Mock today |
| --- | --- | --- | --- | --- |
| Colour analysis | `ColourAnalysisAdapter.analyse` (`src/core/vision.ts:70`) | `ImageInput` with `category: "face_colour"` | `ColourAnalysis` | `mock-colour`: always `cool` / `high`, `source: "sample"` (`src/core/vision.ts:86`) |
| Garment recognition | `GarmentRecognitionAdapter.recognise` (`src/core/vision.ts:73`) | `ImageInput` | `GarmentAnalysis` | `mock-garment`: `{ status: "completed" }` with no fields; the customer names the piece (`src/core/vision.ts:104`) |
| Outfit visualization | `OutfitVisualizationAdapter.visualize` (`src/core/vision.ts:76`) | `{ outfitId, garmentIds }` | `GeneratedImage` | `mock-visualization`: `status: "disabled"`, nothing generated (`src/core/vision.ts:129`) |
| Virtual try-on | `TryOnAdapter.tryOn` (`src/core/vision.ts`), called only through `runTryOn` (`src/core/tryon.ts`) | `TryOnRequest` (no photo) plus `{ requestId, outfitId, garmentIds, person: ImageInput }` | `GeneratedImage`, read into a `TryOnOutcome` | `mock-try-on`: `status: "disabled"` after 1.2 s, never a picture; `http-try-on`: posts to `POST /api/tryon` (docs/TRY-ON.md) |

```ts
// src/core/vision.ts:32
export interface ColourAnalysis {
  status: "completed" | "unreadable" | "failed" | "disabled";
  problem?: ImageProblem;   // "not_an_image" | "unsupported_type" | "too_large" | "too_small" | "too_dark" | "too_bright" | "unreadable"
  undertone?: Inferred<"cool" | "warm" | "neutral">;
  contrast?: Inferred<"high" | "medium" | "low">;
}

// src/core/vision.ts:39
export interface GarmentAnalysis {
  status: "completed" | "unreadable" | "failed" | "disabled";
  slot?: Inferred<Slot>;
  colour?: Inferred<string>;
  category?: Inferred<string>;
}

// src/core/vision.ts:47
export interface GeneratedImage {
  imageId: string;
  outfitId: string;
  kind: "styled_visualization" | "try_on";
  sourceGarmentIds: string[];
  provider: string;
  modelVersion: string;      // "none" when nothing was generated
  status: "ready" | "pending" | "failed" | "disabled";
  width?: number;
  height?: number;
  storageRef?: string;       // a URL or a storage key
  createdAt: string;
  retention: { deleteAfter?: string; deletable: boolean };
}
```

Extra gates in `imageServices()`:

* `analyseColour` returns `failed` without calling the adapter when `consentVersion` does not match the current face policy (`src/core/vision.ts:180`).
* `tryOn` refuses a photo without the current try-on consent (`error.code: "consent_missing"`) and any billable adapter while paid image calls are off; see docs/TRY-ON.md for the outcomes.

Notes for the integrator:

* Only `analyseColour` is called by a screen today (`src/a/screens/dna/DnaResult.tsx:49`). Its result feeds `applyAnalysis` (`src/core/styleProfile.ts:78`), which stores values as `inferred` with their `source` and `adapter`.
* Image service outputs are **not** validated the way styling responses are. A real adapter must return the enum values above.
* There is no code yet that turns a `GeneratedImage` into an outfit's `Visualization`. When generation exists, the mapping (for example `storageRef` to `url`, `disabled` to `unavailable`, and `fidelity`) has to be written; until then looks use the library photographs.

## 6. Validation rules applied to every recommendation response

`validateStylingResponse(raw, request, adapter)` in `src/core/validate.ts:193` runs on whatever the adapter returns. It never throws. Strings are "valid" only when non-empty after trimming and within a length limit (`isStr`, `src/core/validate.ts:42`).

### 6.1 Whole response rejected (becomes `failed`)

| Condition | Error code | Retryable | Line |
| --- | --- | --- | --- |
| Not a plain object | `malformed_response` | yes | `src/core/validate.ts:195` |
| `requestId` or `inputKey` differ from the request | `mismatched_response` | yes | `src/core/validate.ts:196` |
| `recommendationId` missing or over 120 chars, `status` not one of the four, or `outfits` not an array | `malformed_response` | yes | `src/core/validate.ts:199` |
| `status: "failed"` sent by the adapter | `error.code` (max 80) or `service_failed`; `error.message` (max 300) or a default | unless `error.retryable === false` | `src/core/validate.ts:203` |

### 6.2 One look dropped (rest kept)

A look is dropped whole when any of these fail (`outfit`, `src/core/validate.ts:140`):

* `outfitId` (max 120), numeric `rank`, `role` in the enum, `title` (max 120), `rationale` (max 400).
* `explanation` is an object with `summary` (max 400).
* `garments` is a non-empty array and **every** garment is valid; one bad garment drops the look, so a picture never pairs with the wrong pieces (`src/core/validate.ts:145`).
* `garmentId` values are unique within the look (`src/core/validate.ts:147`).
* `visualization` is valid (below).
* Its `outfitId` was not already used by an earlier look in the response (`src/core/validate.ts:216`).

A garment is valid when (`src/core/validate.ts:67`):

* `garmentId` (max 200), `slot` in the enum, `name` (max 200).
* `source: "wardrobe"` with a `wardrobeItemId` (max 200), or
* `source: "retail"` with `product.productId` (max 200), `retailerId` (max 200), `retailerName` (max 120), `price` a finite number of 0 or more, `currency` exactly `"USD"`, and `priceStatus` in the enum.

A visualization is valid when `imageId` (max 200), `kind` in the enum, `provider` (max 120) and a safe `url` are present (`src/core/validate.ts:120`).

### 6.3 Fields normalised rather than rejected

| Field | Rule | Line |
| --- | --- | --- |
| `product.availability` | Anything not in the enum becomes `unknown`, never assumed in stock | `src/core/validate.ts:86` |
| `productUrl`, `imageUrl` | Kept only if safe (6.4); otherwise dropped | `src/core/validate.ts:87` |
| `availableSizes` | Strings up to 20 chars, first 30 kept; empty list dropped | `src/core/validate.ts:99` |
| `sizeAvailability` | Entries with key up to 20 chars and a valid value, first 30 | `src/core/validate.ts:105` |
| `purchase` | Kept only if it matches a valid route (6.4); otherwise dropped | `src/core/validate.ts:112` |
| `lastUpdatedAt` (40), `category` (60), `deliveryEstimate` (60) | Kept if valid strings, otherwise dropped | `src/core/validate.ts:89` |
| `explanation.contributingFactors` | Unknown `factor`, or `value` missing or over 120, drops that factor only; `influence` over 200 is dropped | `src/core/validate.ts:59` |
| `explanation.source` | Anything but `"model"` becomes `mock_rules` | `src/core/validate.ts:159` |
| `visualization.outfitId` | Overwritten with the look's `outfitId` | `src/core/validate.ts:126` |
| `visualization.fidelity` | Anything but `"exact"` becomes `representative` | `src/core/validate.ts:131` |
| `visualization.status` | Missing or unknown becomes `ready` | `src/core/validate.ts:133` |
| `pricing.total` | Recomputed as the sum of retail piece prices; wardrobe pieces add 0 | `src/core/validate.ts:164` |
| `pricing.status` | The least certain retail price wins: any `example` (or no retail pieces) gives `example`, else any `estimated` gives `estimated`, else `live` | `src/core/validate.ts:167` |
| `rank` | Looks sorted by `rank`, then renumbered 1, 2, 3 | `src/core/validate.ts:222` |
| `mode` | `personalized` only if sent and the adapter id is not `mock`; otherwise `demonstration` | `src/core/validate.ts:236` |
| `adapter` | Replaced by the service's adapter metadata | `src/core/validate.ts:234` |
| `createdAt` | Kept if a string up to 40 chars, else now | `src/core/validate.ts:240` |

### 6.4 URL rules

`safeUrl` (`src/core/validate.ts:48`) accepts, for anything that reaches an `img src` or a link:

* an app relative path that starts with `/` but not `//`, such as `/images/dinner_sharper_01.jpg`;
* an absolute `http:` or `https:` URL (max 2048 chars), returned in normalised form.

Everything else (`javascript:`, `data:`, protocol relative `//host`, unparseable strings) is dropped.

`PurchaseRoute` is stricter (`src/core/validate.ts:112`): `retailer_site` and `affiliate` need an absolute `https://` URL, so `http` and relative links are rejected; `retailer_integration` and `native` need an `integrationId` (max 80); `none` keeps `reason: "not_supported"` and turns any other reason into `example_product`. A route that matches none of these is dropped.

### 6.5 Final status

```ts
// src/core/validate.ts:225
const status = outfits.length === 0 ? "empty"
  : outfits.length < EXPECTED_OUTFITS || claimed === "partial" ? "partial"
  : "completed";
```

`EXPECTED_OUTFITS` is 3 (`src/core/validate.ts:25`). Fewer looks are never padded. More than three valid looks are all kept and the status is `completed`, unless the adapter itself claimed `partial`. If the adapter sent a valid `fallback` (`code` max 80, `message` max 300) it is kept; otherwise a `partial` result that lost looks during validation gets `{ code: "outfits_dropped", message: "Some looks could not be shown." }` (`src/core/validate.ts:239`). The list of what was dropped is returned as `issues` for debugging and is not shown to the customer.

## 7. Error codes and retry

| Code | Raised by | Retryable | Meaning |
| --- | --- | --- | --- |
| `malformed_response` | validator | yes | Not an object, or required fields missing |
| `mismatched_response` | validator | yes | Answers a different `requestId` or `inputKey` |
| `service_failed` | validator | yes, unless the adapter said `retryable: false` | Adapter returned `status: "failed"` without a code |
| any adapter code (max 80) | adapter | as the adapter says, default yes | Adapter returned `status: "failed"` with `error.code` |
| `timeout` | service | yes | No answer within `TIMEOUT_MS` (20000 ms, `src/core/processing.ts:37`; 9000 ms in test mode, `src/core/service.ts:101`) |
| `cancelled` | service | no | The caller aborted; not stored in history |
| `adapter_error` | service | yes | The adapter threw or rejected for any other reason (a failed retailer lookup does not count: it leaves the pieces unchanged) |

Retry policy on screen (`processingReducer`, `src/core/processing.ts:49`; failures handled at `src/core/processing.ts:63`): a retryable failure offers Try again until `MAX_ATTEMPTS` (3, `src/core/processing.ts:33`) tries in all; a non retryable failure or the third failure goes to `retry_exhausted`. After `SLOW_AFTER_MS` (5000 ms) the screen says the request is taking longer than usual. The app never retries on its own.

## 8. Feedback

```ts
// src/core/contracts.ts:227 to 242
export type FeedbackKind = "more_like_this" | "not_for_me";
export type FeedbackReason = "too_formal" | "too_casual" | "wrong_colours" | "wrong_fit" | "too_expensive";

export interface OutfitFeedback {
  eventId: string;              // "fb_" + 32 hex
  anonymousSessionId: string;
  userId?: string;
  recommendationId: string;
  requestId: string;
  outfitId: string;
  garmentId?: string;           // when the customer named the piece
  feedback: FeedbackKind;
  reason?: FeedbackReason;
  adapter: { id: string; version: string };
  createdAt: string;
}
```

Records are written by `feedbackStore.record` (`src/core/feedback.ts:59`) to `localStorage` key `praxis_feedback`, newest first, at most 300. Optional fields are removed when empty. "Undo" deletes the latest record (`withdraw`, `src/core/feedback.ts:70`). Feedback is not sent anywhere on its own; it reaches an engine only as the `PreferenceSnapshot` in the next `StylingRequest` (section 3.4). Sending feedback records to a server is a future integration; `FeedbackStore` (`src/core/feedback.ts:36`) is the interface it would sit behind.

## 9. Example: dinner, restaurant, night, sharp, $300 to $900

The request below is what `buildStylingRequest` produces for these answers with a saved Style DNA and some earlier feedback. The ids are illustrative; their formats match `newId` and `profileRef`. The response is exactly what the mock adapter returns for it (`mockRecommend`, `src/core/adapters/mock.ts:244`), generated by running the code, and it passes validation unchanged.

### 9.1 StylingRequest

```json
{
  "requestId": "req_5b9e0c2a71d84f3a9e61c0d2b7a4f185",
  "inputKey": "DINNER|RESTAURANT|NIGHT|SHARP|ELEVATED|-|dna_e3a8c41f0b7d4c95a2f6d18b3c70e2a9_v3",
  "contractVersion": "1.0",
  "journey": "style_a_moment",
  "anonymousSessionId": "anon_7c1e4b2f9a0d4e6b8c3f51a2d9e07b64",
  "occasion": "DINNER",
  "venue": { "type": "RESTAURANT", "label": "Restaurant" },
  "timeOfDay": "NIGHT",
  "preferredVibe": "SHARP",
  "budget": { "band": "ELEVATED", "minimum": 300, "maximum": 900, "currency": "USD" },
  "wardrobeItems": [],
  "generatedAt": "2026-10-11T07:40:00.000Z",
  "styleProfileId": "dna_e3a8c41f0b7d4c95a2f6d18b3c70e2a9_v3",
  "styleProfile": {
    "undertone": { "value": "cool", "basis": "confirmed" },
    "contrast": { "value": "high", "basis": "inferred" },
    "fit": { "value": "SLIM", "basis": "confirmed" },
    "week": { "value": "MIXED", "basis": "confirmed" },
    "tastes": ["minimal"]
  },
  "preferences": {
    "likedOutfitIds": ["date_sharper_01"],
    "rejectedOutfitIds": ["party_relaxed_01"],
    "reasonCounts": { "too_casual": 1 },
    "dislikedGarmentIds": []
  }
}
```

### 9.2 StylingResponse (adapter output)

```json
{
  "recommendationId": "rec_5b9e0c2a71d84f3a9e61c0d2b7a4f185",
  "requestId": "req_5b9e0c2a71d84f3a9e61c0d2b7a4f185",
  "inputKey": "DINNER|RESTAURANT|NIGHT|SHARP|ELEVATED|-|dna_e3a8c41f0b7d4c95a2f6d18b3c70e2a9_v3",
  "contractVersion": "1.0",
  "adapter": { "id": "mock", "version": "1.0.0" },
  "mode": "demonstration",
  "status": "completed",
  "outfits": [
    {
      "outfitId": "dinner_sharper_01",
      "rank": 1,
      "role": "sharper",
      "title": "Elevated Dinner",
      "rationale": "A blazer over a fitted knit looks intentional, and the boots finish it.",
      "explanation": {
        "summary": "Sharp, as you asked, for dinner at a restaurant at night.",
        "contributingFactors": [
          { "factor": "occasion", "value": "Dinner", "influence": "One of my dinner looks" },
          { "factor": "venue", "value": "Restaurant", "influence": "Right for a restaurant" },
          { "factor": "time", "value": "Night", "influence": "Made for the evening" },
          { "factor": "style", "value": "Sharp", "influence": "The sharp feel you asked for" },
          { "factor": "budget", "value": "$300 to $900", "influence": "Example prices inside your budget" }
        ],
        "source": "mock_rules"
      },
      "garments": [
        {
          "garmentId": "dinner_sharper_01_top",
          "slot": "top",
          "name": "Blazer over a fitted knit",
          "source": "retail",
          "product": {
            "productId": "sample_dinner_sharper_01_top",
            "retailerId": "studio-oren",
            "retailerName": "Studio Oren",
            "price": 145,
            "currency": "USD",
            "priceStatus": "example",
            "availability": "unknown"
          }
        },
        {
          "garmentId": "dinner_sharper_01_bottom",
          "slot": "bottom",
          "name": "Tailored trousers",
          "source": "retail",
          "product": {
            "productId": "sample_dinner_sharper_01_bottom",
            "retailerId": "harbour-finch",
            "retailerName": "Harbour & Finch",
            "price": 195,
            "currency": "USD",
            "priceStatus": "example",
            "availability": "unknown"
          }
        },
        {
          "garmentId": "dinner_sharper_01_shoes",
          "slot": "shoes",
          "name": "Chelsea boots",
          "source": "retail",
          "product": {
            "productId": "sample_dinner_sharper_01_shoes",
            "retailerId": "studio-oren",
            "retailerName": "Studio Oren",
            "price": 260,
            "currency": "USD",
            "priceStatus": "example",
            "availability": "unknown"
          }
        }
      ],
      "visualization": {
        "imageId": "img_dinner_sharper_01",
        "outfitId": "dinner_sharper_01",
        "kind": "styled_visualization",
        "url": "/images/dinner_sharper_01.jpg",
        "provider": "praxis-library",
        "fidelity": "representative",
        "sourceGarmentIds": ["dinner_sharper_01_top", "dinner_sharper_01_bottom", "dinner_sharper_01_shoes"],
        "status": "ready",
        "width": 1024,
        "height": 1024
      },
      "pricing": { "total": 600, "currency": "USD", "status": "example" }
    },
    {
      "outfitId": "dinner_safest_01",
      "rank": 2,
      "role": "classic",
      "title": "Polished Casual",
      "rationale": "A dark knit and clean chinos look polished without overdoing it.",
      "explanation": {
        "summary": "A classic alternative for dinner at a restaurant at night.",
        "contributingFactors": [
          { "factor": "occasion", "value": "Dinner", "influence": "One of my dinner looks" },
          { "factor": "venue", "value": "Restaurant", "influence": "Right for a restaurant" },
          { "factor": "time", "value": "Night", "influence": "Made for the evening" },
          { "factor": "style", "value": "Sharp", "influence": "A classic alternative" },
          { "factor": "budget", "value": "$300 to $900", "influence": "Example prices inside your budget" }
        ],
        "source": "mock_rules"
      },
      "garments": [
        {
          "garmentId": "dinner_safest_01_top",
          "slot": "top",
          "name": "Dark knit top",
          "source": "retail",
          "product": {
            "productId": "sample_dinner_safest_01_top",
            "retailerId": "harbour-finch",
            "retailerName": "Harbour & Finch",
            "price": 145,
            "currency": "USD",
            "priceStatus": "example",
            "availability": "unknown"
          }
        },
        {
          "garmentId": "dinner_safest_01_bottom",
          "slot": "bottom",
          "name": "Clean chinos",
          "source": "retail",
          "product": {
            "productId": "sample_dinner_safest_01_bottom",
            "retailerId": "maison-tarek",
            "retailerName": "Maison Tarek",
            "price": 160,
            "currency": "USD",
            "priceStatus": "example",
            "availability": "unknown"
          }
        },
        {
          "garmentId": "dinner_safest_01_shoes",
          "slot": "shoes",
          "name": "Leather sneakers",
          "source": "retail",
          "product": {
            "productId": "sample_dinner_safest_01_shoes",
            "retailerId": "atelier-nord",
            "retailerName": "Atelier Nord",
            "price": 195,
            "currency": "USD",
            "priceStatus": "example",
            "availability": "unknown"
          }
        }
      ],
      "visualization": {
        "imageId": "img_dinner_safest_01",
        "outfitId": "dinner_safest_01",
        "kind": "styled_visualization",
        "url": "/images/dinner_safest_01.jpg",
        "provider": "praxis-library",
        "fidelity": "representative",
        "sourceGarmentIds": ["dinner_safest_01_top", "dinner_safest_01_bottom", "dinner_safest_01_shoes"],
        "status": "ready",
        "width": 1024,
        "height": 1024
      },
      "pricing": { "total": 500, "currency": "USD", "status": "example" }
    },
    {
      "outfitId": "dinner_relaxed_01",
      "rank": 3,
      "role": "relaxed",
      "title": "Relaxed Clean",
      "rationale": "An overshirt over a plain t-shirt keeps it relaxed and still neat.",
      "explanation": {
        "summary": "A more relaxed alternative for dinner at a restaurant at night.",
        "contributingFactors": [
          { "factor": "occasion", "value": "Dinner", "influence": "One of my dinner looks" },
          { "factor": "venue", "value": "Restaurant", "influence": "Right for a restaurant" },
          { "factor": "time", "value": "Night", "influence": "Made for the evening" },
          { "factor": "style", "value": "Sharp", "influence": "A more relaxed alternative" },
          { "factor": "budget", "value": "$300 to $900", "influence": "Example prices inside your budget" }
        ],
        "source": "mock_rules"
      },
      "garments": [
        {
          "garmentId": "dinner_relaxed_01_top",
          "slot": "top",
          "name": "Plain t-shirt with a light overshirt",
          "source": "retail",
          "product": {
            "productId": "sample_dinner_relaxed_01_top",
            "retailerId": "maison-tarek",
            "retailerName": "Maison Tarek",
            "price": 145,
            "currency": "USD",
            "priceStatus": "example",
            "availability": "unknown"
          }
        },
        {
          "garmentId": "dinner_relaxed_01_bottom",
          "slot": "bottom",
          "name": "Dark jeans",
          "source": "retail",
          "product": {
            "productId": "sample_dinner_relaxed_01_bottom",
            "retailerId": "maison-tarek",
            "retailerName": "Maison Tarek",
            "price": 160,
            "currency": "USD",
            "priceStatus": "example",
            "availability": "unknown"
          }
        },
        {
          "garmentId": "dinner_relaxed_01_shoes",
          "slot": "shoes",
          "name": "Clean sneakers",
          "source": "retail",
          "product": {
            "productId": "sample_dinner_relaxed_01_shoes",
            "retailerId": "studio-oren",
            "retailerName": "Studio Oren",
            "price": 195,
            "currency": "USD",
            "priceStatus": "example",
            "availability": "unknown"
          }
        }
      ],
      "visualization": {
        "imageId": "img_dinner_relaxed_01",
        "outfitId": "dinner_relaxed_01",
        "kind": "styled_visualization",
        "url": "/images/dinner_relaxed_01.jpg",
        "provider": "praxis-library",
        "fidelity": "representative",
        "sourceGarmentIds": ["dinner_relaxed_01_top", "dinner_relaxed_01_bottom", "dinner_relaxed_01_shoes"],
        "status": "ready",
        "width": 1024,
        "height": 1024
      },
      "pricing": { "total": 500, "currency": "USD", "status": "example" }
    }
  ],
  "createdAt": "2026-10-11T07:40:00.000Z"
}
```

What the rules did here: `SHARP` gives the sharper look +4; all three dinner looks are tagged for restaurants (+2) and night (+1); the sharper and classic looks are tagged for the elevated band (+1). The sharper look ranks first; the classic look beats the relaxed one on the budget point. All prices are drawn from the `ELEVATED` table (`src/core/adapters/mock.ts:95`), so totals of 600, 500 and 500 fall inside 300 to 900. The style profile and preferences in the request do not change the result, because the mock does not read them.

### 9.3 After product matching

The service then calls the mock retailer. Each retail product gains a category, sizes and a purchase route; price and stock are unchanged because the mock retailer sends neither a price nor a known stock figure. The first piece, as the screens receive it:

```json
{
  "garmentId": "dinner_sharper_01_top",
  "slot": "top",
  "name": "Blazer over a fitted knit",
  "source": "retail",
  "product": {
    "productId": "sample_dinner_sharper_01_top",
    "retailerId": "studio-oren",
    "retailerName": "Studio Oren",
    "price": 145,
    "currency": "USD",
    "priceStatus": "example",
    "availability": "unknown",
    "category": "Tops",
    "availableSizes": ["S", "M", "L", "XL"],
    "purchase": { "kind": "none", "reason": "example_product" }
  }
}
```

The retailer houses (Atelier Nord, Harbour & Finch, Maison Tarek, Brass Lane, Studio Oren) are invented for the demonstration (`src/core/adapters/mock.ts:90`); none is a real retailer and none of the pieces can be bought.

### 9.4 A failed answer

What the screens receive when the adapter does not answer in time:

```json
{
  "recommendationId": "rec_failed_req_5b9e0c2a71d84f3a9e61c0d2b7a4f185",
  "requestId": "req_5b9e0c2a71d84f3a9e61c0d2b7a4f185",
  "inputKey": "DINNER|RESTAURANT|NIGHT|SHARP|ELEVATED|-|dna_e3a8c41f0b7d4c95a2f6d18b3c70e2a9_v3",
  "contractVersion": "1.0",
  "adapter": { "id": "mock", "version": "1.0.0" },
  "mode": "demonstration",
  "status": "failed",
  "outfits": [],
  "error": { "code": "timeout", "message": "The service took too long to answer.", "retryable": true },
  "createdAt": "2026-10-11T07:40:20.000Z"
}
```

Shape from `failedResponse` (`src/core/validate.ts:178`).

## 10. Checklist for a production recommendation adapter

1. Implement `RecommendationAdapter` (`src/core/service.ts:15`) with a stable `id` other than `mock` and a `version`.
2. Echo `requestId` and `inputKey` exactly.
3. Return three looks with distinct `outfitId`s and distinct `garmentId`s per look, ranked from 1.
4. Send prices in USD with an honest `priceStatus`; send `availability` only when a feed reports it.
5. Use `https` for `purchase.url`; use only `http(s)` or app relative paths for image and product URLs.
6. Set `explanation.source: "model"` and `mode: "personalized"` only when the looks were actually built for this customer.
7. On failure, return `status: "failed"` with an `error.code`, and `retryable: false` when trying again cannot help.
8. Honour the abort signal; the service gives up after 20 seconds.
9. Wire it into `stylingService()` (`src/core/service.ts:151`) under a new `VITE_RECOMMENDATION_ADAPTER` value, and decide the transport, since none is defined today.
