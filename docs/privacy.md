# Privacy architecture (deliverable F)

How Praxis collects, processes, keeps and deletes personal photographs and the attributes derived from them, as the code does it today. Everything here was read from the source; file references are `path:line`.

## The short version

- Three kinds of photo can be given today: a face photo for Style DNA, a photo of a piece the customer owns, and a photo for See it on me. Body photos are not asked for anywhere. The try-on photo stays in the tab (`praxis_tryon_photo`) and is not sent anywhere while no try-on engine is connected (docs/TRY-ON.md).
- On a shared device each person sees only their own saved looks, Style DNA, feedback and earlier answers. Signing out starts a new anonymous id, deletes the photos and the unsaved Style DNA in the tab, and asks for photo consent again; what the account saved stays on the device, hidden, until it signs in again.
- A photo given today lives in the `sessionStorage` of the browser tab (`praxis_lab_a_face`, `praxis_lab_a_item`). It is never written to `localStorage`, never sent over the network, and is gone when the tab closes or when the customer deletes it.
- No photo is analysed. The colour "analysis" is a mock that returns the same sample answer for every photo, labelled `source: "sample"` (`src/core/vision.ts:86`). The garment "recognition" mock reads nothing (`src/core/vision.ts:104`).
- There is no server, no upload code, no database and no image provider in this repository. Every image adapter is a free mock. Billable adapters cannot run unless the build sets `VITE_ALLOW_BILLABLE_IMAGES=true` (`src/core/config.ts:27`), and no billable adapter exists.
- Derived attributes (undertone, contrast) are kept in the Style DNA profile in `localStorage`, never with the photo, and each one records whether it is an estimate, a confirmation or a correction.
- Analytics refuses anything that looks like an image, an email or long text, and the photo events carry only a category and a reason.
- All wording shown to the customer about photos is read from one policy table, and must be approved by legal counsel before real processing goes live (`src/core/images.ts:11`).

## Where the pieces live

| Concern | File | What it does |
|---|---|---|
| Photo policies, checks, consent, deletion | `src/core/images.ts` | `IMAGE_POLICIES`, `disclosure`, `checkFile`, `checkQuality`, `consentFor`, `grantConsent`, `withdrawConsent`, `IMAGE_KEYS`, `deleteImages` |
| Image service adapters | `src/core/vision.ts` | Adapter interfaces, mocks, consent version gate, `guardBillable`, `imageServices` |
| Build switch | `src/core/config.ts:27` | `ALLOW_BILLABLE_IMAGES` from `VITE_ALLOW_BILLABLE_IMAGES` |
| Derived attributes | `src/core/styleProfile.ts` | The Style DNA profile, which never holds a photo |
| Retention and deletion of everything else | `src/core/data.ts` | `RETENTION`, `STORES`, `pruneExpired`, `deleteLocalData`, wardrobe by name only |
| Legacy portrait removal | `src/shared/store.ts:60`, `:103` | Old saves that held a portrait are migrated and rewritten without it |
| Analytics guard | `src/core/analytics.ts:124` | Refuses values that could carry personal data |
| Consent notice | `src/a/ui/PhotoConsent.tsx` | Shows the policy text, records consent, runs the checks |
| Face capture | `src/a/ui/Capture.tsx` | Camera, upload or sample, behind consent |
| Piece photo | `src/a/screens/moment/You.tsx:49` (`YouItem`) | Upload or sample, behind consent |
| Customer data page | `src/a/screens/YourData.tsx` | `/data`: what is kept, delete a photo, delete everything |
| Image helpers | `src/a/lib/image.ts` | Read, shrink, capture a frame, measure size and brightness, all in the browser |
| Tab storage of photos | `src/a/lib/journey.tsx:60`, `src/a/lib/journeyContext.ts:49` | Holds the two photos in React state mirrored to `sessionStorage` |

## The policy table

Each kind of photo has one `ImagePolicy` (`src/core/images.ts:18`). The notice the customer reads is generated from it by `disclosure()` (`src/core/images.ts:109`), so the words and the behaviour come from the same object.

```ts
// src/core/images.ts:18
export interface ImagePolicy {
  category: ImageCategory;               // "face_colour" | "body_fit" | "wardrobe_garment" | "try_on"
  why: string;                           // why the photo is needed
  use: string;                           // how it is used
  processing: "none" | "on_device" | "server";
  leavesDevice: boolean;
  retention: { where: "this_tab" | "this_device" | "server"; maxDays?: number };
  deletion: string;                      // how the customer deletes it
  consentVersion: string;                // bumped when the wording changes
  accepts: readonly string[];            // MIME types
  maxBytes: number;
  minEdge: number;                       // shorter edge, in pixels
  status: "collecting" | "not_collected";
  adapter: string;                       // the vision.ts adapter that would read it
}
```

