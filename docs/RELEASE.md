# Release 0.4.0 (Phase 4)

This release brings Phases 2, 3 and 4 to the live site. It is built on the last live version, commit `d270831`, which is kept as the branch `release/0.3.0-last-good` so that it can be restored. This release is the branch `release/0.4.0`.

## Changes implemented

**Phase 2: one service layer for every AI capability.**
- Nine typed contracts, deterministic mocks with eight scenarios, a page-to-server bridge and a server plug-in point (`POST /api/ai/<service>`). All of them are off. See `docs/AI-SERVICES.md`.
- Request integrity: every answer, the owned piece, the Style DNA and the feedback reach the request.
- Fixes:
  - The rules engine now uses Style DNA, feedback and budget.
  - "My pick" follows the ranking.
  - "$0" no longer shows as "Owned".
  - Copy no longer claims sync or photo colour reading.

**Phase 3: thirteen end-to-end test suites.** Defects fixed:
- Browser Back lost answers.
- A non-https retailer link got a Buy button.
- Keyboard focus could leave the sheets and the phone menu, and the menu did not return focus.
- A sheet's scrolling area couldn't be reached by keyboard.

**Phase 4:**
- **Wardrobe** (`/wardrobe`, in the menu and the desktop bar).
  - Add a piece by type, name and colour, with an optional photo (consent, file and quality checks). Correct it, remove it and undo, or use it in a set of looks.
  - Make it yours on the results offers wardrobe pieces first.
  - Each account sees only its own pieces.
  - A photo stays in the tab only. Owned pieces are never priced.
  - Recognition goes through `garment_recognition`, which reads the photo's main colour on the device.
- **Desktop bar.** With Wardrobe added, the links sit on the same frosted ivory panel as the look thumbnails, so they stay readable over the photo. Below 1280 px wide, Saved looks shows as its bookmark only (its name is still read out), so the bar clears the step names.
- **Test mode hidden.** `/internal/analytics` is no longer in the live build. It is in `npm run dev`, or in a build made with `VITE_INTERNAL_PAGE=true`. On the live site the address leads home.
- **Error monitoring, with no outside service.**
  - Errors that reach a customer are sent to `POST /api/client-error`: a page that fails to draw, an uncaught error, or an unhandled promise. A report carries the error's name, where it happened, the path without its query, and app stack frames. It never carries the message.
  - The server writes each error as one JSON line in the Railway log. Server errors are logged too.
- **Health check.** `GET /api/health` reports the version, the deployed commit, and that no AI or try-on provider is on.
- **Smoke tests.**
  - `tools/smoke.mjs` checks a deployed site without changing anything.
  - `.github/workflows/smoke.yml` runs it after every successful Railway deploy, and on demand.

## Defects corrected

| Defect | Phase | Severity |
| --- | --- | --- |
| Style DNA, feedback and budget ignored by the engine | 2 | P1 |
| Copy overclaimed sync and colour reading | 2 | P2 |
| "$0" shown as Owned; zoom cue; My pick by position | 2 | P3 |
| Browser Back lost an answer | 3 | P1 |
| Non-https retailer link offered as Buy | 3 | P1 |
| Focus escaped dialogs; menu did not return focus | 3 | P2 |
| Sheet scroll area not reachable by keyboard | 3 | P2 |
| No wardrobe, and owned pieces could only be deleted all at once | 4 | product gap, now added |
| Test mode page reachable by anyone | 4 | P2, now hidden |

## New service interfaces and mock providers

- Nine services, each with a mock: `styling_recommendation`, `styling_explanation`, `outfit_visualization`, `virtual_try_on`, `face_colour_analysis`, `body_fit_analysis`, `garment_recognition`, `product_matching` and `inventory_pricing`. The full handover is in `docs/AI-HANDOVER.md`.
- Server endpoints:

  | Endpoint | What it does |
  | --- | --- |
  | `POST /api/ai/<service>` | Answers "not connected" |
  | `POST /api/tryon` | Answers "no provider" |
  | `GET /api/health` | New: version, commit, provider state |
  | `POST /api/client-error` | New: error reports |

## Database changes

There is no server database. Everything is in the browser, and every change is additive, so the previous version reads the new data safely.

