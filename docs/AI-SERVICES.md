# AI services (Phase 2)

Every AI capability Praxis will use goes through one service layer, so a mock can be replaced by a real provider by configuration, without touching a screen. Today every service is a free, deterministic mock. No paid AI, image, try-on, retailer or location service is called.

Code: `src/core/ai/envelope.ts` (the envelope and runner), `src/core/ai/services.ts` (the nine contracts, their checks and mocks), `src/core/ai/http.ts` (the live provider, page side), `src/core/ai/bridge.ts` (plugs services into the adapters the screens already use), `server/ai.mjs` (the server plug-in point). Tests: `src/core/__tests__/ai-services.test.ts`, `phase2-integrity.test.ts`.

## How a call works

```
screen ─▶ existing adapter (service.ts, vision.ts, retail.ts)
              │  mock by default
              └─ when listed in VITE_AI_PROVIDERS ─▶ bridge.ts ─▶ aiServices().call(service, payload, who)
                                                                     │
                                                       callService(definition, provider, request)
                                                         1. checkPayload (refused before sending)
                                                         2. billable guard (paid calls off ▶ "disabled")
                                                         3. attempt with time limit, cancel honoured
                                                         4. retry retryable failures, pause doubles
                                                         5. checkResult (malformed ▶ "failed")
                                                                     │
                                                 provider: mock (free)  or  http ─▶ POST /api/ai/<service>
                                                                                     server/ai.mjs ─▶ server/providers/<name>.mjs
```

The page never holds a provider key. A live provider is always this app's own server, which reads keys from its environment.

## The envelope

Request (`ServiceRequest<P>`): `requestId` (unique per request, kept across retries), `service`, `contractVersion` (`ai-2026-10-12`), `anonymousSessionId`, `userId` when signed in, `attempt`, `createdAt`, `payload`.

Response (`ServiceResponse<R>`): `requestId`, `service`, `contractVersion`, `status`, `result`, `error { code, message, retryable }`, `provider { id, version, mode: mock|live, processing: none|on_device|server, billable }`, `attempts`, `durationMs`, `completedAt`, `metadata` (small non-personal facts only; never a photo, email or free text).

Statuses: `succeeded`, `partial`, `empty`, `failed`, `timed_out`, `cancelled`, `disabled`.
Error codes: `validation_error`, `invalid_response`, `provider_error`, `timeout`, `cancelled`, `billing_blocked`, `not_connected`, `consent_missing`.

`callService` always resolves; it never throws into a screen.

## The nine contracts

| # | Service | Payload | Result | Time limit | Retries |
|---|---|---|---|---|---|
| 1 | `styling_recommendation` | `StylingRequest` (every quiz answer, owned piece, Style DNA, feedback) | `StylingResponse`: title, rationale, factors, garments, product refs, pricing, wardrobe ownership, image refs, provider version, error | 20 s | 1 |
| 2 | `styling_explanation` | request + `outfitId` | summary, factors, source `mock_rules` or `model` | 10 s | 1 |
| 3 | `outfit_visualization` | `outfitId`, `garmentIds` | `imageUrl`, fidelity `exact` or `representative`, `generated` | 30 s | 1 |
| 4 | `virtual_try_on` | `outfitId`, `garmentIds`, person photo ref with consent | `imageUrl` | 45 s | 1 |
| 5 | `face_colour_analysis` | face photo ref with consent | undertone, contrast, source `sample` or `model` | 15 s | 1 |
| 6 | `body_fit_analysis` | preferred fit, or a full-length photo ref with consent | recommended fit, source `self_reported` or `model`, notes | 15 s | 1 |
| 7 | `garment_recognition` | garment photo ref with consent, slot hint | slot, category, colour, source `customer` or `model` | 15 s | 1 |
| 8 | `product_matching` | garments, budget, currency, country | per garment, `ProductRef` list | 10 s | 1 |
| 9 | `inventory_pricing` | product and retailer ids | per product: price with status, availability, sizes, `checkedAt`, freshness `live`, `cached` or `example` | 8 s | 1 |

Every photo payload is checked against its photo policy (`src/core/images.ts`): minimum size and the current consent version. A photo without current consent is refused before anything is sent.