`disclosure()` turns the fields into the sentences shown under "Where it goes" and "How long":

| Field value | Sentence shown |
|---|---|
| `leavesDevice: false` | "It stays on this device. Nothing is uploaded." |
| `leavesDevice: true` | "It is sent to Praxis to be analysed." |
| `retention.where: "this_tab"` | "Kept in this browser tab only." |
| `retention.where: "this_device"` | "Kept on this device." |
| `retention.where: "server"` | "Kept on Praxis servers for up to N days." (N from `maxDays`, omitted if unset) |

A unit test checks that the "stays on this device" sentence appears exactly when `leavesDevice` is false (`src/core/__tests__/phase2-privacy.test.ts:17`).

## Per category

### Category A: face and colour analysis (`face_colour`)

| Aspect | Today |
|---|---|
| Policy | `src/core/images.ts:46` |
| Status | `collecting` |
| Inputs | Camera (front camera, 1280 x 960 requested, no audio, `src/a/ui/Capture.tsx:61`), file upload, or a sample portrait. Accepts JPEG, PNG, WebP, HEIC, HEIF up to 15 MB; shorter edge at least 320 px. |
| Consent | Asked before the camera opens or the file picker opens, only if there is no consent to the current wording (`src/a/ui/Capture.tsx:116`). Not asked for the sample. Declining uses the sample (`src/a/ui/Capture.tsx:171`). |
| Processing location | `processing: "none"`. The browser only measures size and mean brightness (`src/a/lib/image.ts:60`) and shrinks the photo to a 900 px longest edge JPEG (`src/a/lib/image.ts:14`, `:36`). No model reads it. |
| Leaves device | No (`leavesDevice: false`). |
| What is kept | The shrunk JPEG as a data URL in `sessionStorage` key `praxis_lab_a_face` (`src/a/lib/journey.tsx:60`, `:63`). The Style DNA profile records only `photo: "own" \| "sample" \| "none"` (`src/core/styleProfile.ts:28`). |
| Retention | `this_tab`: until the tab closes or the customer deletes it. |
| Deletion | "Delete and change the photo" on the Style DNA photo step (`src/a/screens/dna/DnaSteps.tsx:48`); Delete on `/data` (`src/a/screens/YourData.tsx:35`, calls `deleteImages("face_colour")`); "Delete everything" (`src/a/screens/YourData.tsx:47`); closing the tab. |
| Error states | `not_an_image`, `unsupported_type`, `too_large` (before reading, `src/core/images.ts:125`); `unreadable`, `too_small`, `too_dark` (mean luma under 40), `too_bright` (over 235) after reading (`src/core/images.ts:134`); camera unavailable or permission refused (`src/a/ui/Capture.tsx:25`); camera not ready (`src/a/ui/Capture.tsx:72`); analysis `unreadable`, `failed` or `disabled` on the build step (`src/a/screens/dna/DnaResult.tsx:51`). Copy is in `PROBLEM_COPY` (`src/core/images.ts:143`). |
| Adapter | `ColourAnalysisAdapter` (`src/core/vision.ts:70`), policy name `colour-analysis`. Today `mockColourAnalysis` (`src/core/vision.ts:86`): returns `cool` and `high`, both `source: "sample"`, for every photo; the photo is not read. |

### Category B: body and fit analysis (`body_fit`)

| Aspect | Today |
|---|---|
| Policy | `src/core/images.ts:61` |
| Status | `not_collected`. No screen asks for a body photo. Fit comes from the customer's own answer on the Style DNA fit question. |
| Inputs | None today. Policy reserves JPEG, PNG, WebP, HEIC, HEIF up to 15 MB, shorter edge at least 480 px. |
| Consent | None asked. A consent version `body-2026-10-11` is reserved. |
| Processing location | `none` |
| Leaves device | No |
| Retention | Nothing is kept. `IMAGE_KEYS.body_fit` is `null` (`src/core/images.ts:189`). |
| Deletion | Nothing to delete; `deleteImages("body_fit")` is a no-op. |
| Error states | The shared checks would apply once collected. |
| Adapter | Policy names `body-analysis`. **No adapter interface for body analysis exists in `src/core/vision.ts` yet**; one would need to be added beside the other four. |