| Key | Where | Change |
| --- | --- | --- |
| `praxis_wardrobe` | device | Entries may now have `colour`, `updatedAt` and source `described`. The previous version only counts these entries, so a rollback is safe. |
| `praxis_wardrobe_photos` | tab | New: photos of wardrobe pieces, at most 8, gone when the tab closes. |
| `praxis_errors_sent` | tab | New: which errors this tab has reported (names only). |

There are no migrations. The store `praxis_lab_a` stays at version 2.

## New tests

| Layer | Before | Now |
| --- | --- | --- |
| Unit | 204 | 210 (`phase4.test.ts`: wardrobe records, error reports) |
| e2e | 107 runs | 13 suites. Phase 4 adds P4-6d to P4-6f (wardrobe) and P4-12e (hidden test mode, health, error reports). The wardrobe is also in the layout check at seven sizes and in the accessibility checks. |

Smoke tests: `tools/smoke.mjs`.

## Remaining integration dependencies

Each one needs your approval before it is switched on:
- Gemini, or another engine, for styling.
- Image generation.
- A try-on provider.
- Colour, fit and garment recognition providers.
- Retailer feeds.
- A real sign-in and payment provider. You decided against sign-in for now.
- Server storage for accounts.
- Legal sign-off on the photo wording.

## Known limitations

- Sign-in is a stand-in with no password. Accounts are kept apart on one device, but anyone typing an address opens that account. You chose to leave this for now.
- Data lives on the device only. Saved looks, the wardrobe and Style DNA do not follow a customer to another device.
- Every AI capability is a mock:
  - Looks come from a rules engine.
  - Prices are examples, and stock is unknown.
  - The colour reading is a fixed example.
  - Try-on and outfit pictures are not generated.
  - Pieces are not recognised from photos.
- No purchase can be made. Check out prepares the pieces, and a retailer link opens only when a retailer provides an https one.
- Tested in Chromium only. A real camera, iPhone HEIC photos and iOS Safari still need a check on a real phone.

## Deploying

Railway builds the root `Dockerfile` from the ECR Node 22 image on every push to `main`, then runs `npm run start` (`server/index.mjs`). The live URL is https://praxis-redesign-production.up.railway.app.

Environment, all optional and all off by default:

| Variable | Where | Purpose |
| --- | --- | --- |
| `PORT` | server | Set by Railway |
| `COUNTRY_HEADER` | server | A trusted country header from a proxy |
| `AI_PROVIDER_<SERVICE>`, `ALLOW_BILLABLE_AI` | server | AI providers and paid calls (`off` switches a free provider off) |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | server | The free stylist's words (Gemini free tier, text only); unset means the rules engine's words |
| `TRYON_PROVIDER`, `ALLOW_BILLABLE_IMAGES` | server | Try-on provider and paid images |
| `VITE_AI_PROVIDERS`, `VITE_TRYON_ADAPTER`, `VITE_ALLOW_BILLABLE_IMAGES` | build | Page switches |
| `VITE_INTERNAL_PAGE` | build | Shows the test mode page. Never set it on the live site. |
| `RAILWAY_GIT_COMMIT_SHA` | server | Set by Railway, shown by `/api/health` |

API credentials:
- None are set or needed today.
- When a provider is approved, its key goes in Railway's service variables and is read only by its module in `server/providers`.
- The page never holds a key. Suite 12 and the smoke test check the shipped JavaScript for keys.

## Monitoring

In Railway, open Project, then Deployments, then View logs, and search for `client_error` or `server_error`. Each line is JSON with the error's name, where it happened, the path and the release. It carries no IP, address, message or photo. Reports are capped at 5 per tab and 60 per minute on the server.

## Rollback

1. **Fastest.** In Railway, go to Deployments, find the previous successful deployment, and choose Redeploy. Nothing in the repository changes.
2. **From the repository:**
   ```
   git revert --no-edit origin/release/0.3.0-last-good..origin/release/0.4.0
   git push origin main
   ```
   Railway deploys the reverted main. The branch `release/0.3.0-last-good` marks the last version before this release; in an emergency `git push --force-with-lease origin origin/release/0.3.0-last-good:main` puts it back exactly, but that rewrites main, so prefer 1 or the revert.
3. **Data.** No server data exists, and browser data is backward compatible (see Database changes), so nothing needs undoing.
