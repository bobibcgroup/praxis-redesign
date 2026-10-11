# Analytics specification

Deliverable E of the spec (section 23): the event dictionary, with each event's required properties and triggering condition. It is written from `src/core/analytics.ts` and from every `track(` call under `src/`, and each claim points at the line that makes it true.

## 1. What exists today, and what does not

| Concern | Status today | Defined in |
| --- | --- | --- |
| Event dictionary (names, categories, typed properties, triggers) | Implemented, closed: 47 events | `src/core/analytics.ts:36` to `src/core/analytics.ts:89` |
| Validation guard | Implemented, hand written | `src/core/analytics.ts:122` to `src/core/analytics.ts:151` |
| Recording function `track()` | Implemented | `src/core/analytics.ts:192` |
| Sink in this browser (`localStorage`, newest 1000 events) | Implemented, the only sink registered | `src/core/analytics.ts:155` to `src/core/analytics.ts:172` |
| Internal report at `/internal/analytics` | Implemented, reads this browser's events only | `src/a/screens/Internal.tsx:29` |
| An analytics service that collects events from every visitor | **Not built.** There is no endpoint, server, collector, warehouse or third party SDK in the code | none |

**Future integration.** An approved analytics service plugs in as another sink: an object implementing `AnalyticsSink` (`src/core/analytics.ts:116`) passed to `addSink()` (`src/core/analytics.ts:175`). Nothing calls `addSink` in the app today; the only sink is `localSink`, added at module load (`src/core/analytics.ts:172`). The transport, endpoint, batching, authentication and consent banner for such a service are decisions still to be made.

```ts
// src/core/analytics.ts:116
export interface AnalyticsSink {
  send(event: PraxisAnalyticsEvent): void;
}

// src/core/analytics.ts:175
export function addSink(sink: AnalyticsSink): () => void; // returns a function that removes it
```

`send` is synchronous and its errors are swallowed (`src/core/analytics.ts:222` to `src/core/analytics.ts:228`), so a failing sink never breaks the page. A network sink would need to queue and send in the background itself.

The comment at `src/core/analytics.ts:24` says the trigger texts are "also the analytics dictionary in docs/AI-READINESS.md". That file does not exist in this repository; this document is the dictionary.

## 2. The envelope every event carries

```ts
// src/core/analytics.ts:101
export interface PraxisAnalyticsEvent {
  eventId: string;
  eventName: EventName;
  timestamp: string;
  anonymousSessionId: string;
  userId?: string;
  journey?: "style_a_moment" | "style_dna";
  recommendationId?: string;
  outfitId?: string;
  properties: Record<string, string | number | boolean>;
  applicationVersion: string;
  /** Set while test mode is on, so simulated sessions never count as real ones. */
  testMode?: string;
}
```

| Field | Always present | Where the value comes from |
| --- | --- | --- |
| `eventId` | yes | `newId("evt")`, a random id with prefix `evt` (`src/core/analytics.ts:208`, `src/core/ids.ts:4`) |
| `eventName` | yes | the dictionary key passed to `track()` |
| `timestamp` | yes | `new Date().toISOString()` at recording time (`src/core/analytics.ts:210`) |
| `anonymousSessionId` | yes | `anonymousId()`: an `anon_` id kept in `localStorage` under `praxis_anon`, the same for every visit from this browser until local data is deleted (`src/core/identity.ts:33`) |
| `userId` | only when signed in | `currentUserId()`: the stand-in account's id from `praxis_lab_a_user` (`src/core/identity.ts:77`, `src/core/analytics.ts:215`). There is no account server; a real account system replaces this id |
| `journey` | only for events whose dictionary entry names one | copied from the entry's `journey` (`src/core/analytics.ts:217`) |
| `recommendationId` | only when passed as a property | lifted out of `properties` to the top level (`src/core/analytics.ts:206`, `src/core/analytics.ts:218`) |
| `outfitId` | only when passed as a property | lifted out of `properties` to the top level (`src/core/analytics.ts:206`, `src/core/analytics.ts:219`) |
| `properties` | yes (may be `{}`) | the validated properties, minus `recommendationId` and `outfitId` |
| `applicationVersion` | yes | `APP_VERSION`: `package.json` version injected by Vite as `__APP_VERSION__`, or `"dev"` (`src/core/config.ts:9`, `vite.config.ts:9`) |
| `testMode` | only in test mode | the active test scenario id (section 5) |