### Category C: wardrobe garment recognition (`wardrobe_garment`)

| Aspect | Today |
|---|---|
| Policy | `src/core/images.ts:76` |
| Status | `collecting` |
| Inputs | File upload, or a named sample piece, from "use something I own" on the results (`src/a/screens/moment/You.tsx:49`). Accepts JPEG, PNG, WebP, HEIC, HEIF up to 15 MB; shorter edge at least 240 px. No camera path. |
| Consent | Asked before the file picker opens, only if there is no consent to the current wording (`src/a/screens/moment/You.tsx:116`). Declining uses the sample piece. |
| Processing location | `none`. Size and brightness checks and the 900 px shrink run in the browser. |
| Leaves device | No |
| What is kept | In the tab: `{ slot, name, image }` in `sessionStorage` key `praxis_lab_a_item` (`src/a/lib/journey.tsx:61`, `:64`). On the device: a wardrobe entry with id, slot, label, source, date added and owner only, never the photo (`src/core/data.ts:140`), kept in `praxis_wardrobe` (newest 50) until deleted. The id is a 32 bit FNV hash of the source, the name and a 32 bit FNV hash of the photo data URL (`src/a/screens/moment/You.tsx:68`, `src/core/request.ts:33`, `src/core/ids.ts:14`), not the photo. |
| Retention | Photo: `this_tab`. Wardrobe entry: `RETENTION.wardrobe` is `null`, until deleted (`src/core/data.ts:12`). |
| Deletion | Delete on `/data` clears only the photo and keeps the name (`src/a/screens/YourData.tsx:40`, `src/core/images.ts:199`); "Delete everything" removes the photo and every wardrobe entry; closing the tab removes the photo. |
| Error states | Same checks as Category A (with its own `minEdge`), plus "I couldn't read that photo" if reading throws (`src/a/screens/moment/You.tsx:88`). |
| Adapter | `GarmentRecognitionAdapter` (`src/core/vision.ts:73`), policy name `garment-recognition`. Today `mockGarmentRecognition` returns `{ status: "completed" }` with no attributes; the customer names the slot. The screens do not call `recogniseGarment` at all. |

Note on the policy wording: `use` says the photo is shown "beside your looks" (`src/core/images.ts:79`). In the current screens the piece photo is held in the tab and used only to derive the wardrobe id and to show "In this tab" on `/data`; no screen renders it. Either the wording or the screens should be brought into line before legal review.

### Category D: virtual try-on (`try_on`)

| Aspect | Today |
|---|---|
| Policy | `TRY_ON_ON_DEVICE` in `src/core/images.ts` (and `TRY_ON_SERVER` once an engine is connected) |
| Status | `collecting`. See it on me asks for one photo after the explanation and consent (docs/TRY-ON.md). |
| Inputs | Camera (front) or upload; JPEG, PNG, WebP, HEIC; under 15 MB; shorter edge at least 480 px; not too dark or bright. No sample. |
| Consent | Asked before the camera or a file opens. Version `tryon-device-2026-10-11`; `tryon-server-2026-10-11` once the photo leaves the device, so everyone is asked again. Withdrawn at sign out and by Delete everything. |
| Processing location | `none` today: the stand-in service receives the request in the page and makes no picture. With an engine: Praxis's server, then the provider. |
| Leaves device | No, today. |
| Retention | In the tab only (`sessionStorage` `praxis_tryon_photo`, at most 1280 px). The last request and answer, without the photo, in `praxis_tryon_request`. |
| Deletion | Retake or Use another photo, Delete on `/data`, sign out, Delete everything, or closing the tab. |
| Error states | Refused photos say why; camera problems are named; the service answers not connected, failed (with Try again when it can help), timed out or stopped. |
| Adapter | `TryOnAdapter` (`src/core/vision.ts`): `mockTryOn` (default, makes no picture) or `httpTryOn` (posts to `server/tryon.mjs`). |

## Consent

```ts
// src/core/images.ts:155
export interface ConsentRecord { category: ImageCategory; version: string; grantedAt: string }
```

