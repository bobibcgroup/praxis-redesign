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

- **Style a moment**: occasion, venue, day or night, feel, spend, an optional "You" step (face by camera, upload or sample; one owned item by slot), a guided build, three looks with the hero in the print and three thumbnails beneath, try-on, save, share, get the pieces.
- **Style DNA**: face, fit, lifestyle, up to two inspiration presets, a guided build, and a plain-language result (undertone, contrast, palette, one line of advice). Saving it changes the home so a returning user starts on the occasion chips.
- **Looks**: saved looks as a horizontal rail; open, remove.
- **Style DNA**: the saved Style DNA, start again, sign out, light or dark.

Full concept spec: `docs/CONCEPT-A.md`.

## Routes and state

Mounted at `/`. Step routes:

```
/                                   home (first visit, or returning with DNA)
/moment/occasion  /moment/venue  /moment/time  /moment/feel  /moment/spend
/moment/you  /moment/you/face  /moment/you/item
/moment/build  /moment/results  /moment/tryon
/looks  /looks/:id
/dna  /dna/face  /dna/fit  /dna/lifestyle  /dna/inspiration  /dna/build  /dna/result
```

Answers travel in search params so reload restores any step: `occasion, venue, time, vibe, spend, face, item, hero, done, mode`; DNA: `face, fit, life, taste`. The gate popup uses `?gate=tryon|dna|save|buy|signin`.

Browser storage (prototype only, replace with real persistence):

| Key | Holds |
|---|---|
| `praxis_lab_a` | saved looks and the saved DNA (`src/shared/store.ts`) |
| `praxis_lab_a_user` | `{ name, email, plus }` for the sign-in and Plus previews (`src/a/lib/user.ts`) |
| `praxis_lab_a_mode` | `light` or `dark`; light is the default |
| `praxis_lab_a_face`, `praxis_lab_a_item` | captured images for the session (sessionStorage) |

## What is a stand-in

- **Sign-in and payment** (`src/a/ui/Gate.tsx`, `GateSteps.tsx`): visual previews of Apple, Google and email sign-in, and of a "Praxis Plus" purchase with Apple Pay or card. No Clerk or Stripe calls. Replace with Clerk for identity and a Stripe Payment Element (Apple Pay enabled) for the purchase, then check the entitlement server-side before try-on and DNA endpoints run. The plan shape (one membership, $9 a month) and the price are placeholders.
- **Looks and pieces** (`src/shared/catalog.ts`): built from the fifteen catalog outfits in `src/lib/outfitLibrary.ts` with invented vendors and prices. Replace with the vendor catalog.
- **Guided build** (`src/shared/guided.ts`): fixed, named stages with fixed durations. Keep the stage names and drive the progress from real backend events instead of timers.
- **Try-on**: the shared stand-in portrait with a different crop. Replace with the rendering pipeline; keep the wipe, the "Here’s how it looks on you" caption and the note.
- **DNA result**: `SAMPLE_TONES` for every capture. Replace with the face pipeline.
- **Images**: `public/images/*.jpg` (catalog looks) and `src/assets/styles/*.jpg` (inspiration presets).

## Brand and element rules

Forest and Bone with the Hairline element system. Tokens live in `src/a/a.css` under `[data-mode="light"]` and `[data-mode="dark"]`.

| Role | Light | Dark |
|---|---|---|
| Background (bone) | `#EFEAE0` | `#121614` |
| Surface | `#E4DED2` | `#1A201C` |
| Text | `#1B1F1C` | `#ECE7DC` |
| Muted | `#5A5E56` | `#9A9B95` |
| Rule | `#D0C9BA` | `#263029` |
| Accent (forest) | `#1F3A2E` | `#7FB090` |
| Accent tint | `#DBE4DB` | `#1F2E26` |

Type: Source Serif 4 at 600 with optical sizing for the question, the home headline and the look title only; Geist 400 and 500 for everything else; Geist Mono for prices, stage names and counts. Body text 16 px on mobile, 15 px on desktop. Fonts load from Google Fonts in `src/shared/fonts.ts`; self-host them for production.

Control rules (`src/a/ui/controls.tsx`, `a.css`): every control is 44 px tall with text centred by the box; label 15 px medium and hint 13 px muted on one baseline, 8 px apart; 2 px corners on controls, 0 on the print and sheets; 1 px rule borders; selected is ink fill; hover is surface fill; pressed scales to 0.98; focus is a 2 px accent ring with a 2 px gap. Prices are tabular figures on one right edge. The active thumbnail carries a 2 px accent underline flush to its width, 6 px below. Everything sits on an 8 px grid with 48 px desktop and 20 px mobile gutters.

Layout rules: the primary action is pinned at the bottom of the column under one rule and is never below the fold; the print is sized from the available height; the stage is capped at 1600 px wide. On phones the print band is 40% of the viewport while answering and 50% on results and try-on. Verified at 1440x900, 1920x1080, 2000x1120, 1280x720, 390x844 and 375x667.

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
