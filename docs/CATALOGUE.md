# The hybrid catalogue: store pieces, Praxis references, one picture per look

Status at a glance (details in [Feature status](#feature-status)):

- **Fully functional:** store feed reading and filing, the shared garment model, the reference
  catalogue, composition and gap filling, budget, prices and Check out rules, the store's own photos,
  error states, the picture cache, ledger and ceilings.
- **Mock functional:** the outfit picture. Every look gets one, but it is the look's library
  photograph, marked as a styling visualization. Nothing is generated.
- **Integration ready:** a real image model. It plugs in as one server provider file plus switches,
  all off. No paid image call can happen until Tarek approves it in writing and the switches are set.
- **Not implemented:** a Gemini (or any) image provider file, fidelity checking of generated pictures,
  real payment.

Only browsers that opened the site with `?stock=live` see any of this while `RETAIL_SHOPIFY_FOR` is
`test` (the default). Everyone else sees the looks exactly as before.

## How a look is built

```
recommended looks (engine)
  -> styling spec per look          src/core/catalogue/compose.ts  specFromLook
  -> one store search, every part   server/providers/shopify-feed.mjs (product_matching)
  -> composition per look           compose.ts  compose, toOutfit
  -> one picture per look           src/core/catalogue/visualize.ts
```

The step runs in `composeHybrid` (`src/core/catalogue/hybrid.ts`), called from the `pieces` step of
the styling pipeline (`src/core/service.ts`). It is skipped in test mode and when no store is set.

### The garment model

`CatalogueGarment` (`src/core/catalogue/garment.ts`) is the one shape both catalogues share:
id, source (`shopify` or `reference`), name, slot, layer, subcategory, colour family, formality
(1 to 5), material, fit, seasons, style attributes, image, availability, and for store pieces the
store's own record (`product`: ids, variant, price, currency, sizes, link). The vocabulary lives in
`src/shared/ontology.mjs`, used by the server and the page alike, so a "chelsea boot" means the same
thing on both sides.

On the page a look's pieces are `Garment`s (`src/core/contracts.ts`): `retail`, `wardrobe`, or the new
`reference`. A reference garment can never carry a price or a link; validation drops them
(`src/core/validate.ts`).

### The reference catalogue

`src/core/catalogue/reference.ts` files every piece in the 15 library photographs: 58 pieces, each
with kind, colour, formality, material, layer and the region of the photograph it occupies (57; the
wedding tie isn't visible). Ids are `ref_<outfit>_<part>`. Every reference has availability
`not_for_sale`, the attribution "Praxis look library photograph", and the rights note "Praxis styling
image, shown on Praxis only; not a product photograph". A reference is never purchasable, never linked,
never in a total and never in Check out.

Two library entries say more than their photograph shows (noted in the file): `party_sharper` is filed
as the black shirt, trousers and Chelsea boots it shows, and the `wedding_sharper` tie has no region.

### Composition and ranking

For each part the composer looks at up to four store candidates of the same kind (`PER_PART` in the
feed) and scores them (`scoreFor`):

| What | Score |
| --- | --- |
| Same kind / close stand-in (`STANDS_IN_FOR`) / anything else | 40 / 25 / rejected |
| Formality same / one step off / further | 25 / 12 / rejected |
| Colour same / unknown on the part / unknown on the piece / both neutral / clash | 25 / 12 / 5 / 10 / minus 20 |
| In stock / out of stock | plus 10 / minus 5 |
| No live price, sold out, or no purchase route | rejected |

A store piece goes in only at 75 or above (`STORE_BAR`); below it the reference stays. So a store
piece wins whenever its quality is comparable, and a weaker one is never put in to sell it. Then the
whole look is checked: at most two accent colours, formality within two steps, an outer layer only
over a base, and the store pieces inside the budget (the dearest store piece goes back to its
reference first). The customer's own pieces keep their part and are never sent anywhere.

A look is `complete`, `partial` (a needed part couldn't be filled, named in its issues) or
`unavailable` (dropped). If every look is unavailable the response is empty and says why.

### On the results

- The total reads "Available to shop, N pieces $X", with "Styling references, N pieces" beneath. Only
  store pieces count and only they go to Check out.
- Each store piece shows the store's own photo, small in the row, large on tap, with "See it at
  {store}". Each reference shows its part of the library photograph and says it isn't for sale here.
- The picture carries "Styling visualization. Product details may vary." at the foot of the print.
- The budget line says "Real prices, $X for the N pieces to buy; N reference pieces not included".

### Errors

| Case | What the customer sees |
| --- | --- |
| Store can't be read (refused, down, slow, bad answer) | The usual example looks; nothing breaks |
| No store piece fits a part | That part stays a reference |
| A store photo fails to load | The row shows no photo, nothing broken |
| Every piece is a reference | "nothing to buy here yet", no Check out |
| A part can't be filled at all | The look is partial; with nothing complete, an empty state |
| The picture fails | The look keeps its library photograph, marked illustrative |

## The Shopify feed: what it gives

Read from the store's public `/products.json`, 250 a page, up to 1000 pieces, cached on the server.
It gives product and variant ids, handle, title, vendor, type, tags, description, photos (with sizes),
each variant's price, options (size, colour) and whether it is available. It does not give stock
quantities (only in or out per variant), structured material or fit (read from the title, tags and
description), collections, or a checkout API (Check out links to the store's page). It is free and
keyless but not an official API, so it is for private testing; before customers see a store's pieces
the store has to agree, or an affiliate feed takes over.

Nothing about the customer goes to the store: the list is read whole and matched on the server. The
page sends the server only each part's kind, colour, formality, layer and name.

**Photos.** The store's photos are shown as the store's own, loaded from its CDN, unchanged and
linked back. They are not copied, stored, cropped into other pictures or sent to an image model.
Putting a store's piece into a generated picture needs the store's permission first.

## The outfit picture

`visualize.ts` turns a composed look into an `OutfitVisualizationSpec`: the look id, each piece's id,
source, kind, colour, material, the store's variant id and photo for store pieces (wardrobe pieces
carry no photo), and one fixed model (`PRAXIS_MODEL`, `praxis-model-01`: neutral pose, plain
backdrop, same build every time). Its `cacheKey` (`vis_xxxxxxxx`) hashes the pieces, the model and the
provider version, so the same composition is never made twice.

`visualize()` serves a cache hit first, refuses a billable provider while paid images are off,
refuses past 24 new pictures a tab, tries twice, rejects an answer for another composition, and keeps
a ledger (`praxis_visual_ledger`: requests, cache hits, refusals, failures, cost). On the server
`server/visuals.mjs` does the same per visitor: a 24 hour cache, a daily ceiling
(`VISUALIZATION_DAILY_CAP`, default 20) and a ledger with the provider's `costPerImageUsd`, logged per
call without anything about the person.

**Fidelity.** `verified` would mean checked against the pieces; nothing checks yet, so every picture
is `illustrative` and says so. The mock returns the look's library photograph.

`server/providers/library-visualization.mjs` is a free server stand-in (same answer, cost 0) so the
server path can be tried: `AI_PROVIDER_OUTFIT_VISUALIZATION=library-visualization`.

## Connecting Gemini or another image model

Do this only after written approval for paid image calls.

1. **Provider file.** Add `server/providers/<name>.mjs` exporting `id`, `version`, `billable`
   (`true` for a paid model), `costPerImageUsd`, `SERVICES = ["outfit_visualization"]` and
   `run(request)`. `request.payload` is `{ outfitId, garmentIds, spec }`. Return
   `{ status: "succeeded", result: { outfitId, imageUrl, fidelity: "representative", generated: true } }`
   or `{ status: "failed", error }`. Use `library-visualization.mjs` as the template. Only the spec's
   garments and model go to the provider; never a customer photo.
2. **Store photos.** Send a store's photo as a reference image only with that store's permission.
   Without it, describe the piece from the spec's words.
3. **Hosting.** A generated picture needs a home (object storage with a retention rule) before
   `imageUrl` points at it; the page accepts only a site path or an http(s) address, never a data URL.
4. **Server switches:** `AI_PROVIDER_OUTFIT_VISUALIZATION=<name>`, its key (for Gemini,
   `GEMINI_API_KEY` on a billed project), `ALLOW_BILLABLE_AI=true`, and `VISUALIZATION_DAILY_CAP`.
5. **Build switch:** `VITE_ALLOW_BILLABLE_IMAGES=true` (without it the page uses the mock even when
   the server offers a paid provider).
6. **Fidelity test before customers.** Run every composition in the test store through it, compare
   each picture with the store's photos (colour, cut, pattern, layering), and keep the label
   "Styling visualization. Product details may vary." until a check can mark a picture verified.

The existing `GEMINI_API_KEY` drives only the free stylist words (`styling_explanation`); no free
default exists for `outfit_visualization`, so the key alone can't start image calls.

## Feature status

| Feature | Status | Where |
| --- | --- | --- |
| Store feed: paging, cache, filing by ontology, prices, sizes, stock per variant | Fully functional (test tabs) | `server/providers/shopify-feed.mjs` |
| Shared garment model and ontology | Fully functional | `garment.ts`, `src/shared/ontology.mjs` |
| Reference catalogue, 58 pieces from 15 photos, never for sale | Fully functional | `reference.ts` |
| Store first composition, ranking, gap filling, whole look checks | Fully functional | `compose.ts` |
| Budget on store pieces only | Fully functional | `compose.ts` |
| Available to shop total, reference count, Check out on store pieces only | Fully functional | `LookDetails.tsx`, `selection.ts` |
| Store's own photo per piece, kept beside the look picture | Fully functional | `PieceRow.tsx` |
| Wardrobe pieces in hybrid looks, never uploaded | Fully functional | `compose.ts`, `visualize.ts` |
| Error states (store down, partial, empty, photo or picture failure) | Fully functional | `hybrid.ts`, results |
| Picture cache, ledger, tab and daily ceilings, retries, cost guard | Fully functional (exercised with the mock) | `visualize.ts`, `server/visuals.mjs` |
| One picture per look on one model | Mock functional (library photograph, illustrative) | `visualize.ts` |
| Real image model (Gemini or other) | Integration ready, provider file not written | this page |
| Fidelity verification of generated pictures | Not implemented | |
| Stock quantities | Not available from the public list | |
| Real payment | Not implemented (Check out is a stand-in) | |

## Tests

- `src/core/__tests__/real-stock.test.ts`: the feed (switch, filing, paging, candidates, caching,
  failures, missing fields).
- `src/core/__tests__/hybrid.test.ts`: references, composition, visualization, server guards, the
  hybrid step and its privacy.
- `e2e/suites/14-hybrid.mjs` with `e2e/fixtures/test-store.mjs` (a fake store, switchable down):
  mixed looks on desktop and phone, Check out, photos, look switching, zoom, Share, Save, store down,
  and an ordinary visitor unchanged. Run `SUITE=14 npm run e2e`.