- Stored in `localStorage` under `praxis_image_consent`, one record per category (`src/core/images.ts:161`). Consent therefore outlives the tab, while the photo does not.
- Granted by "I agree" in `PhotoConsent` (`src/a/ui/PhotoConsent.tsx:37`), which also records the `photo_consent_given` event with the category only.
- `consentFor()` returns a record only if its `version` equals the policy's current `consentVersion` (`src/core/images.ts:167`). Changing `consentVersion` therefore makes every earlier consent invalid and the notice is shown again.
- `withdrawConsent()` removes the record and calls `deleteImages()` for that category (`src/core/images.ts:178`). In the UI it is called only from "Delete everything" (`src/a/screens/YourData.tsx:48`). There is no separate "withdraw consent" control per category, and deleting one photo on `/data` does not withdraw consent.
- The notice shows, in order: why, how it is used, where it goes, how long it is kept and how to delete it (`src/a/ui/PhotoConsent.tsx:19`). These are the five facts spec section 6 asks for.

### Consent version gate on analysis

`imageServices().analyseColour()` refuses (returns `{ status: "failed" }`) when the `ImageInput.consentVersion` is not the current face policy version (`src/core/vision.ts:180`). The Style DNA build passes the stored consent version for an own photo and an empty string if there is none (`src/a/screens/dna/DnaResult.tsx:48`), so an own photo without current consent is never handed to the adapter. For the sample portrait it passes the current version, since no consent is needed for a sample. `recogniseGarment`, `visualize` and `tryOn` have no consent version check of their own; try-on is blocked by its `status` instead.

```ts
// src/core/vision.ts:15
export interface ImageInput {
  ref: string;            // a data URL or object URL held in this tab, or a storage reference once uploads exist
  category: ImageCategory;
  width: number;
  height: number;
  consentVersion: string;
}
```

## Checks before a photo is used

| Step | Function | Runs on |
|---|---|---|
| Type and size, before reading | `checkFile` (`src/core/images.ts:125`), via `rejectFile` (`src/a/ui/PhotoConsent.tsx:51`) | Uploads only |
| Dimensions and brightness, after reading | `checkQuality` (`src/core/images.ts:134`) with `imageStats` (`src/a/lib/image.ts:60`), via `rejectImage` (`src/a/ui/PhotoConsent.tsx:58`) | Uploads (on the original, before shrinking) and camera frames |

Brightness is the mean luma of a 48 x 48 downsample. If the canvas cannot be read, brightness is `null` and only the size check applies. A file the browser cannot decode (for example HEIC in a browser without HEIC support) gives width 0 and is refused as `unreadable`. Each refusal records `photo_rejected` with the category and the reason only.

## Billable guard

```ts
// src/core/vision.ts:63
interface Adapter { readonly id: string; readonly version: string; readonly billable: boolean }

// src/core/vision.ts:157
export function guardBillable(adapter: Adapter, allowed: boolean = ALLOW_BILLABLE_IMAGES): void {
  if (adapter.billable && !allowed) throw new BillableCallBlocked(adapter.id);
}
```

- `ALLOW_BILLABLE_IMAGES` is `true` only when the build sets `VITE_ALLOW_BILLABLE_IMAGES=true` (`src/core/config.ts:27`). It is read at build time, so a visitor cannot change it.
- Every method of `imageServices()` (`src/core/vision.ts:165`) calls `guardBillable` before calling the adapter. When blocked, colour and garment calls return `{ status: "disabled" }` and image generation returns a `GeneratedImage` with `status: "disabled"`. The provider is never called (tested at `src/core/__tests__/phase2-privacy.test.ts:70`).
- All four mocks have `billable: false`. No billable adapter exists in the repository.

## Derived attributes (Style DNA)

`src/core/styleProfile.ts` holds what is derived from the photo and the answers. **The profile never holds a photo** (`src/core/styleProfile.ts:4`, `:27`).

| Attribute | Where it comes from today | Basis |
|---|---|---|
| `undertone` (`cool`, `warm`, `neutral`) | The mock colour analysis, always `cool`, `source: "sample"` | `inferred` until confirmed or corrected |
| `contrast` (`high`, `medium`, `low`) | The mock colour analysis, always `high`, `source: "sample"` | `inferred` until confirmed or corrected |
| `fit` | The customer's answer | `confirmed` |
| `week` | The customer's answer | `confirmed` |
| `tastes` | Inspiration presets chosen | plain list |
| `photo` | `own`, `sample` or `none`: which kind of photo, not the photo | |

```ts
// src/core/styleProfile.ts:15
export interface Attribute<T> {
  inferred?: { value: T; source: "sample" | "model"; adapter: string; at: string };
  confirmed?: { value: T; at: string };
  corrected?: { value: T; at: string };
}
```