## Mocks and scenarios

Every mock runs every scenario, deterministically. In the app the scenario comes from test mode (`/internal/analytics`, per tab); tests pass it directly.

| Scenario | Test mode value | What the caller sees |
|---|---|---|
| Success | `fast` (or off) | `succeeded` with a valid result |
| Delayed | `slow` | `succeeded` after 2.5 s (the styling build shows its delay line) |
| Partial | `partial` | `partial`, a smaller valid result (two looks) |
| Empty | `empty` | `empty`, a valid result with nothing in it |
| Validation error | `validation_error` or `invalid_image` | the malformed answer becomes `failed` / `invalid_response` |
| Service failure | `failure` | `failed`, retried once, then `failed` |
| Timeout | `timeout` | `timed_out` after the time limit |
| Retry success | `retry_success` | first attempt fails, second succeeds (`attempts: 2`) |

What the mocks never do:

- Try-on and outfit visualization answer `disabled` / `not_connected`. No picture of the customer or of a look is made.
- Colour analysis returns a fixed example marked `source: "sample"`; fit is `self_reported`; garment recognition returns the slot the customer chose, marked `customer`.
- Prices are `priceStatus: "example"`; stock is `unknown`; inventory freshness is `example` with no price. Nothing is presented as live.

## Turning a real provider on (later, with approval)

1. Write `server/providers/<name>.mjs` exporting `id`, `version`, `billable`, `async run(request, { signal })` returning `{ status, result?, error?, metadata? }` in the contract's result shape.
2. On the server: `AI_PROVIDER_<SERVICE>=<name>` (for example `AI_PROVIDER_FACE_COLOUR_ANALYSIS=acme-colour`) and, for a paid provider, `ALLOW_BILLABLE_AI=true`. Keys go in the server's environment only.
3. On the page build: `VITE_AI_PROVIDERS=face_colour_analysis` and `VITE_ALLOW_BILLABLE_IMAGES=true`.

All three switches are off by default. With any one of them off the service answers `disabled` and nothing is charged. Try-on keeps its own endpoint (`/api/tryon`, `docs/TRY-ON.md`).

## Retailer data model

`ProductRef` (`src/core/contracts.ts`): `productId`, `retailerId`, `retailerName`, `category`, `imageUrl`, `price` and `currency`, `priceStatus` (`example`, `estimated`, `live`), `availability` (`in_stock`, `out_of_stock`, `unknown`), `availableSizes`, `sizeAvailability` per size, `productUrl` (https only), `purchase` route, `deliveryEstimate`, `lastUpdatedAt` (freshness). A look's garments are either `source: "retail"` with a `ProductRef` or `source: "wardrobe"` (the customer's own piece, never priced or sold). A retailer answer only replaces a price when it says how sure it is (`retail.ts mergeProduct`).

## Request integrity, stale and duplicate protection

- Every quiz answer, the owned piece, the Style DNA and the feedback reach the request (`buildStylingRequest`; test "carries every answer…").
- The input key changes with any answer, the owned piece or the Style DNA, and a response is only shown for the key and person it answered (`useStylingResponse`).
- Requests in flight are shared per person and key, so a remount never sends twice; a cancelled or superseded run is aborted and its late answer dropped.
- Saves dedupe by look and key; storage writes re-read before writing, so two tabs do not overwrite each other.

## Traceability matrix

