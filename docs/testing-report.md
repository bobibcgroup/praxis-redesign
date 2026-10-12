# Testing report

Deliverable G of the master spec. Three layers of tests cover the app. All of them run without a server, an API key or a billable service.

| Layer | Command | What it covers | Result |
| --- | --- | --- | --- |
| Unit | `npm test` | `src/core`: request building, validation of adapter answers, the mock adapter, the service with timeouts, cancel and the retailer lookup, processing states, feedback, accounts and migration, identity, analytics guards, photo policies and checks, consent, Style DNA layers, retention and deletion | 204 tests in 13 files, all pass (2026-10-12) |
| Type and build | `npm run build` | strict TypeScript and the production bundle | passes |
| Scenarios | `npm run build && npm run e2e` | the twelve scenarios of spec section 22 in Chromium, on desktop (1440 x 900) and phone (390 x 844), plus accessibility (axe, WCAG 2.1 A and AA), 44px targets, sideways scroll and load | 107 of 107 runs pass (2026-10-12) |

`npm run e2e` starts `vite preview` itself (or uses `BASE_URL`), needs a Chromium that Playwright can find (`PLAYWRIGHT_BROWSERS_PATH`, or `CHROMIUM_PATH`), writes `e2e/results/report.md`, `report.json` and screenshots, and exits non-zero on any failure. Scenarios that need a misbehaving service use test mode (`src/core/sim.ts`), set per tab, so nothing in the app changes for them.

## Scenarios

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

Last run against a local production build (`vite preview`) on 2026-10-11 07:54 UTC. 30 of 30 runs passed.

| Scenario | Device | Result | Checks |
| --- | --- | --- | --- |
| S1 First-time visitor gets three looks | desktop | passed | 4/4 |
| S2 Different venue and time give a different request and looks | desktop | passed | 3/3 |
| S3 Rejecting a look as too formal stores feedback against it | desktop | passed | 3/3 |
| S4 A guest's saved look survives a refresh | desktop | passed | 3/3 |
| S5 Signing in moves a guest's saved look to the account | desktop | passed | 3/3 |
| S6 A corrected Style DNA colour is kept | desktop | passed | 4/4 |
| S7 An unreadable photo gets a way forward | desktop | passed | 4/4 |
| S7b A photo the analysis cannot read offers a retake or skipping colours | desktop | passed | 3/3 |
| S8 A slow answer, then a timeout, can be recovered | desktop | passed | 7/7 |
| S9 Two looks only: the page works and says so | desktop | passed | 3/3 |
| S10 A sold-out piece never leads to a purchase | desktop | passed | 5/5 |
| S1 First-time visitor gets three looks | phone | passed | 4/4 |
| S2 Different venue and time give a different request and looks | phone | passed | 3/3 |
| S3 Rejecting a look as too formal stores feedback against it | phone | passed | 3/3 |
| S4 A guest's saved look survives a refresh | phone | passed | 3/3 |
| S5 Signing in moves a guest's saved look to the account | phone | passed | 3/3 |
| S6 A corrected Style DNA colour is kept | phone | passed | 4/4 |
| S7 An unreadable photo gets a way forward | phone | passed | 4/4 |
| S7b A photo the analysis cannot read offers a retake or skipping colours | phone | passed | 3/3 |
| S8 A slow answer, then a timeout, can be recovered | phone | passed | 7/7 |
| S9 Two looks only: the page works and says so | phone | passed | 3/3 |
| S10 A sold-out piece never leads to a purchase | phone | passed | 5/5 |
| S11 Phone: the whole journey, swipe, enlarge, back and save | phone | passed | 7/7 |
| S12 Analytics: once each, stable ids, real actions only | desktop | passed | 8/8 |
| A11Y No serious or critical accessibility problems (axe) | desktop | passed | 7/7 |
| LAYOUT Controls are at least 44px and nothing scrolls sideways | desktop | passed | 8/8 |
| A11Y No serious or critical accessibility problems (axe) | phone | passed | 7/7 |
| LAYOUT Controls are at least 44px and nothing scrolls sideways | phone | passed | 8/8 |
| PERF Home loads quickly | desktop | passed | 2/2 |
| PERF Home loads quickly | phone | passed | 2/2 |

### Failed checks

None.

### Load

| Device | Largest paint | DOM ready | Load | Layout shift | Transferred |
| --- | --- | --- | --- | --- | --- |
| desktop | 200 ms | 50 ms | 50 ms | 0 | 2596 KB |
| phone | 2332 ms | 1135 ms | 1135 ms | 0 | 280 KB |

The desktop load includes the home demo film (about 2.3 MB, both cuts are compressed). The phone run uses a throttled connection (150 ms, 1.6 Mbit/s) and loads the phone cut lazily.

## Fixed during Phase 3

- Colour contrast: the Style DNA section on the home page and the upcoming steps in the top bar were below 4.5:1; both now pass.
- List markup: the look thumbnails and the Your data list now use valid list semantics for screen readers.

## Not covered

- Real devices and Safari: the suite runs in Chromium only. iOS Safari behaviour (toolbar, scroll locking) was checked by hand earlier, see README "Phones and iOS Safari".
- The deployed site: the Railway address is not reachable from the build machine, so the suite runs against a local production build of the same commit.