The value used is the correction, then the confirmation, then the estimate (`valueOf`, `src/core/styleProfile.ts:41`). A new analysis replaces only `inferred` (`applyAnalysis`, `src/core/styleProfile.ts:78`) and does nothing if its status is not `completed`.

Where derived attributes go:

| Destination | What | Retention |
|---|---|---|
| `localStorage` `praxis_lab_a` (`dna` field) | The full profile | Until deleted (`RETENTION.styleDna: null`) |
| `sessionStorage` `praxis_dna_draft` | A profile not yet saved | Tab |
| `StylingRequest.styleProfile` | `summarize()` output: each value with its basis, and tastes (`src/core/styleProfile.ts:139`, `src/a/lib/styling.ts:50`) | Sent to the recommendation adapter, which today is the in-browser mock |
| `localStorage` `praxis_styling_history` | The request above, including the summary, with its response | 90 days, last 20 requests |
| Analytics | Never the values. `style_dna_analysis_finished` carries only the status, `style_dna_corrected` only the field name (`src/core/analytics.ts:71`, `:73`) | |

When a production recommendation engine is connected, the profile summary in the styling request will leave the device with each request. That is a separate disclosure from the photo notice.

## Legacy portrait stripping

Earlier builds saved Style DNA with a `portrait` field (possibly a data URL) and fixed `tones` in `localStorage`. On load:

1. `readDna()` (`src/shared/store.ts:60`) converts any non-profile object with `createdAt` through `fromLegacy()` (`src/core/styleProfile.ts:201`). The portrait is not copied; only `photo: "own"` or `"sample"` is kept, and the old colours become `inferred` with `source: "sample"` and adapter `legacy-sample`.
2. A one-time effect (`src/shared/store.ts:103`) checks the raw stored JSON for `"portrait"` or `"tones"` and rewrites the store without them.
3. Saved looks lose any stored `tryOnImage` (`src/shared/store.ts:48`).

Tested at `src/core/__tests__/phase2-privacy.test.ts:145`.

## Retention

From `RETENTION` (`src/core/data.ts:12`), applied by `pruneExpired()` once when the app starts (`src/a/lib/journey.tsx:29`):

| Record | Key | Days |
|---|---|---|
| Styling requests and responses (include the profile summary) | `praxis_styling_history` | 90 |
| Feedback | `praxis_feedback` | 365 |
| Analytics events | `praxis_events` | 90 (also capped at 1000 events) |
| Chosen look per set | `praxis_selections` | 90 |
| Wardrobe by name and type | `praxis_wardrobe` | until deleted (newest 50 kept) |
| Saved looks and Style DNA | `praxis_lab_a` | until deleted |
| Consent records | `praxis_image_consent` | until deleted |
| Face photo, piece photo | `praxis_lab_a_face`, `praxis_lab_a_item` (`sessionStorage`) | until the tab closes |

`STORES` (`src/core/data.ts:30`) lists every key with `where` (`device` or `tab`) and `personal` (`none`, `preferences` or `photo`). Only the two tab keys are marked `photo`.

## Deletion

| Action | Where | Effect |
|---|---|---|
| Delete and change the photo | Style DNA photo step, `src/a/screens/dna/DnaSteps.tsx:48` | Clears the face photo from state, which removes `praxis_lab_a_face`; records `photo_deleted` |
| Delete (Style DNA photo) | `/data`, `src/a/screens/YourData.tsx:35` | Clears state and calls `deleteImages("face_colour")` |
| Delete (photo of your piece) | `/data`, `src/a/screens/YourData.tsx:40` | Sets `image: null` on the item; keeps its name and the wardrobe entry |
| Delete everything on this device | `/data`, `src/a/screens/YourData.tsx:47` | `withdrawConsent` for face and wardrobe, then `deleteLocalData()` removes every `praxis_`-prefixed key in `localStorage` and `sessionStorage` (`src/core/data.ts:81`), resets the identity cache, records `local_data_deleted` under a new anonymous id, and reloads home |
| Close the tab | Browser | `sessionStorage` is discarded, so both photos go |

`deleteLocalData` leaves keys that do not start with `praxis_` alone (tested at `src/core/__tests__/phase2-privacy.test.ts:180`). There is no server copy to delete today.

## Analytics guard

