# Praxis redesign: Concept A ("Stage")

The approved front-end direction for Praxis, extracted as a standalone React app so it can be built into the product. Everything in here is UI: journeys, states, motion, copy and tokens. Data, auth, payment and image generation are stand-ins to be replaced.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build to dist/
npm start          # serve dist/ (used for the preview host)
```

Node 22 or newer.

## What it is

One full-viewport stage. The left column asks one question at a time; the right column is a living 3:4 print that previews the occasion, darkens for night, ghosts the chosen feel, builds the three looks in place, holds the result, and wipes to the try-on. Nothing routes away from the stage; every step is a URL so Back and reload work.

Journeys:

- **Style a moment**: occasion (chosen on home), venue, day or night, feel, spend, a guided build, then the looks first: three looks with the hero in the print and three labelled thumbnails beside it (beneath on a phone, where a tap opens them full screen to swipe left, right and down). The results offer "Make it yours": see it on me (face by camera, upload or sample, then the try-on) or use something I own (one item by slot, then the looks rebuild around it). Then try-on, save, share, check out (every piece ticked by default with a live total, then a sheet by retailer with one Purchase action; open to everyone, no sign in).
- **Style DNA**: face, fit, lifestyle, up to two inspiration presets, a guided build, and a plain-language result (undertone, contrast, palette, one line of advice). Saving it changes the home so a returning user starts on the occasion chips.
- **Looks**: saved looks as a horizontal rail; open, remove.
- **Style DNA**: the saved Style DNA, start again, sign out, light or dark.

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
```

Answers travel in search params so reload restores any step: `occasion, venue, time, vibe, spend, face, item, hero, done, mode`; DNA: `face, fit, life, taste`. The gate popup uses `?gate=tryon|dna|save|signin`.

Browser storage (prototype only, replace with real persistence):

| Key | Holds |
|---|---|
| `praxis_lab_a` | saved looks and the saved DNA (`src/shared/store.ts`) |
| `praxis_lab_a_user` | `{ name, email, plus }` for the sign-in and Plus previews (`src/a/lib/user.ts`) |
| `praxis_lab_a_mode` | `light` or `dark`; light is the default |
| `praxis_lab_a_face`, `praxis_lab_a_item` | captured images for the session (sessionStorage) |

## What is a stand-in

- **Sign-in and payment** (`src/a/ui/Gate.tsx`, `GateSteps.tsx`): visual previews of Apple, Google and email sign-in, and of a "Praxis Plus" purchase with Apple Pay or card. No Clerk or Stripe calls. Replace with Clerk for identity and a Stripe Payment Element (Apple Pay enabled) for the purchase, then check the entitlement server-side before try-on and DNA endpoints run. The plan shape (one membership, $9 a month) and the price are placeholders.
- **Share** (`src/a/ui/ShareSheet.tsx`, `src/a/lib/card.ts`, `src/a/lib/share.ts`): from the results (and the full-screen look on a phone). Draws a 1080 x 1920 story card on a canvas (print, PRAXIS, eyebrow, title, the stylist's note, the address) and hands it to the phone's share sheet (Instagram stories, WhatsApp, Messages); on a computer it saves the image. "Ask a friend to choose" shares the results link with a question (WhatsApp on a computer). Every shared link is tagged with `via` (story, friend or link) and `utm_source=praxis`, `utm_medium`, `utm_campaign=shared_look`, so any analytics tool added later can count visits per channel. A visitor arriving on a tagged link sees the shared view of the results: a "Shared with you" note and "Get your own looks" as the main button, with Check out and Share kept. Starting a journey drops the tags. Nothing is counted yet; there is no analytics in the app.
- **Check out** (`src/a/ui/PiecesSheet.tsx`, `src/a/lib/selection.ts`): every piece carries a box, all chosen at first; the client unticks what they do not want, the total follows, and "Purchase" shows the order placed state. No payment or retailer order happens. Replace with the retailer checkout, sending only the chosen pieces.
- **Looks and pieces** (`src/shared/catalog.ts`): built from the fifteen catalog outfits in `src/lib/outfitLibrary.ts` with invented vendors and prices; prices are picked from the band the client chose so every total fits the budget. Replace with the vendor catalog, filtered by budget.
- **Guided build** (`src/shared/guided.ts`): fixed, named stages with fixed durations. Keep the stage names and drive the progress from real backend events instead of timers.
- **Try-on**: the shared stand-in portrait with a different crop. Replace with the rendering pipeline; keep the wipe, the "Here’s how it looks on you" caption and the note.
- **DNA result**: `SAMPLE_TONES` for every capture. Replace with the face pipeline.
- **Images**: `public/images/*.jpg` (catalog looks) and `src/assets/styles/*.jpg` (inspiration presets).

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

Layout: on desktop the split is half and half, the bar floats over it so the print runs the full window height, and the question block sits centred in its half (max 440 to 520 px). Header: the PRAXIS wordmark in tracked capitals (centred on mobile, left on desktop beside the progress spine) and a menu icon; the spine shows on desktop only. On a phone, home sets the occasions two to a row. An empty portrait print shows a hairline oval. Every page except the result pages (results, try-on, a saved look) fades its photo into the page: full-bleed prints fade from the left edge on desktop and the bottom edge on a phone, framed prints soften on every edge. Result pages keep the hard lookbook edge (`book` on `Frame`). Results on desktop run the print full bleed with the three looks as an index on its right edge (on a phone they stay under the print); the look's why reads as the stylist's note in the serif italic, and "Get the pieces" is an outlined control beside the primary on desktop.

Imagery: with nothing under it, the print runs full bleed across the canvas like a lookbook page; results keep the framed print with thumbnails. Motion: fades 0.7 s, page entry 0.6 s, reduced motion respected.

Control rules (`src/a/ui/controls.tsx`, `a.css`): every control is 44 px tall with text centred by the box; label 15 px medium and hint 13 px muted on one baseline, 8 px apart; 2 px corners on controls, 0 on the print and sheets; 1 px rule borders; selected is ink fill; hover is surface fill; pressed scales to 0.98; focus is a 2 px accent ring with a 2 px gap. Prices are tabular figures on one right edge. The active thumbnail carries a 2 px accent underline flush to its width, 6 px below. Everything sits on an 8 px grid with 48 px desktop and 20 px mobile gutters.

Layout rules: on phones the primary action is pinned at the bottom of the column under one rule and is never below the fold; on desktop the action row follows the content under the same rule, so it sits where the eye already is; the print is sized from the available height; the stage is capped at 1600 px wide. On phones the print band is 40% of the viewport while answering and 50% on results and try-on. Verified at 1440x900, 1920x1080, 2000x1120, 1280x720, 390x844 and 375x667.

Motion is `motion/react` only, transform and opacity only, and every animation respects `prefers-reduced-motion`.

## Structure

```
src/main.tsx            mounts ConceptA at /
src/a/ConceptA.tsx      root: theme, fonts, routes
src/a/screens/          home, moment/*, dna/*, looks, you
src/a/ui/               Stage, Frame, Thumbs, controls, TopBar, Gate, sheets
src/a/lib/              journey context, spine, looks, dna, user, mode, image, stream
src/a/a.css, a-layout.css   tokens and layout
src/shared/             catalog, guided build, fonts, store
src/lib/outfitLibrary.ts, src/types/praxis.ts   catalog source
```

## Known gaps

- At 375x667 the results column scrolls by a few pixels; the primary stays visible.
- "New moment" lives in the overlay menu on mobile; the spine fills the bar.
- The Dinner mood image is the same file as the Dinner "sharper" look, so one preview swap shows no change.
