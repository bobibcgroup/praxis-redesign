# Testing report

Deliverable G of the master spec. Three layers of tests cover the app. All of them run without a server, an API key or a billable service.

| Layer | Command | What it covers | Result |
| --- | --- | --- | --- |
| Unit | `npm test` | `src/core`: request building, validation of adapter answers, the mock adapter, the service with timeouts, cancel and the retailer lookup, processing states, feedback, accounts and migration, identity, analytics guards, photo policies and checks, consent, Style DNA layers, retention and deletion | 204 tests in 13 files, all pass (2026-10-12) |
| Type and build | `npm run build` | strict TypeScript and the production bundle | passes |
| Scenarios | `npm run build && npm run e2e` | thirteen suites (below) in Chromium on desktop (1440 x 900) and phone (390 x 844), seven viewports from 375 x 812 to 1920 x 1080, axe (WCAG 2.1 A and AA), 44px targets, sideways scroll and load | 174 of 174 runs, 1648 of 1648 checks pass, twice in a row (2026-10-12) |

`npm run e2e` starts the app's own server (`server/index.mjs`) itself (or uses `BASE_URL`), needs a Chromium that Playwright can find (`PLAYWRIGHT_BROWSERS_PATH`, or `CHROMIUM_PATH`), writes `e2e/results/report.md`, `report.json` and screenshots, and exits non-zero on any failure. `SUITE=4 npm run e2e` runs one suite (or `SUITE=4,11`); `ONLY=TRY1,P3-4a npm run e2e` runs single scenarios. Scenarios that need a misbehaving service use test mode (`src/core/sim.ts`), set per tab, so nothing in the app changes for them.

## The thirteen suites (Phase 3)

Each suite is a file in `e2e/suites/` (`01-home.mjs` to `13-analytics.mjs`), loaded by `e2e/scenarios.mjs`. Older scenarios belong to the suite they cover (S1 to suite 2, TRY to suite 4 and so on), so the report's per-suite table counts every run.

| # | Suite | What it covers |
| --- | --- | --- |
| 1 | Homepage and occasion selection | five occasion cards, each routes to the right first question; country photos by lookup, by manual choice and the fallback |
| 2 | Style a moment | every answer and the owned piece reach the request; browser Back keeps answers; incomplete or invalid answers never send; every occasion gives valid looks |
| 3 | Outfit results | switching by thumbnail, swipe and keys updates title, photo, pieces and total; unticking lowers the total; empty selection blocks Check out with the reason; viewer zoom and Escape; Restyle; nothing stale |
| 4 | See it on me | explanation, privacy, consent and decline, camera (fake device) and upload, text file and broken JPEG refused, preview, retake, close and reopen, the right outfit sent, timeout then retry, unreadable photo, honest label, photo kept to the tab |
| 5 | Style DNA | intro, sign in, preview payment with no charge, the four steps, profile, corrections, saved per account, used in the next request, consent for an own photo |
| 6 | Digital wardrobe | an uploaded piece is classified as the customer says, invalid files refused, changing the piece, owned never priced, deleting everything from Your data |
| 7 | Saved looks and accounts | guest save, reload, reopen, remove and undo, migration on sign in, shared link opened elsewhere, separation between accounts |
| 8 | Retailer and checkout preparation | sizes, stock, sold out, the Check out total, external link only when a retailer gives one (https only), no purchase is ever made |
| 9 | Failure and recovery | slow, timeout, empty, partial, failure, invalid answer, offline, expired sign in, cancel; answers kept every time |
| 10 | Responsiveness | 375 x 812, 390 x 844, 430 x 932, 768 x 1024, 1024 x 768, 1440 x 900, 1920 x 1080: nothing sideways, off screen, covered or clipped, 44px targets, readable text |
| 11 | Accessibility | full keyboard journey, focus kept inside dialogs and returned on close, Escape, axe on more states and in dark mode, alt text and labels, reduced motion |
| 12 | AI integration contracts | the contract unit tests per service; the server plug-in points answer not connected and refuse bad requests; no key or provider address in the page; a whole session sends nothing to an AI service |
| 13 | Analytics | every required event once, with event id, time, anonymous id, account id and version, and no email, photo or Style DNA values |

Defects the suites found and that were fixed in Phase 3: browser Back lost an answer (P3-2b); a non-https retailer link got a Buy button (P3-8c); sheets and the phone menu let focus leave the dialog, and the menu did not return focus (P3-11b); a sheet's scrolling body was not reachable by keyboard (P3-11c).

## Scenarios (spec section 22)