## 3. The guard

`track()` runs `validateEvent()` first (`src/core/analytics.ts:193`). A refused event returns `null`, is sent to no sink, does not consume a once key, and in development logs `[analytics] refused: ...` to the console (`src/core/analytics.ts:194` to `src/core/analytics.ts:197`). In production a refusal is silent.

| Rule | Refused when | Line |
| --- | --- | --- |
| Unknown event | the name is not a key of `EVENTS` | `src/core/analytics.ts:132` |
| Unknown property | any key not declared for that event (keys whose value is `undefined` are skipped) | `src/core/analytics.ts:134` to `src/core/analytics.ts:137` |
| Missing required property | a required key is `undefined` or `null` | `src/core/analytics.ts:140` to `src/core/analytics.ts:141` |
| Number | not a finite number (`NaN` and `Infinity` refused) | `src/core/analytics.ts:144` |
| Boolean | not `true` or `false` | `src/core/analytics.ts:145` |
| String | not a string, empty, or `unsafe()` | `src/core/analytics.ts:146` |
| Enum | not one of the listed values | `src/core/analytics.ts:147` |

An optional property given as `null` is dropped, not refused. TypeScript also checks names and property types at compile time through `EventProps<N>` (`src/core/analytics.ts:95`), so most mistakes fail the build before the runtime guard sees them.

`unsafe()` applies to free `string` properties only (enum values are already fixed):

```ts
// src/core/analytics.ts:122
const MAX_STRING = 160;
function unsafe(value: string): boolean {
  return value.length > MAX_STRING || /@/.test(value) || /^data:/i.test(value) || /^blob:/i.test(value) || /base64/i.test(value);
}
```

| Refused string | Purpose |
| --- | --- |
| longer than 160 characters | no long free text |
| contains `@` anywhere | no email addresses |
| starts with `data:` (any case) | no inline images or data URLs |
| starts with `blob:` (any case) | no object URLs pointing at photos |
| contains `base64` anywhere (any case) | no encoded payloads |

Note the `data:` and `blob:` checks are prefix checks; a string that contains them later is not refused by those two rules (it would usually be caught by the length or `base64` rules). The guard rules are tested at `src/core/__tests__/analytics.test.ts:15` and the `unsafe()` string rules at `src/core/__tests__/analytics.test.ts:25`.

## 4. Sinks and storage

| Sink | Where | Behaviour |
| --- | --- | --- |
| `localSink` (`createLocalSink()`) | `localStorage` key `praxis_events` (`src/core/analytics.ts:155`) | appends each event and keeps the newest 1000 (`src/core/analytics.ts:156`, `src/core/analytics.ts:164`); `read()` and `clear()` are used by `/internal/analytics` (`src/a/screens/Internal.tsx:31`, `src/a/screens/Internal.tsx:79`) |
| any sink given to `addSink()` | not used today | future integration, see section 1 |

Retention: events older than 90 days are removed from `praxis_events` when the app starts (`src/core/data.ts:15`, `src/core/data.ts:76`). "Delete everything" on `/data` removes the key with the rest of the local data and then records `local_data_deleted` under a fresh anonymous id (`src/a/screens/YourData.tsx:46` to `src/a/screens/YourData.tsx:53`). `/internal/analytics` can also download the events, styling requests and feedback as `praxis-analytics.json` (`src/a/screens/Internal.tsx:74`).

## 5. Test mode marking

Test mode is chosen on `/internal/analytics` (`src/a/screens/Internal.tsx:95` to `src/a/screens/Internal.tsx:111`) and stored in `sessionStorage` under `praxis_sim`, so it lasts for the tab only (`src/core/sim.ts:22`, `src/core/sim.ts:33`). The scenarios are `fast`, `slow`, `timeout`, `failure`, `partial`, `empty`, `invalid_image` and `unavailable_products` (`src/core/sim.ts:9`).

Every event recorded while a scenario is active gets `testMode` set to the scenario id (`src/core/analytics.ts:220` to `src/core/analytics.ts:221`). Test mode events are still stored and still appear in "Events by name" and "Latest events" (labelled `(test mode: <id>)`, `src/a/screens/Internal.tsx:205`), but the Measures section counts only events without `testMode` (`src/a/screens/Internal.tsx:33`, `src/a/screens/Internal.tsx:38`). A future sink receives the field too, and should filter on it in the same way.

