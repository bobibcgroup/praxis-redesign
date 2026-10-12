# See it on me: the try-on flow and how a real engine plugs in

Status: **mock functional, integration ready.** The whole customer journey works today against a
stand-in service that makes no picture and says so. A real engine connects by adding one provider
file on the server and setting four environment variables; no screen changes.

## The journey

From the results, "See it on me" (`src/a/screens/moment/Results.tsx`) opens the Premium gate if
needed, then `/moment/tryon` with the chosen look in the URL (`hero`). One page walks through
each step, driven by the state machine `tryOnReducer` in `src/core/tryon.ts`:

| Step | What the customer sees | Leaves by |
| --- | --- | --- |
| `explain` | What try-on does, and that it is not switched on yet | Continue, Back to your looks |
| `consent` | `PhotoConsent` for `try_on`: why, how it is used, where it goes, how long, how to delete (read from `IMAGE_POLICIES.try_on`) | I agree, Not now. Skipped when current consent exists |
| `capture` | Tips, then Take a photo (front camera) or Upload a photo. No sample: a sample is not you | A photo that passes the checks |
| `preview` | The photo back in the print | Use this photo, Retake |
| `submitted`, `processing` | "Sending your try-on." After 5 s: "taking longer than usual". No percentages | Stop |
| `cancelled` | Nothing made, photo kept | Send again, Use another photo |
| `result` | `ready`: the picture, labelled as made from your photo. `not_connected`: plainly that no picture can be made yet. `failed` or `timed_out`: why, and what to do | Try again (retryable failures, 3 tries in all), Use another photo, Check out, Back to your looks |

Checks on every photo (`src/core/images.ts`): JPEG, PNG, WebP or HEIC, under 15 MB, shorter edge
at least 480 px, not too dark or too bright. Camera problems are named (access off, no camera,
camera in use) with upload as the way on (`src/a/ui/Capture.tsx`).

A photo already given in this tab under the current consent wording opens straight at the preview.
Retake, "Use another photo", sign out, "Your data on this device" and closing the tab delete it.

## The request

`buildTryOnRequest` makes a `TryOnRequest`: its own `requestId`, the contract version, the anonymous
and user ids, the `recommendationId` and styling `requestId` the look came from, the `outfitId`, the
`garmentIds` in wearing order, the photo's source, size and consent version, and the adapter. The
photo is never inside the request; it travels beside it. The last request and its answer, without
the photo, are kept in the tab (`praxis_tryon_request`) for tracing.

`runTryOn` sends it through `imageServices().tryOn` (`src/core/vision.ts`), which refuses a missing
or old consent and any billable adapter while paid image calls are off, applies a 45 s time limit,
honours Stop, and always resolves to a `TryOnOutcome`:
`ready | not_connected | failed | timed_out | cancelled`, with the provider, its version, the
duration and an error code when there is one. An answer for a different look is refused
(`wrong_outfit`). A late answer to an earlier request never replaces the current one.

Analytics: `tryon_opened`, `tryon_photo_ready` (source only), `tryon_submitted`, `tryon_answered`
(status, code, duration), `photo_consent_given`, `photo_rejected`, `photo_deleted`. Never the photo.

## The stand-in service

`mockTryOn` (`src/core/vision.ts`) waits 1.2 s and answers `disabled` (shown as "not connected").
It never returns a picture. Test mode (`/internal`) makes it slow (7.5 s), time out (limit 6 s),
fail with a retryable error (`failure`), or refuse the photo (`invalid_image`, code
`person_not_found`, not retryable).

## Plugging in a real engine

1. Write `server/providers/<name>.mjs` exporting `id`, `version`, `billable` and
   `async tryOn(request, { signal })` (see `server/providers/README.md` and `example.mjs`). It reads
   its API key from the server environment and returns the `GeneratedImage` shape: `status: "ready"`
   with `storageRef` (an https URL or a data URL), or `status: "failed"` with an error code.
2. Server environment: `TRYON_PROVIDER=<name>`, and `ALLOW_BILLABLE_IMAGES=true` if it costs money.
3. Build environment: `VITE_TRYON_ADAPTER=http` and `VITE_ALLOW_BILLABLE_IMAGES=true`.
4. The page then posts to `POST /api/tryon` (`server/tryon.mjs`). The server checks the body (8 MB
   limit, data URL image, `tryon-server-*` consent), calls the provider with a 40 s limit, logs only
   the request id, status and time, and never writes the photo anywhere.
5. With `VITE_TRYON_ADAPTER=http`, the photo policy switches to `TRY_ON_SERVER`: the consent notice
   says the photo is sent and deleted within a day, and its new consent version asks everyone again.
   That wording needs legal review before launch.

Before going live: a server-side Premium check on `/api/tryon` (today Premium is a stand-in in the
browser), garment images for each piece that the provider can use, and the provider's own retention
and deletion terms matched to the policy.

## Tests

- Unit (`src/core/__tests__/tryon.test.ts`): the request, its checks, every outcome, time out,
  cancel, the billable switch, the steps and retry limit, the http adapter's response checks, the
  server's body checks and its default "no provider" answer.
- Browser (`e2e/scenarios.mjs`): TRY1 the whole journey at 375, 390, 430 and 768 px; TRY2 refused
  photos; TRY3 failure and Try again; TRY4 slow and Stop; TRY5 camera unavailable; TRY6 no Premium;
  TRY7 a live camera (Chromium's fake device).
