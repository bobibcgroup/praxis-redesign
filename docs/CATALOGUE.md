# The hybrid catalogue: store pieces, Praxis references, one picture per look

Status at a glance (details in [Feature status](#feature-status)):

- **Fully functional:** store feed reading and filing, the shared garment model, the reference
  catalogue, composition and gap filling, budget, prices and Check out rules, the store's own photos,
  error states, the picture cache, ledger, budget and ceilings.
- **Fully functional, live once Google bills the key's project:** the outfit picture. The look on
  screen is drawn by Gemini on one fixed Praxis model from its pieces' own photographs and attributes,
  checked (kinds, colours, layering, head and shoes in frame, same model, defects) and shown only if
  every check passes. Tarek approved a 10 to 25 USD test budget in writing on 2026-10-12; the server
  holds it at 20 USD. A key on Google's free tier gets no image quota, so until billing is on the look
  says plainly that pictures aren't switched on and keeps its reference photograph.
- **Not implemented:** exact product fidelity (a picture is always "Product details may vary"),
  pictures for the ordinary example looks, real payment.

Only browsers that opened the site with `?stock=live` see any of this while `RETAIL_SHOPIFY_FOR` is
`test` (the default). Everyone else sees the looks exactly as before.

## How a look is built

```
recommended looks (engine)
  -> styling spec per look          src/core/catalogue/compose.ts  specFromLook
  -> one store search, every part   server/providers/shopify-feed.mjs (product_matching)
  -> composition per look           compose.ts  compose, toOutfit
  -> a picture of the look on screen src/a/lib/outfitPicture.ts -> /api/ai/outfit_visualization
                                    server/visuals.mjs -> server/providers/gemini-image.mjs
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
- The print says what it is, at its foot: "Made for these pieces. Product details may vary." for a
  made picture; "Reference photo while I dress the model in these pieces." while it is being made;
  "Reference photo, not these exact pieces." when no image model is on; and, when it fails, the reason
  with "Reference photo shown, not these exact pieces." and Try again.
- The budget line says "Real prices, $X for the N pieces to buy; N reference pieces not included".

### Errors

| Case | What the customer sees |
| --- | --- |
| Store can't be read (refused, down, slow, bad answer) | The usual example looks; nothing breaks |
| No store piece fits a part | That part stays a reference |
| A store photo fails to load | The row shows no photo, nothing broken |
| Every piece is a reference | "nothing to buy here yet", no Check out |
| A part can't be filled at all | The look is partial; with nothing complete, an empty state |
| The picture fails (checks, provider, timeout) | The library photograph, the reason, Try again |
| No billing on the Google project, budget spent, daily ceiling | The library photograph, the reason, no retry loop |

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

### The pipeline

```
look on screen (Results, hero in the URL)
  -> useOutfitPicture            src/a/lib/outfitPicture.ts    only the look shown; one request per composition
  -> visualizationSpec           src/core/catalogue/visualize.ts
  -> POST /api/ai/outfit_visualization
  -> canonicalSpec, cache, caps, budget    server/visuals.mjs
  -> gemini-image run            server/providers/gemini-image.mjs
       piece pictures: store photo (store hosts only), reference crop of the library photograph,
                       or words (the customer's own piece; never a photo)
       base model picture: public/images/model/praxis-model-01.jpg, else made once and kept
       generate (Gemini image model, 3:4, 1K) -> file check -> vision check -> measured colour
       up to two attempts, the second told what the first got wrong
  -> stored /api/visuals/img_<key>.jpg, cached by the server's own key
  -> the print swaps to it; the look's thumbnails, viewer and Save use it too
```

### The request (spec version 3)

```json
{
  "outfitId": "dinner_sharper_01",
  "garmentIds": ["...blazer", "...knit", "...trousers", "...boots"],
  "spec": {
    "version": 3,
    "garments": [
      { "garmentId": "...", "source": "shopify", "slot": "top", "layer": "outer", "name": "Wool Blazer in Charcoal",
        "attributes": { "subcategory": "blazer", "colour": "grey", "material": "wool" },
        "imageUrl": "https://cdn.shopify.com/...", "retailerProductId": "shopify_...", "retailerVariantId": "..." },
      { "garmentId": "...", "source": "reference", "slot": "top", "layer": "base", "name": "Navy fitted knit",
        "referenceId": "ref_dinner_sharper_01_base" },
      { "garmentId": "...", "source": "wardrobe", "slot": "shoes", "name": "Your brown boots" }
    ],
    "model": { "modelId": "praxis-model-01", "baseImage": "praxis-model-01@1", "...": "pose, backdrop, light" },
    "render": { "aspectRatio": "3:4", "imageSize": "1K" },
    "cacheKey": "vis_..."
  }
}
```

The server never trusts this as sent. `canonicalSpec` keeps up to six known pieces, needs a top and
trousers, replaces a reference by Praxis's own record (name, attributes, crop of its photograph) by
`referenceId`, keeps a store photo only from `cdn.shopify.com`, `*.myshopify.com`, the configured store
or `VISUAL_PHOTO_HOSTS`, over https, and drops any photo of the customer's own piece. The image model
gets: the base picture as image 1, then one picture per piece, each named in the prompt by its number
with its kind, colour, material, fit and layer, then layering, framing (head to soles, nothing cropped)
and "a real photograph, no text" rules.

### Checks before a picture is shown

1. The file: JPEG, PNG or WebP, at least 600 px wide, about 3:4, not blank.
2. A vision model (the newest stable Gemini Flash, JSON answer, temperature 0) compares the picture with
   the base model and the outfit: one man full length, head and both shoes in frame, the same man,
   plausible anatomy, severe defects, extra clothing; for each piece, worn or not, its kind, its
   colour and its box.
3. Measured colour: the middle of each piece's box is averaged and named, and must agree with the
   piece's colour (or the vision model's reading must).
4. Kinds go through the shared ontology (`chinos` passes for trousers, `boots` doesn't for loafers);
   an outer layer must show over its base.

All checks pass or the picture is never shown; the next attempt is told what failed. A passed picture
is still "representative": nothing here proves the exact product, so it always carries "Product
details may vary". Every check is returned with the picture (`result.checks`).

### Cache and invalidation

- The page keys a composition by `cacheKey`: the look, each piece's slot, layer, source, id, reference
  id, product id, variant id, photo address and attributes, the model, the render settings and the
  provider version. Changing any of them (another variant, a new store photo, a swapped piece, Sharper
  to Classic) is another picture; returning to a look shows its picture at once.
- The server keys pictures by its own hash of the canonical spec and the provider version, so no
  request can place a picture under another composition. Pictures live in `VISUALS_DIR` (a Railway
  volume when mounted, else the temp folder, lost on redeploy) for seven days.

### Money

- Prices (Google's list, October 2026, 1K): Gemini 3 Pro image 0.134 USD, 3.1 Flash image 0.067 USD,
  Nano Banana 2.1 or 3.1 Flash Lite image 0.0336 USD; each check about 0.003 USD.
- Budget: `OUTFIT_IMAGE_BUDGET_USD` (default 20, Tarek's written approval), `OUTFIT_IMAGE_DAILY_USD`
  (default 6). The most a request can cost (0.41 USD) is set aside before it runs. Spend is written to
  `VISUALS_DIR/spend.json` after each call and shown at `/api/health` under `pictures`.
- Ceilings: `VISUALIZATION_DAILY_CAP` new pictures per visitor per day (default 12),
  `VISUALIZATION_ADDRESS_DAILY_CAP` per network address (default 30).
- `AI_PROVIDER_OUTFIT_VISUALIZATION=off` stops all paid pictures at once.

### Switches

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | unset | Switches the picture provider on (with the stylist's words). Images need billing on its Google Cloud project |
| `AI_PROVIDER_OUTFIT_VISUALIZATION` | `gemini-image` when the key is set | `off` stops pictures; `library-visualization` is the free stand-in |
| `GEMINI_IMAGE_MODEL`, `GEMINI_CHECK_MODEL` | picked from Google's list | Force a model (for example `gemini-3.1-flash-image-preview` to halve the cost) |
| `OUTFIT_IMAGE_BUDGET_USD`, `OUTFIT_IMAGE_DAILY_USD` | 20, 6 | The approved budget |
| `VISUALIZATION_DAILY_CAP`, `VISUALIZATION_ADDRESS_DAILY_CAP` | 12, 30 | Ceilings |
| `VISUALS_DIR` | the Railway volume, else temp | Where pictures and the spend are kept |
| `VISUAL_PHOTO_HOSTS` | none | More image hosts a store photo may come from |
| `GEMINI_API_BASE` | Google | Tests point it at `e2e/fixtures/fake-gemini.mjs` |

Store photos: they are sent to Google as reference images only for the store whose public list is
configured, for this test. Before customers, confirm the store allows its product photos to be used to
generate images.

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
| Picture cache, ledger, budget, visitor and address ceilings | Fully functional | `visualize.ts`, `server/visuals.mjs` |
| The look's picture on one model, from its pieces' photos and attributes | Fully functional; live once the key's Google project has billing | `gemini-image.mjs`, `outfitPicture.ts` |
| Checks on every picture (kinds, colours, layering, framing, same model, defects) | Fully functional | `server/visual-check.mjs` |
| Exact product fidelity | Not possible to prove; every picture says details may vary | |
| Stock quantities | Not available from the public list | |
| Real payment | Not implemented (Check out is a stand-in) | |

## Tests

- `src/core/__tests__/real-stock.test.ts`: the feed (switch, filing, paging, candidates, caching,
  failures, missing fields).
- `src/core/__tests__/hybrid.test.ts`: references, composition, visualization, server guards, the
  hybrid step and its privacy.
- `src/core/__tests__/outfit-images.test.ts`: the whole picture pipeline against a stand-in for
  Google's API (`e2e/fixtures/fake-gemini.mjs`): the actual store and reference pictures reach the
  request, in order and by number; a picture without the shoes or in the wrong colour is refused after
  a second attempt; billing missing is reported; cache keys change with variant, photo, attributes and
  provider; the budget holds.
- `e2e/suites/14-hybrid.mjs` with `e2e/fixtures/test-store.mjs` (a fake store, switchable down):
  mixed looks on desktop and phone, Check out, photos, look switching, zoom, Share, Save, store down,
  and an ordinary visitor unchanged; with the stand-in Gemini, each look's picture made from its own
  pieces and kept with the look as it changes, a failed check never shown, Try again, and billing
  missing. Run `SUITE=14 npm run e2e`.
- `FACE2` in `e2e/scenarios.mjs`: the bar never covers a photo on six pages at 375, 390, 430, 768,
  1024, 1280, 1440 and 1920 px, scrolled, resized, on every look, and wide or tall pictures are never
  cut at the head or the shoes.
- `.github/workflows/visual-demo.yml` (`tools/visual-demo.mjs`): makes outfits A, B and C on the live
  site and keeps their source pictures, made pictures and checks as an artifact. Run by hand only.