## 6. Once per visit

`track(name, props, { once: key })` records the event only the first time the pair `name:key` is seen in this tab (`src/core/analytics.ts:198` to `src/core/analytics.ts:204`). Seen pairs are kept in `sessionStorage` under `praxis_events_once`, newest 400 kept. So a re-render, a remount or a reload does not count again, while a new tab does.

| Event | Once key | Line |
| --- | --- | --- |
| `landing_viewed` | `"home"` | `src/a/screens/Home.tsx:75` |
| `results_viewed` | the `recommendationId` | `src/a/screens/moment/Results.tsx:131` |
| `sync_offer_viewed` | `"saved"` | `src/a/ui/Completion.tsx:25` |
| `saved_look_reopened` | the saved look's id from the URL | `src/a/screens/Looks.tsx:110` |
| `style_dna_started` | `"dna"` | `src/a/screens/dna/DnaSteps.tsx:33` |

Two more events are limited without the `once` option:

* `user_returned` fires only when `noteVisit()` counts a new visit, which happens once per tab through its own `sessionStorage` key `praxis_visit` (`src/core/identity.ts:50` to `src/core/identity.ts:60`, `src/a/lib/journey.tsx:34`).
* `premium_intro_viewed` and `paywall_viewed` fire from an effect keyed on the gate's feature and step, so once each time the gate shows that step, not once per visit (`src/a/ui/Gate.tsx:101` to `src/a/ui/Gate.tsx:105`).

## 7. Event dictionary

Types: `string` (guarded, section 3), `number` (finite), `boolean`, or an enum listed in braces. **Bold** properties are required; the rest are optional. Where a property is `recommendationId` or `outfitId`, it is moved to the envelope when recorded. "Dict" is the dictionary line in `src/core/analytics.ts`.

Shared property definitions (`src/core/analytics.ts:29` to `src/core/analytics.ts:34`):

| Name in code | Type |
| --- | --- |
| `OCCASION` | {DINNER, WORK, DATE, WEDDING, PARTY} |
| `QUESTION` | {occasion, venue, time, vibe, spend}, required |
| `FEATURE` | {style_dna, tryon}, required |
| `PHOTO` | {face_colour, body_fit, wardrobe_garment, try_on}, required |

### Acquisition

| Event | Dict | Journey | Properties | Triggering condition | Tracked at |
| --- | --- | --- | --- | --- | --- |
| `landing_viewed` | 37 | none | **via** {story, friend, link, none} | Home is shown and no journey is marked done (`answers.done` empty); `via` is the URL's `via` parameter, or `none` when absent or any other value. Once per visit | `src/a/screens/Home.tsx:75` |
| `occasion_selected` | 38 | style_a_moment | **occasion** OCCASION, **surface** {home, question} | An occasion tile is chosen on home, or an answer is chosen on the occasion question | `src/a/screens/Home.tsx:80`, `src/a/screens/moment/Question.tsx:77` |
| `style_dna_explored` | 39 | style_dna | **surface** {home, bar, menu, completion} | Someone without a saved Style DNA taps Explore Style DNA on home, the Style DNA link in the top bar, the Style DNA item in the menu, or the Style DNA action on a completion screen. Home tracks it even when a Style DNA exists; the other three check `!store.dna` | `src/a/screens/Home.tsx:32`, `src/a/ui/TopBar.tsx:64`, `src/a/ui/TopBar.tsx:166`, `src/a/ui/Completion.tsx:68` |

### Journey