| # | Scenario | How it is checked | Status |
| --- | --- | --- | --- |
| 1 | First-time visitor | fresh profile, Dinner, four answers: one request, three looks, looks say they are examples | passed |
| 2 | Different context | restaurant at night vs a friend's home at sunset: venue, time and request key differ, first look differs | passed |
| 3 | Recommendation rejection | Not for me, Too formal: one feedback record with reason, recommendation id and look id | passed |
| 4 | Guest saving | save without signing in, reload: the look is still saved | passed |
| 5 | Account conversion | save as guest, sign in (preview): the look moves to the account, `account_migrated` recorded | passed |
| 6 | Style DNA correction | sample photo, change undertone to Warm, save, reload: correction stored apart from the estimate and shown as Your correction | passed |
| 7 | Unreadable image | (a) a very dark upload is refused before use with the reason, not stored, sample still offered; (b) test mode "photo can't be read": Retake or Skip colours, skipping carries on | passed |
| 8 | AI timeout | test mode timeout: delay line after 5 s, no percentage, Cancel offered, then the failure with Try again and Change my answers; Try again reaches the looks | passed |
| 9 | Partial results | test mode two looks: results say "I found 2 looks this time", answer marked partial, Check out works | passed |
| 10 | Retailer unavailable | test mode sold out: the piece reads Sold out and cannot be ticked, the buy button is disabled, no retailer link, no order | passed |
| 11 | Mobile experience | 390 px: full journey, sideways swipe to the next look, tap to enlarge, zoom, close on the same look, save, Back, no sideways scroll | passed |
| 12 | Analytics integrity | one anonymous id, unique event ids, one request and one results view also after a reload, one save event, events carry their recommendation id, no photo data, nothing recorded that did not happen | passed |

## Added since (Stage 1 and Phase 2)

| Scenario | What it checks |
| --- | --- |
| ISO1 to ISO3, DATA1, FULL1, TABS1, SAVE2, PARAMS1 | accounts and guests never see each other's looks, Style DNA, history or feedback; sign out clears the tab; two tabs keep both saves; a failed save says so |
| TRY1 to TRY7 | the full See it on me journey on 375, 390, 430, 768 and desktop: consent, camera or upload, checks, preview, submit, answer, retry, cancel, delete |
| P2A, P2B | a service that fails once recovers on Try again; an answer that breaks the contract becomes a clean failure |
| P2C | a full journey with try-on makes no call to any AI, image or retailer service (only fonts load from outside) |

Unit tests for the nine AI service contracts and their eight mock scenarios: `src/core/__tests__/ai-services.test.ts`; request integrity and the engine's use of Style DNA, feedback and budget: `phase2-integrity.test.ts`.

Nothing is blocked. Scenarios 5 and 10 test the previews of sign-in and the retailer, because the real services do not exist yet (see `docs/integration-dependencies.md`).

## Last run

2026-10-12 09:00 UTC, against a local production build, Chromium (Playwright 1.56.1): 174 of 174 runs passed, 1648 of 1648 checks, none skipped. The run before it (08:34 UTC) gave the same result. Every check is listed in `e2e/results/report.md`.

| Suite | Runs | Checks |
| --- | --- | --- |
| 1 Homepage and occasion selection | 34 | 270 |
| 2 Style a moment | 16 | 89 |
| 3 Outfit results | 21 | 116 |
| 4 See it on me | 17 | 124 |
| 5 Style DNA | 13 | 59 |
| 6 Digital wardrobe | 4 | 23 |
| 7 Saved looks and accounts | 24 | 77 |
| 8 Retailer and checkout preparation | 6 | 35 |
| 9 Failure and recovery | 13 | 43 |
| 10 Responsiveness | 10 | 557 |
| 11 Accessibility | 9 | 97 |
| 12 AI integration contracts | 5 | 123 |
| 13 Analytics | 2 | 35 |

Load: desktop largest paint 196 ms; phone (throttled to 150 ms, 1.6 Mbit/s) 2448 ms; no layout shift.

## Fixed during the master spec Phase 3

- Colour contrast: the Style DNA section on the home page and the upcoming steps in the top bar were below 4.5:1; both now pass.
- List markup: the look thumbnails and the Your data list now use valid list semantics for screen readers.

## Not covered

- Real devices and Safari: the suite runs in Chromium only. A real camera, HEIC photos from an iPhone and iOS Safari need a check on a real phone; the camera tests use Chromium's fake camera, which proves the page's handling, not a device's camera. iOS Safari behaviour (toolbar, scroll locking) was checked by hand earlier, see README "Phones and iOS Safari".
- The deployed site: the Railway address is not reachable from the build machine, so the suite runs against a local production build of the same commit.