| Brief requirement | Where | Test |
|---|---|---|
| P0 any email opens any account | Stand-in sign-in still has no password; accounts separated per address and provider (Stage 1). A real sign-in needs a provider (pending, approval) | `stage1-safety.test.ts`, e2e ISO1 to ISO3 |
| P0 data shared across accounts (looks, Style DNA, history, feedback) | `store.ts` owners, `account.ts visibleTo`, `feedback.ts ownedBy`, `service.ts madeFor` | `stage1-safety.test.ts`, e2e ISO1 to ISO3 |
| P0 silent save failure, two tabs, bad record | `store.ts update`, backup key, `SaveFailed` | `stage1-safety.test.ts`, e2e SAVE2, TABS1 |
| P1 Style DNA, feedback and budget ignored | `adapters/mock.ts` scoring and budget filter | `phase2-integrity.test.ts` |
| P1 sign out leaves data, card autofill, /dna open | `journey.tsx signOut`, `GateSteps`, `DnaOnly` | `stage1-safety.test.ts`, e2e ISO, S6 |
| P2 total under budget but wording says inside | budget filter and wording in `mock.ts` | `phase2-integrity.test.ts` |
| P2 copy overclaims (sync, colours from a photo) | `Completion.tsx`, `GateSteps.tsx` | review |
| P3 $0 shown as Owned, zoom cue, My pick by position | `looks.ts money`, `Results.tsx` | build, e2e S1 |
| 14-step See it on me with a mock | `tryon.ts`, `TryOn.tsx`, `/api/tryon` | `tryon.test.ts`, e2e TRY1 to TRY7 |
| Contracts for nine services with id, status, error, timeout, retry, version, metadata, validation | `ai/envelope.ts`, `ai/services.ts` | `ai-services.test.ts` |
| Mocks for eight scenarios | `ai/services.ts mockProvider`, `sim.ts`, `service.ts withSimulation` | `ai-services.test.ts`, e2e S8, S9, P2A, P2B |
| Processing states | `processing.ts` (idle, validating, submitted, processing, delayed, partial, completed, empty, failed, retry, cancelled) | `phase2-service.test.ts`, e2e S8 |
| Image readiness per category and processing mode | `images.ts IMAGE_POLICIES`, provider `processing` | `phase2-privacy.test.ts`, `ai-services.test.ts` |
| Normalized retailer model with freshness | `contracts.ts ProductRef`, `retail.ts`, `InventoryItem` | `ai-services.test.ts`, e2e S10 |
| No paid call in mock mode; no keys in the page | billable guard, server switches | `ai-services.test.ts`, e2e P2C |
| No face images or sensitive attributes in analytics | `analytics.ts` guards | `analytics.test.ts`, e2e S12 |

## Feature status

| Feature | Status |
|---|---|
| Style a moment (questions, looks, explanations, feedback, save) | MOCK FUNCTIONAL (rules engine, full journey) |
| Guest and account separation on this device | FULLY FUNCTIONAL on device; accounts are a stand-in |
| Saved looks, history, feedback, Your data, deletion | FULLY FUNCTIONAL on device |
| Style DNA (questions, editable profile) | FULLY FUNCTIONAL; colour reading MOCK FUNCTIONAL (sample) |
| See it on me (14 steps, consent, capture, submit, states) | MOCK FUNCTIONAL; picture generation INTEGRATION READY |
| Styling recommendation, explanation services | MOCK FUNCTIONAL, INTEGRATION READY |
| Outfit visualization | INTEGRATION READY (library photos shown, nothing generated) |
| Face colour analysis | MOCK FUNCTIONAL (sample), INTEGRATION READY |
| Body and fit analysis | INTEGRATION READY (contract and mock; no screen asks for a photo) |
| Wardrobe garment recognition | MOCK FUNCTIONAL (customer names the piece), INTEGRATION READY |
| Retailer product matching, stock and price | MOCK FUNCTIONAL (example prices, unknown stock), INTEGRATION READY |
| Check out and purchase | INCOMPLETE by design: no real payment |
| Sign in and Premium payment | INCOMPLETE: visual previews, need a provider (approval) |
| Server persistence across devices | INCOMPLETE: browser storage only |
| Country occasion photos | FULLY FUNCTIONAL for 12 countries; 24 pending photos |

## Pending integrations (each needs approval before it is switched on)

1. Recommendation engine (for example Gemini) as `server/providers/<name>.mjs` for `styling_recommendation` and `styling_explanation`.
2. Image generation for `outfit_visualization`.
3. Virtual try-on provider (`/api/tryon`, `docs/TRY-ON.md`).
4. Face colour analysis, body and fit analysis, garment recognition providers.
5. Retailer feeds for `product_matching` and `inventory_pricing`.
6. Real sign-in and payment provider; server-side storage for accounts and saved looks.
7. Legal sign-off on the photo disclosures.