| Event | Dict | Journey | Properties | Triggering condition | Tracked at |
| --- | --- | --- | --- | --- | --- |
| `question_answered` | 41 | style_a_moment | **question** QUESTION, **answer** string, **step** number, **restyle** boolean | An answer is chosen on a Style a Moment question; `restyle` is true when changed from Restyle | `src/a/screens/moment/Question.tsx:76` |
| `step_abandoned` | 42 | style_a_moment | **question** QUESTION | The browser fires `pagehide` (tab closed, reload, navigating off the site) while a question is shown, unanswered, and its earlier answers are present. Moving to another screen inside the app removes the listener and is not counted | `src/a/screens/moment/Question.tsx:67` |
| `styling_submitted` | 43 | style_a_moment | **requestId** string, **inputKey** string, **adapter** string (`<id>/<version>`), **wardrobeItems** number | A styling request is handed to the recommendation service | `src/a/lib/styling.ts:58` |
| `processing_started` | 44 | style_a_moment | **requestId** string | Immediately after `styling_submitted`, before the service is awaited | `src/a/lib/styling.ts:59` |
| `processing_completed` | 45 | style_a_moment | **requestId** string, **recommendationId** string, **status** {completed, partial, empty}, **outfits** number, **durationMs** number | The service answers with any status other than `failed`; `durationMs` is measured with `performance.now()`. Not recorded for a cancelled request | `src/a/lib/styling.ts:64` |
| `processing_failed` | 46 | style_a_moment | **requestId** string, **code** string | The service answers with status `failed` (including validation rejections); `code` is the error code or `unknown`. Not recorded for code `cancelled` | `src/a/lib/styling.ts:63` |
| `processing_delayed` | 47 | style_a_moment | **requestId** string | A request is still running after `SLOW_AFTER_MS` (5000 ms, `src/core/processing.ts:35`) | `src/a/lib/styling.ts:163` |
| `processing_cancelled` | 48 | style_a_moment | **requestId** string | The customer cancels while a request id is current | `src/a/lib/styling.ts:185` |
| `retry_requested` | 49 | style_a_moment | **attempt** number, **code** string | Try again is tapped while the state is `failed`; `attempt` is the next attempt number | `src/a/lib/styling.ts:178` |
| `results_viewed` | 50 | style_a_moment | **recommendationId** string, **outfits** number, **mode** {demonstration, personalized}, **shared** boolean | The results screen has a response and resolved looks. `shared` is true when the URL carries `via` and no journey is done. Once per visit per recommendation | `src/a/screens/moment/Results.tsx:131` |

### Engagement

| Event | Dict | Journey | Properties | Triggering condition | Tracked at |
| --- | --- | --- | --- | --- | --- |
| `outfit_selected` | 52 | style_a_moment | **recommendationId** string, **outfitId** string, **rank** number, **method** {thumbnail, swipe, arrow, key, viewer} | A different look is brought to the front on results, by thumbnail, swipe, arrow button, arrow key or the large viewer; only when a recommendation id exists | `src/a/screens/moment/Results.tsx:99` |
| `outfit_enlarged` | 53 | style_a_moment | **recommendationId** string, **outfitId** string | The large viewer is opened (tap on the photo) and a recommendation id exists | `src/a/screens/moment/Results.tsx:116` |
| `garment_deselected` | 54 | style_a_moment | recommendationId string, **outfitId** string, **garmentId** string | A ticked piece is unticked on results | `src/a/screens/moment/Results.tsx:52` |
| `garment_reselected` | 55 | style_a_moment | recommendationId string, **outfitId** string, **garmentId** string | An unticked piece is ticked again on results | `src/a/screens/moment/Results.tsx:52` (same call as above, name chosen by the current state) |
| `recommendation_rejected` | 56 | style_a_moment | **recommendationId** string, **outfitId** string, **rank** number | Not for me is tapped on a look; `rank` falls back to 0 | `src/a/ui/LookFeedback.tsx:66` |
| `feedback_submitted` | 57 | style_a_moment | **recommendationId** string, **outfitId** string, **feedback** {more_like_this, not_for_me}, reason {too_formal, too_casual, wrong_colours, wrong_fit, too_expensive}, garmentId string | More like this is tapped (line 61), or a reason or a piece is given after Not for me (line 74) | `src/a/ui/LookFeedback.tsx:61`, `src/a/ui/LookFeedback.tsx:74` |
| `look_shared` | 58 | style_a_moment | recommendationId string, **outfitId** string, **channel** {story, friend, image, link} | A share went somewhere: story card shared or saved (line 59), friend share completed (line 65), image downloaded (line 71), link copied (line 77). Never on a cancelled or failed attempt | `src/a/ui/ShareSheet.tsx:54` (one helper, called from lines 59, 65, 71, 77) |
| `restyle_changed` | 59 | style_a_moment | **field** {occasion, venue, time, vibe, spend} | An answer is chosen on a question opened from Restyle (recorded with `question_answered`) | `src/a/screens/moment/Question.tsx:78` |

