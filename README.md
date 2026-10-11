# Praxis redesign: Concept A ("Stage")

The approved front-end direction for Praxis, extracted as a standalone React app so it can be built into the product. Everything in here is UI: journeys, states, motion, copy and tokens. Data, auth, payment and image generation are stand-ins to be replaced.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build to dist/
npm test           # unit tests for src/core (vitest)
npm start          # serve dist/ (used for the preview host)
```

Node 22 or newer.

## What it is

One full-viewport stage. The left column asks one question at a time; the right column is a living 3:4 print that previews the occasion, darkens for night, ghosts the chosen feel, builds the three looks in place, holds the result, and wipes to the try-on. Nothing routes away from the stage; every step is a URL so Back and reload work.

Journeys:

- **Style a moment**: occasion (chosen on home), venue, day or night, feel, spend, the build (it follows the real request, see Processing states), then the looks first: three looks with the hero in the print and three labelled thumbnails beside it. Move between the looks with the thumbnails, a sideways swipe on the print, the arrows and counter under the print on desktop, or the left and right keys once the print or the thumbnails have focus; it stops at the first and last look. Everything on the page follows the one look in the URL (`hero`): photo, name, note, pieces, prices, total, Check out, Share, Save and Restyle. A tap or click on the print (a small glass marks it; on desktop it reads View details on hover) opens the look large to study: zoom with the + and − controls, the wheel or trackpad, a pinch or a double tap, drag to move around, Reset to go back; only the photo zooms, never the page. At normal size a sideways swipe or the arrows move between the looks and a swipe down closes it, back on the same look. The results offer "Make it yours": see it on me (the try-on preview, on a model for now) or use something I own (one item by slot, then the looks rebuild around it). Then try-on, save, share, check out (every piece ticked by default with a live total, then a sheet by retailer with a size for each piece and what is known about stock and delivery; open to everyone, no sign in). Each look has "Why this look" (the factors it was picked on) and More like this or Not for me (with a reason or a piece).
- **Style DNA**: face (with the photo notice first), fit, lifestyle, up to two inspiration presets, the colour analysis, and a result that marks each part as an estimate, a confirmed answer or the customer's correction, with "Not quite right?" to change any of it or retake the photo (see Style DNA profile). Saving it changes the home so a returning user starts on the occasion chips.
- **Looks**: saved looks as a horizontal rail; open, remove.
- **Style DNA**: the saved Style DNA, change it, retake the photo, start again, your data on this device, sign out, light or dark.
- **Your data on this device** (`/data`): what is kept in this browser, deleting a photo, and deleting everything.

Full concept spec: `docs/CONCEPT-A.md`.

## Routes and state

Mounted at `/`. Step routes:

```
/                                   home (first visit, or returning with DNA)
/moment/occasion  /moment/venue  /moment/time  /moment/feel  /moment/spend
/moment/you/face  /moment/you/item   (reached from the results; /moment/you redirects there)
/moment/build  /moment/results  /moment/tryon
/looks  /looks/:id
/dna  /dna/face  /dna/fit  /dna/lifestyle  /dna/inspiration  /dna/build  /dna/result
/internal/analytics                 events recorded in this browser (not linked from the app)
```

Answers travel in search params so reload restores any step: `occasion, venue, time, vibe, spend, face, item, hero, done, mode`; DNA: `face, fit, life, taste`. The gate popup uses `?gate=tryon|dna|signin`; saving needs no gate.

Browser storage (prototype only, replace with real persistence):

| Key | Holds |
|---|---|
| `praxis_lab_a` | saved looks (each with its owner, recommendation and request ids) and the saved Style DNA (`src/shared/store.ts`) |
| `praxis_lab_a_user` | `{ id, name, email, premium }` for the sign-in and Premium previews (`src/a/lib/user.ts`) |
| `praxis_lab_a_accounts` | the stand-in account id for each address signed in on this browser (random, `src/core/identity.ts`) |
| `praxis_anon` | the anonymous visitor id with first and last visit (`src/core/identity.ts`) |
| `praxis_styling_history` | the last 20 styling requests with their validated responses (`src/core/service.ts`) |
| `praxis_feedback` | More like this and Not for me, with reason or piece (`src/core/feedback.ts`) |
| `praxis_events` | the last 1000 analytics events (`src/core/analytics.ts`) |
| `praxis_sync_offer_dismissed` | set when a guest closes the offer to sign in and sync |
| `praxis_lab_a_mode` | `light` or `dark`; light is the default |
| `praxis_lab_a_face`, `praxis_lab_a_item` | captured images for the tab only (sessionStorage); never in localStorage, analytics or saved looks |
| `praxis_image_consent` | which photo notices were agreed to, with the wording version and time (`src/core/images.ts`) |
| `praxis_wardrobe` | pieces the customer owns, by name and type only, no photo (`src/core/data.ts`) |
| `praxis_selections` | which look was chosen for each recommendation, 90 days (`src/core/data.ts`) |
| `praxis_dna_draft` | the Style DNA being built, before it is saved (sessionStorage, `src/a/lib/dnaDraft.ts`) |
| `praxis_sim` | the test mode scenario for this tab (sessionStorage, `src/core/sim.ts`) |
| `praxis_lab_a_viewer_hint` | set once a look has been opened large, so the zoom and swipe hint shows only the first time |

## What is a stand-in

- **Recommendations** (`src/core/adapters/mock.ts`): a rules adapter, not a stylist. It scores the fifteen library outfits on the feel, the place, the time and the budget, explains each look with the factors it used, and says the looks are examples. Replace it by adding an adapter (see Recommendation architecture) and setting `VITE_RECOMMENDATION_ADAPTER`.
- **Sign-in and payment** (`src/a/ui/Gate.tsx`, `GateSteps.tsx`): visual previews of Apple, Google and email sign-in, and of a "Premium" purchase with Apple Pay or card. No Clerk or Stripe calls. Replace with Clerk for identity and a Stripe Payment Element (Apple Pay enabled) for the purchase, then check the entitlement server-side before try-on and DNA endpoints run. The plan shape (one membership, $9 a month) and the price are placeholders.
- **Share** (`src/a/ui/ShareSheet.tsx`, `src/a/lib/card.ts`, `src/a/lib/share.ts`): from the results. Draws a 1080 x 1920 story card on a canvas (print, PRAXIS, eyebrow, title, the stylist's note, the address) and hands it to the phone's share sheet (Instagram stories, WhatsApp, Messages); on a computer it saves the image. "Ask a friend to choose" shares the results link with a question (WhatsApp on a computer). Every shared link is tagged with `via` (story, friend or link) and `utm_source=praxis`, `utm_medium`, `utm_campaign=shared_look`, so any analytics tool added later can count visits per channel. A visitor arriving on a tagged link sees the shared view of the results: a "Shared with you" note and "Get your own looks" as the main button, with Check out and Share kept. Starting a journey drops the tags. Shares are counted as `look_shared` (see Analytics).
- **Check out** (`src/a/ui/PiecesSheet.tsx`, `src/a/lib/selection.ts`, `src/core/retail.ts`): every piece carries a box, all chosen at first except sold-out ones; the customer unticks what they do not want, the total follows, and the sheet asks a size per piece. Stock reads "Stock not confirmed" unless the retailer confirms it; delivery shows only when the retailer gives it. A "Buy at" button appears only for a piece with a real purchase route (retailer site or affiliate link); the example pieces have none, so the button says "Buying isn't open yet". Nothing is ordered. Replace `createMockRetailer` with a `RetailerAdapter` that returns sizes, stock and a `PurchaseRoute`.
- **Looks and pieces** (`src/core/adapters/mock.ts`): the fifteen catalog outfits in `src/lib/outfitLibrary.ts` with invented houses and example prices inside the chosen budget; every price is marked `example` and every stock level `unknown`, and the screens say so. Replace with the vendor catalog behind an adapter.
- **Try-on**: in preview. It shows the look on a model, says so ("On a model, not you. Try-on is in preview."), and asks for no photo. Replace with the rendering pipeline, then ask for the photo again.
- **Colour analysis** (`src/core/vision.ts`, `mockColourAnalysis`): returns the same sample estimate for every photo, marked `source: "sample"`, and the screens call it an example while analysis is in preview. Replace with a `ColourAnalysisAdapter`.
- **Images**: `public/images/*.jpg` (catalog looks) and `src/assets/styles/*.jpg` (inspiration presets).

## Recommendation architecture

`src/core` holds everything that is not UI and imports no React. The screens never build looks themselves:

1. `request.ts` turns the answers in the URL, the piece the customer owns and their Style DNA id into a `StylingRequest` (`contracts.ts`, version 1.0). Every answer is in it, budgets as numbers. `inputKey` names the inputs; feedback is sent as `preferences` but is not part of the key.
2. `service.ts` hands the request to the configured adapter (`RecommendationAdapter`: `id`, `version`, `recommend(request)`), validates whatever comes back (`validate.ts`) and records both in the request history. An adapter that throws or answers nonsense becomes a `failed` response; a malformed look is dropped and the answer marked `partial`, never padded.
3. `src/a/lib/styling.ts` sends one request per set of inputs and reuses the stored answer on reload or Back. The build, results, try-on and saved looks read the same response, so a look keeps its `recommendationId`, `requestId` and `outfitId` everywhere.
4. `src/a/lib/looks.ts` (`toLook`) maps an `OutfitRecommendation` to what the screens draw. Rank 1 is "My pick".

Garments are either `retail` (a `ProductRef` with price, price status and stock) or `wardrobe` (a piece the customer owns, never in the total). Visualizations say what they are: a product photo, a styled image, or a try-on, and whether they are exact or representative. Only an adapter other than the mock can answer in `personalized` mode.

## Processing states

`src/core/processing.ts` is the one state machine for a styling request: idle, validating, submitted, processing, delayed (after 5 s: "This is taking a little longer than usual."), partial, completed, empty, failed ("I couldn't put your looks together this time." with Try again), retry requested, retry exhausted (after 3 tries, or at once when the failure cannot be retried) and cancelled. A request times out after 20 s. The build (`src/a/screens/moment/Build.tsx`, `useStylingRun` in `src/a/lib/styling.ts`) shows only the state it is in: a moving line while working, never a percentage or a timed stage. Cancel stops it and keeps the answers; an answer arriving after a cancel is ignored.

## Test mode

`/internal/analytics` has a Test mode row: fast, slow, timeout, API failure, partial, empty, invalid image and unavailable products (`src/core/sim.ts`). It lasts for the tab only, shows a "Test mode" strip on every screen, and marks every event `testMode` so the measures leave them out. Invalid image applies to the Style DNA colour analysis; unavailable products marks the shoes sold out.

## Photos and privacy

`src/core/images.ts` holds one policy per kind of photo: face for colour, body for fit, a piece the customer owns, and try-on. Each says why it is needed, how it is used, where it is processed, whether it leaves the device, how long it is kept and how to delete it, the formats and size it accepts, and its consent version. The notice before a photo (`src/a/ui/PhotoConsent.tsx`) is drawn from that policy, so it always matches what the app does. Today the face and owned piece photos stay in the tab and are not analysed by a model; body and try-on photos are not collected. Each photo is checked for type, size, dimensions and light before it is used. A photo can be deleted on its own from `/data` or the Style DNA photo step, and "Delete everything" removes the photos and withdraws consent. The notice wording must be approved by legal counsel before real photo processing goes live.

`src/core/vision.ts` has the adapters for colour analysis, garment recognition, outfit visualization and try-on, each with mocks. Every generated image carries its id, outfit, source pieces, provider and version, status, size, storage reference, creation time and retention. Adapters that cost money declare `billable`, and `guardBillable` refuses them unless `VITE_ALLOW_BILLABLE_IMAGES=true`; it is off by default, and no billable adapter exists yet.

## Style DNA profile

`src/core/styleProfile.ts`: undertone, contrast, fit and week each keep the estimate, the customer's confirmation and their correction separately. The value used is the correction, then the confirmation, then the estimate. A new photo replaces only the estimate, never a correction. The profile has an id and a version; requests send `profileId_vVersion` and a summary of the values with their basis. Old saved Style DNA is migrated and its portrait dropped.

## Retention

`src/core/data.ts` lists every key Praxis keeps (`STORES`) and how long: request history, events and chosen looks 90 days, feedback 365 days, the rest until deleted. Old entries are pruned when the app starts. `/data` shows them in plain words; `/internal/analytics` lists them with their retention.

## Analytics

`src/core/analytics.ts` is a closed dictionary: each event has a category, a trigger and typed properties. `track()` refuses unknown events or properties, missing or mistyped values, and any string over 160 characters or containing `@`, `data:`, `blob:` or `base64`, so no email, photo or face data can be recorded. Each event carries an event id, time, the anonymous id, the account id when signed in, the journey and the app version. Events go to every sink registered with `addSink`; today the only one is local storage, viewable at `/internal/analytics` (download as JSON, or clear). Adding a real analytics tool is one sink.

## Accounts and saved looks

Saving needs no account. A guest's looks belong to the anonymous id; after saving, the guest is offered to sign in and sync, once, and can close it. Signing in moves this browser's guest looks and feedback onto the account (`src/core/account.ts`): a look saved both ways is kept once, and another account's looks are never touched or shown.

## Brand and element rules

Atelier (ivory and charcoal, after the stylist reference) with the Hairline element system. Tokens live in `src/a/a.css` under `[data-mode="light"]` and `[data-mode="dark"]`. One ink, no other hues.

| Role | Light | Dark |
|---|---|---|
| Background (ivory) | `#F1EDE1` | `#12110F` |
| Surface | `#E8E3D6` | `#1B1A17` |
| Text | `#1E1D1A` | `#EEE9DD` |
| Muted | `#6B665C` | `#9C978C` |
| Rule | `#DCD5C6` | `#2A2824` |
| Accent (charcoal ink) | `#1E1D1A` | `#EEE9DD` |
| Accent tint | `#E4DED0` | `#24221E` |

Type: Playfair Display 400 for the question, the home headline, the look title, answer choices and piece names (38 px on mobile, 52 px on desktop for display); Geist 400 and 500 for everything else; small labels (step count, eyebrows, piece houses) in 11 px tracked capitals (`.a-label`); Geist Mono for prices. Body text 16 px on mobile, 15 px on desktop. Fonts load from Google Fonts in `src/shared/fonts.ts`; self-host them for production.

Layout: on desktop the split is half and half, the bar floats over it so the print runs the full window height, and the question block sits centred in its half (max 440 to 520 px). Header: the PRAXIS wordmark in tracked capitals (centred on mobile, left on desktop beside the progress spine) and a menu icon; the spine shows on desktop only. On a phone, home sets the occasions two to a row. An empty portrait print shows a hairline oval. Every page except the result pages (results, try-on, a saved look) fades its photo into the page: full-bleed prints fade from the left edge on desktop and the bottom edge on a phone, framed prints soften on every edge. Result pages keep the hard lookbook edge (`book` on `Frame`). Results on desktop run the print full bleed with the three looks as an index on its right edge (on a phone or tablet they stand beside the print, so it keeps the band's full height); the look's why reads as the stylist's note in the serif italic, and "Get the pieces" is an outlined control beside the primary on desktop.

Imagery: with nothing under it, the print runs full bleed across the canvas like a lookbook page; results keep the framed print with thumbnails. Motion: fades 0.7 s, page entry 0.6 s, moving between looks 0.3 s (the photo glides 32 px from the side it came from while the column fades), reduced motion respected. The desktop column keeps 16 px of room under its last line (padding with a matching negative margin) so serif descenders are never clipped by its scroll box.

Control rules (`src/a/ui/controls.tsx`, `a.css`): every control is 44 px tall with text centred by the box; label 15 px medium and hint 13 px muted on one baseline, 8 px apart; 2 px corners on controls, 0 on the print and sheets; 1 px rule borders; selected is ink fill; hover is surface fill; pressed scales to 0.98; focus is a 2 px accent ring with a 2 px gap. Prices are tabular figures on one right edge. The active thumbnail carries a 2 px accent underline flush to its width, 6 px below. Everything sits on an 8 px grid with 48 px desktop and 20 px mobile gutters.

Layout rules: on phones the primary action is pinned at the bottom of the column under one rule and is never below the fold; on desktop the action row follows the content under the same rule, so it sits where the eye already is; the print is sized from the available height; the stage is capped at 1600 px wide. On phones the print band is 40% of the viewport while answering and 50% on results and try-on. Verified at 1440x900, 1920x1080, 2000x1120, 1280x720, 390x844 and 375x667.

Motion is `motion/react` only, transform and opacity only, and every animation respects `prefers-reduced-motion`.

## Tests

`npm test` runs the unit tests in `src/core/__tests__`. `npm run build && npm run e2e` runs the twelve customer scenarios, accessibility, layout and load checks in Chromium on desktop and phone (`e2e/scenarios.mjs`); results go to `e2e/results`. See `docs/testing-report.md`.

## Documentation

`docs/architecture.md` (with the diagram), `docs/api-contracts.md`, `docs/data-schemas.md`, `docs/analytics.md`, `docs/privacy.md`, `docs/integration-dependencies.md`, `docs/testing-report.md`.

## Structure

```
src/main.tsx            mounts ConceptA at /
src/a/ConceptA.tsx      root: theme, fonts, routes
src/a/screens/          home, moment/*, dna/*, looks, you
src/a/ui/               Stage, Frame, Thumbs, controls, TopBar, Gate, sheets
src/a/lib/              journey context, spine, looks, styling, dna, user, mode, image, stream
src/core/               contracts, request, validation, service, processing, retail, images, vision, style profile, data, test mode, mock adapter, identity, feedback, analytics, accounts (no React)
src/core/__tests__/     unit tests
src/a/a.css, a-layout.css   tokens and layout
src/shared/             catalog, fonts, store
src/lib/outfitLibrary.ts, src/types/praxis.ts   catalog source
```

## Home

`src/a/screens/Home.tsx` is a page that scrolls, not a split. Hero: "Your personal stylist", the headline with "Every time." in italic, one line ("Choose your occasion, answer four quick questions, and I’ll show you three looks for it."), then the occasions as photographs (`src/a/ui/OccasionCards.tsx`): three then two on desktop, two to a row with Party across the width on a phone; the name in the serif over a soft shade, an arrow, a slight zoom on hover. The card classes carry `a-transition` so the lab rule in `src/index.css` does not switch their transitions off. Beside it (under it on a phone), `src/a/ui/HomeDemo.tsx` plays the demo film: no controls, muted, looping, only while on screen; the poster (the three looks) shows while it loads, if it cannot play, and instead of it when motion is reduced. Below: How it works in three steps, then Style DNA on a deeper stone (`--stone`) with a photograph of tailoring cloth, a Premium tag and "Explore Style DNA".

The home photographs live in `public/images/home` as WebP at 480 and 960 wide, cropped for the cards; sources are listed in `public/images/home/CREDITS.md` (Unsplash, free license). To swap one, replace both widths under the same name.

The demo film (8.5 s, 30 fps) is rendered from `video/hero-demo`: `scene.html` and `scene.js` draw the journey as a timeline from the app's own photos, type and copy (choose Dinner, the build with its status line, the three dinner looks, open Elevated Dinner as the results page shows it (my pick for dinner: the print with its counter and glass chips, the index beside it, the summary line, the note and pieces), back to the three, then the occasions again so the loop has no cut). `node video/hero-demo/render.mjs` steps through it frame by frame in Chromium and writes `public/media/praxis-hero-demo.mp4` (1080 x 1170) and `praxis-hero-demo-mobile.mp4` (720 x 900, larger type for phones), each with a WebM and a WebP poster, and `praxis-hero-demo-device.mp4` (720 x 1560, a phone screen with the PRAXIS bar, in the warmer palette) for the phone in the homepage composition. `--stills 0,4.9,6.5` writes single frames to `video/.frames` for checking instead. Re-render whenever the home cards, the looks or the results change visibly; no vendors or prices appear in it.

## Restyle

"Restyle" (in the pinned action row) on the results opens a sheet with the answers that change the looks: the feel, the budget, the occasion (each shows the current answer), and "Start a new look". Picking one opens that question with `restyle=1`; the answer goes straight back to the looks (a new occasion asks the place first). The PRAXIS wordmark always starts a fresh journey. On desktop the bar is 80 px with a 22 px wordmark; Saved looks, Style DNA and Sign in sit top right straight on the photo, in ink with a soft ivory halo so they read over dark photos too, and the menu button is phone only. Starting over is always called "Start a new look"; the saved page is "Saved looks".

Time of day offers sunrise and sunset only where they fit the occasion (`timesFor` in `src/shared/catalog.ts`); they warm the photo (`golden` on Frame), night darkens it. Check out lists the pieces ticked on the page with a size for each; it confirms no stock, delivery or order the retailer has not given.

## Phones and iOS Safari

- Under 1024 px the page itself scrolls, never a box inside it: the photo band takes a fixed share of `100svh` (so it does not jump when Safari's toolbar hides), the top bar sticks to the top and the action row sticks to the bottom (`a-layout.css`, the max-width 1023 px block). Desktop keeps the fixed split.
- `html, body` clip sideways overflow and do not bounce past their edges (`src/index.css`).
- Text fields are 16 px; anything smaller makes iOS zoom the page on focus.
- Sheets, the gate, the menu and the full-screen look hold the page still while open (`src/a/lib/scrollLock.ts`); their own content scrolls with `overscroll-behavior: contain`.

## Known gaps

- "New moment" lives in the overlay menu on mobile; the spine fills the bar.
- The Dinner mood image is the same file as the Dinner "sharper" look, so one preview swap shows no change.