- Closed dictionary: unknown events and unknown properties are refused (`src/core/analytics.ts:130`).
- Every free string is refused if it is over 160 characters or contains `@`, starts with `data:` or `blob:`, or contains `base64` (`src/core/analytics.ts:124`). A photo data URL cannot be recorded.
- Photo events carry an enum category and, for rejections, an enum reason: `photo_consent_given`, `photo_rejected`, `photo_deleted` (`src/core/analytics.ts:76` to `:78`). `wardrobe_item_added` carries only slot and `sample` or `upload` (`:68`). `style_dna_step` for the photo step sends only `own` or `sample` (`src/a/screens/dna/DnaSteps.tsx:71`).
- The only sink today is `localStorage` (`praxis_events`). A future analytics service plugs in through `addSink(sink: AnalyticsSink)` (`src/core/analytics.ts:175`) and receives only events that passed the guard.

## What changes when real server processing is turned on

None of the following exists yet. The code has the seams for it.

1. **Upload interface.** There is no upload code. `ImageInput.ref` (`src/core/vision.ts:15`) is documented to become "a storage reference once uploads exist". An upload step, with transport security, access control and a storage service, has to be built and plugged in before an adapter is called. The adapter then receives the reference, not a data URL.
2. **An adapter.** Implement `ColourAnalysisAdapter`, `GarmentRecognitionAdapter`, `OutfitVisualizationAdapter` or `TryOnAdapter` (`src/core/vision.ts:70` to `:79`), set `billable: true` if the provider charges, return `source: "model"` in every `Inferred` value, and pass it to `imageServices({ ... })`. Body analysis needs a new interface first.
3. **The billing switch.** Set `VITE_ALLOW_BILLABLE_IMAGES=true` in the deployment, only with written authorization (spec section 6 and section 23 I).
4. **The policy fields** in `IMAGE_POLICIES` for that category must then say:

| Field | Must become |
|---|---|
| `processing` | `"server"` (or `"on_device"` if a model runs in the browser) |
| `leavesDevice` | `true` for server processing |
| `retention` | `{ where: "server", maxDays: N }` with the real deletion period, or `"this_tab"` / `"this_device"` only if the server keeps nothing after answering |
| `deletion` | How the server copy is deleted (automatic after N days, and on request), and how long a request takes |
| `why`, `use` | What the model actually reads and returns |
| `consentVersion` | A new value, for example `face-YYYY-MM-DD`. Because `consentFor` compares versions, every earlier consent stops counting and the notice is shown again; `analyseColour` refuses photos carrying the old version |
| `status` | `"collecting"` for body or try-on once a screen asks for them (try-on calls stay `disabled` until then, `src/core/vision.ts:205`) |

5. **Disclosure text.** `disclosure()` already produces "It is sent to Praxis to be analysed." and "Kept on Praxis servers for up to N days." from those fields. If a third-party provider receives the photo, the fixed sentence "sent to Praxis" is no longer complete and `disclosure()` needs a provider field.
6. **Deletion flows.** `deleteImages`, `withdrawConsent` and `deleteLocalData` act only on this browser. Each must also call a server deletion endpoint, which does not exist yet. `GeneratedImage.retention` (`src/core/vision.ts:47`) has `deleteAfter` and `deletable` for generated pictures.
7. **`/data` copy.** "Nothing is sent to a server yet. Photos stay in this tab" (`src/a/screens/YourData.tsx:63`) must change, and the page must list server-held data.
8. **Profile summary.** Once a production recommendation engine replaces the mock, the Style DNA summary leaves the device in every `StylingRequest`. Its disclosure and retention on the server need defining.
9. **Analytics sink.** Any real sink added with `addSink` must be reviewed so it does not add identifiers or enrichment outside the dictionary.

## Requires legal approval before launch

- The wording of every policy field shown to the customer (`why`, `use`, `deletion`, and the sentences from `disclosure()`), for all four categories, before real personal-image processing goes live (spec section 6; `src/core/images.ts:11`).
- Whether face colour analysis counts as processing biometric data or special category data in each launch market, and the lawful basis and form of consent that follows (explicit, separate, per category).
- Server retention periods (`maxDays`) for each category and for generated try-on images.
- The deletion promise: what is deleted, where, and how fast, including provider-side copies and backups.
- Use of any third-party image provider: processor terms, data location and cross-border transfer, and whether the provider may keep or train on images.
- Whether the Style DNA attributes (undertone, contrast, fit) sent with styling requests need their own notice and consent.
- Retention of consent records (`praxis_image_consent`), of request history holding profile summaries (90 days), and of feedback (365 days).
- Age limits for giving a face photo.
- The `/data` page text and the "Delete everything" confirmation.
- The analytics events listed above and any analytics provider added as a sink.
- The mismatch noted in Category C between the wardrobe `use` wording and what the screens do.