### Commercial

| Event | Dict | Journey | Properties | Triggering condition | Tracked at |
| --- | --- | --- | --- | --- | --- |
| `size_selected` | 61 | style_a_moment | **outfitId** string, **garmentId** string, **size** string | A size is picked for a piece in the Check out sheet | `src/a/ui/PiecesSheet.tsx:49` |
| `retailer_redirected` | 62 | style_a_moment | **outfitId** string, **garmentId** string, **retailerId** string, **route** {retailer_site, affiliate} | A piece's buy link is followed; returns early with no event when the piece has no link. `retailerId` is the piece's `retailerId` or else its `vendor` | `src/a/ui/PiecesSheet.tsx:55` |
| `checkout_initiated` | 63 | style_a_moment | recommendationId string, **outfitId** string, **pieces** number, **total** number, **priceStatus** {example, estimated, live} | Check out is opened with at least one piece chosen, from results, try-on or a saved look; `priceStatus` falls back to `example` | `src/a/screens/moment/Results.tsx:85`, `src/a/screens/moment/TryOn.tsx:40`, `src/a/screens/Looks.tsx:105` |

### Retention

| Event | Dict | Journey | Properties | Triggering condition | Tracked at |
| --- | --- | --- | --- | --- | --- |
| `look_saved` | 65 | style_a_moment | recommendationId string, **outfitId** string, **signedIn** boolean | Save is tapped on results or on try-on (after the look is stored) | `src/a/screens/moment/Results.tsx:81`, `src/a/screens/moment/TryOn.tsx:36` |
| `saved_look_reopened` | 66 | none | **outfitId** string | A saved look's page (`Looks.tsx`) opens with a look found for the URL id. Once per visit per saved look | `src/a/screens/Looks.tsx:110` |
| `user_returned` | 67 | none | **daysSinceLastVisit** number, **visits** number | The app starts in a tab that has not counted a visit, and this browser has visited before | `src/a/lib/journey.tsx:34` |
| `wardrobe_item_added` | 68 | style_a_moment | **slot** {top, bottom, shoes, extras}, **source** {sample, upload} | A piece the customer owns is added; `source` is `upload` when it has a photo. The photo is never sent | `src/a/screens/moment/You.tsx:69` |
| `style_dna_started` | 69 | style_dna | none | The first Style DNA question mounts and this is not a retake. Once per visit | `src/a/screens/dna/DnaSteps.tsx:33` |
| `style_dna_step` | 70 | style_dna | **step** {photo, fit, week, taste}, **answer** string | Photo: a capture is accepted, `answer` is `own` or `sample` (line 71). Fit and week: an option is chosen, `answer` is its id (lines 106, 139). Taste: Continue is tapped, `answer` is the picked ids joined by commas or `skipped` (line 169) | `src/a/screens/dna/DnaSteps.tsx:71`, `:106`, `:139`, `:169` |
| `style_dna_analysis_finished` | 71 | style_dna | **status** {completed, unreadable, failed, disabled} | The colour analysis adapter answers for the Style DNA photo, while the screen is still mounted. Only the status, never the reading | `src/a/screens/dna/DnaResult.tsx:51` |
| `style_dna_estimate_confirmed` | 72 | style_dna | none | The Style DNA is saved while it still holds unconfirmed estimates (the save confirms them) | `src/a/screens/dna/DnaResult.tsx:145` |
| `style_dna_corrected` | 73 | style_dna | **field** {undertone, contrast, fit, week, tastes} | A different chip is chosen for a part of the Style DNA profile; the value is not sent | `src/a/ui/StyleProfileView.tsx:106` |
| `style_dna_completed` | 74 | style_dna | **photo** {own, sample}, **tasteCount** number | A Style DNA is saved | `src/a/screens/dna/DnaResult.tsx:148` |

### Account and privacy

| Event | Dict | Journey | Properties | Triggering condition | Tracked at |
| --- | --- | --- | --- | --- | --- |
| `photo_consent_given` | 76 | none | **category** PHOTO | Agree is tapped on the photo consent panel, after consent is stored. Callers pass `face_colour` (`src/a/ui/Capture.tsx:163`) and `wardrobe_garment` (`src/a/screens/moment/You.tsx:122`) | `src/a/ui/PhotoConsent.tsx:38` |
| `photo_rejected` | 77 | none | **category** PHOTO, **problem** {not_an_image, unsupported_type, too_large, too_small, too_dark, too_bright, unreadable} | A file fails the type and size check (`rejectFile`, line 53) or a read photo fails the size and light check (`rejectImage`, line 60) | `src/a/ui/PhotoConsent.tsx:53`, `src/a/ui/PhotoConsent.tsx:60` |
| `photo_deleted` | 78 | none | **category** PHOTO | The face photo or wardrobe photo is deleted on `/data` (lines 39, 43), or "Delete and change the photo" is tapped in Style DNA for an own photo (line 49) | `src/a/screens/YourData.tsx:39`, `src/a/screens/YourData.tsx:43`, `src/a/screens/dna/DnaSteps.tsx:49` |
| `local_data_deleted` | 79 | none | none | After "delete everything" has cleared local data and the identity cache, so it is the first event under a new anonymous id | `src/a/screens/YourData.tsx:53` |
| `premium_intro_viewed` | 80 | none | **feature** FEATURE | The gate shows its intro step | `src/a/ui/Gate.tsx:103` |
| `premium_intro_continued` | 81 | none | **feature** FEATURE | Continue is tapped on the Style DNA intro (line 175) or the try-on intro (line 185) | `src/a/ui/Gate.tsx:175`, `src/a/ui/Gate.tsx:185` |
| `paywall_viewed` | 82 | none | **feature** FEATURE | The gate shows its premium payment step | `src/a/ui/Gate.tsx:104` |
| `premium_started` | 83 | none | **feature** FEATURE | The preview payment reports paid; no charge is made (payment is a future integration) | `src/a/ui/Gate.tsx:120` |
| `sync_offer_viewed` | 84 | none | none | The offer to sign in is shown to a guest who has not dismissed it. Once per visit | `src/a/ui/Completion.tsx:25` |
| `sync_offer_dismissed` | 85 | none | none | The guest declines the offer (also remembered in `praxis_sync_offer_dismissed`) | `src/a/ui/Completion.tsx:39` |
| `signin_completed` | 86 | none | **method** {apple, google, email}, **surface** {sync_offer, gate, menu} | The stand-in sign-in completes; recorded after the account is set, so the event carries `userId`. The surface comes from the gate (`src/a/ui/Gate.tsx:196`) | `src/a/lib/journey.tsx:40` |
| `account_migrated` | 87 | none | **looks** number, **duplicates** number, **feedback** number, wardrobe number | A guest's saved looks moved to the account; `feedback` is 0 when the feedback write failed | `src/a/lib/journey.tsx:52` |
| `account_migration_failed` | 88 | none | **part** {looks, feedback} | Moving looks failed (line 45, nothing else is moved) or writing the moved feedback failed (line 53) | `src/a/lib/journey.tsx:45`, `src/a/lib/journey.tsx:53` |

## 8. Coverage checks

**Dictionary events never tracked.** None. Every one of the 47 events has at least one `track(` call in `src/a`. Some enum values are never produced by any caller today:

| Event and property | Value never sent | Why |
| --- | --- | --- |
| `photo_consent_given`, `photo_rejected`, `photo_deleted`: `category` | `body_fit`, `try_on` | no screen asks for a body photo or a try-on photo yet |
| `checkout_initiated`: `priceStatus` | `estimated`, `live` | the mock adapter marks every product `example` (`src/core/adapters/mock.ts:154`) and the mock retailer adapter sets no price status; `estimated` or `live` needs a real retailer integration (`src/core/retail.ts`) |

**Events tracked in more than one place.**

| Event | Places | Note |
| --- | --- | --- |
| `style_dna_explored` | 4 | `surface` tells them apart |
| `style_dna_step` | 4 | `step` tells them apart |
| `checkout_initiated` | 3 | results, try-on, saved look; no property says which screen |
| `photo_deleted` | 3 | `/data` and Style DNA photo change; no property says which screen |
| `occasion_selected` | 2 | `surface` tells them apart |
| `feedback_submitted` | 2 | `feedback` tells them apart |
| `look_saved` | 2 | results and try-on; no property says which screen |
| `photo_rejected` | 2 | file check and quality check; `problem` usually tells them apart |
| `premium_intro_continued` | 2 | `feature` tells them apart |
| `account_migration_failed` | 2 | `part` tells them apart |
| `look_shared` | 1 call, 4 callers | `channel` tells them apart |
| `garment_deselected`, `garment_reselected` | 1 call for both | name chosen from the piece's current state |

**Spec events with no dictionary entry.** Section 18 of the spec also lists Outfit swiped, Garment inspected, Garment swapped, Product clicked and Purchase confirmed. The code covers swiping as `outfit_selected` with `method: "swipe"`; there is no event for inspecting or swapping a garment, no separate product click (the closest is `retailer_redirected`), and no purchase confirmation, since no reliable confirmation from a retailer exists. Adding any of them means a new entry in `EVENTS` and a call site.

## 9. Measures on /internal/analytics

All measures are computed in the browser from `localSink.read()`, that is, only from events stored in this browser (at most the newest 1000, at most 90 days old), after removing every event with `testMode` (`src/a/screens/Internal.tsx:31` to `src/a/screens/Internal.tsx:56`). Nothing is estimated. They become product wide measures only once a future sink sends events from every visitor to an analytics service.

```ts
// src/a/screens/Internal.tsx:21
function count(events, name, where?) // number of events with that name (and matching where)
// src/a/screens/Internal.tsx:25
function rate(part, whole)            // "No data yet" when whole is 0, else "N% (part of whole)", rounded
```

| Measure (label on the page) | Computed as | Line |
| --- | --- | --- |
| Journey completion (results shown per occasion chosen) | `rate(count(results_viewed), count(occasion_selected))`. Both surfaces of `occasion_selected` count, and `results_viewed` includes shared and reopened results | `src/a/screens/Internal.tsx:43` |
| Left on the venue / time / vibe / spend question (four rows) | `count(step_abandoned where properties.question == q)` for each of venue, time, vibe, spend. The occasion question is not listed | `src/a/screens/Internal.tsx:41`, `src/a/screens/Internal.tsx:44` |
| Save rate (saves per results shown) | `rate(count(look_saved), count(results_viewed))`; saves from results and try-on both count | `src/a/screens/Internal.tsx:45` |
| Feedback rate (recommendations with feedback) | distinct `recommendationId` over `feedback_submitted` and `recommendation_rejected`, divided by distinct `recommendationId` over `results_viewed`. The two sets are not intersected | `src/a/screens/Internal.tsx:39`, `src/a/screens/Internal.tsx:40`, `src/a/screens/Internal.tsx:46` |
| Check-out rate (check-outs per results shown) | `rate(count(checkout_initiated), count(results_viewed))`; check-outs from results, try-on and saved looks all count | `src/a/screens/Internal.tsx:47` |
| Looks opened large | `count(outfit_enlarged)`, a plain count | `src/a/screens/Internal.tsx:48` |
| Style DNA completion | `rate(count(style_dna_completed), count(style_dna_started))`. Retakes record a completion but no start, so this can exceed 100% | `src/a/screens/Internal.tsx:49` |
| Error rate (failed requests) | `rate(count(processing_failed), count(styling_submitted))`; cancelled requests stay in the denominator | `src/a/screens/Internal.tsx:50` |
| Slow requests (taking longer than usual) | `rate(count(processing_delayed), count(styling_submitted))` | `src/a/screens/Internal.tsx:51` |
| Requests cancelled | `count(processing_cancelled)` | `src/a/screens/Internal.tsx:52` |
| Style DNA corrections | `count(style_dna_corrected)` | `src/a/screens/Internal.tsx:53` |
| Return visits | `count(user_returned)` | `src/a/screens/Internal.tsx:54` |

The page also shows, without filtering out test mode: a total of stored events, styling requests and feedback records (`src/a/screens/Internal.tsx:71`), a count for every dictionary event with its trigger text (`src/a/screens/Internal.tsx:58` to `src/a/screens/Internal.tsx:61`, `src/a/screens/Internal.tsx:180` to `src/a/screens/Internal.tsx:184`), and the latest 40 events with their properties, ids and time (`src/a/screens/Internal.tsx:197` to `src/a/screens/Internal.tsx:211`).

Spec reporting items not yet shown as a measure, although the events exist: outfit engagement beyond enlargements (`outfit_selected` is counted only in "Events by name"), and click-through to retailers (`retailer_redirected` likewise).
