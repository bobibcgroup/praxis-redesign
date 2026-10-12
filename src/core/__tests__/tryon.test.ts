/** See it on me: the request, the stand-in service, the plug-in adapter and the server's check. */
import { describe, expect, it, vi } from "vitest";
import { createHttpTryOn, readGeneratedImage } from "../adapters/tryonHttp";
import { IMAGE_POLICIES } from "../images";
import { buildTryOnRequest, canRetry, checkTryOnRequest, runTryOn, startStep, tryOnReducer, TRYON_MAX_ATTEMPTS, type TryOnOutcome, type TryOnPhoto, type TryOnStep } from "../tryon";
import { BillableCallBlocked, imageServices, mockTryOn, type GeneratedImage, type TryOnAdapter } from "../vision";
import { ANON, FIXED_NOW } from "./helpers";
// @ts-expect-error plain JavaScript module
import { checkTryOnBody, handleTryOn } from "../../../server/tryon.mjs";

const photo: TryOnPhoto = { image: "data:image/jpeg;base64,AAAA", source: "upload", width: 720, height: 960, consentVersion: IMAGE_POLICIES.try_on.consentVersion, takenAt: FIXED_NOW.toISOString() };
const request = buildTryOnRequest({
  anonymousSessionId: ANON,
  recommendationId: "rec_1",
  stylingRequestId: "req_1",
  outfitId: "dinner_sharper_01",
  garmentIds: ["g_top", "g_bottom"],
  photo,
  adapter: { id: mockTryOn.id, version: mockTryOn.version },
  now: FIXED_NOW,
  requestId: "tryon_1",
});
const fast = (image: Partial<GeneratedImage>): { tryOn: TryOnAdapter["tryOn"] } => ({
  tryOn: async (input) => ({ imageId: "i", outfitId: input.outfitId, kind: "try_on", sourceGarmentIds: input.garmentIds, provider: "t", modelVersion: "1", status: "disabled", createdAt: "", retention: { deletable: true }, ...image }),
});

describe("the try-on request", () => {
  it("names the look, its pieces, the set it came from and the consent, but never holds the photo", () => {
    expect(request).toMatchObject({ requestId: "tryon_1", outfitId: "dinner_sharper_01", garmentIds: ["g_top", "g_bottom"], recommendationId: "rec_1", stylingRequestId: "req_1", anonymousSessionId: ANON });
    expect(request.person.consentVersion).toBe(IMAGE_POLICIES.try_on.consentVersion);
    expect(JSON.stringify(request)).not.toContain("data:image");
  });

  it("is never sent without a photo, a look, its pieces or current consent", () => {
    expect(checkTryOnRequest(request, photo)).toBeNull();
    expect(checkTryOnRequest(request, null)).toBe("photo_missing");
    expect(checkTryOnRequest({ ...request, garmentIds: [] }, photo)).toBe("garments_missing");
    expect(checkTryOnRequest({ ...request, person: { ...request.person, consentVersion: "old" } }, photo)).toBe("consent_missing");
    expect(checkTryOnRequest({ ...request, person: { ...request.person, width: 200 } }, photo)).toBe("photo_too_small");
  });
});

describe("running a try-on", () => {
  it("answers honestly that no picture was made while no engine is connected", async () => {
    const out = await runTryOn(request, photo, { services: imageServices({}, false) });
    expect(out.status).toBe("not_connected");
    expect(out.image?.storageRef).toBeUndefined();
    expect(out.requestId).toBe("tryon_1");
  });

  it("shows a picture only when the engine made one for this look", async () => {
    expect((await runTryOn(request, photo, { services: fast({ status: "ready", storageRef: "https://x/y.jpg" }) })).status).toBe("ready");
    expect((await runTryOn(request, photo, { services: { tryOn: async (i) => ({ ...(await fast({ status: "ready", storageRef: "https://x" }).tryOn(i)), outfitId: "other" }) } })).error?.code).toBe("wrong_outfit");
  });

  it("times out, can be cancelled, and reports a failure as retryable or not", async () => {
    const hang = { tryOn: (_i: unknown, o?: { signal?: AbortSignal }) => new Promise<GeneratedImage>((_, reject) => o?.signal?.addEventListener("abort", () => reject(new Error("aborted")))) };
    expect((await runTryOn(request, photo, { services: hang, timeoutMs: 20 })).status).toBe("timed_out");
    const c = new AbortController();
    const run = runTryOn(request, photo, { services: hang, signal: c.signal, timeoutMs: 5000 });
    c.abort();
    expect((await run).status).toBe("cancelled");
    expect((await runTryOn(request, photo, { services: fast({ status: "failed", error: { code: "person_not_found", message: "", retryable: false } }) })).error?.retryable).toBe(false);
    expect((await runTryOn(request, photo, { services: { tryOn: async () => Promise.reject(new Error("net")) } })).error?.code).toBe("network");
  });

  it("never runs a billable engine while paid image calls are off", async () => {
    let called = false;
    const paid: TryOnAdapter = { id: "paid", version: "1", billable: true, tryOn: async (i) => ((called = true), fast({}).tryOn(i)) };
    const out = await runTryOn(request, photo, { services: imageServices({ tryOn: paid }, false) });
    expect(called).toBe(false);
    expect(out.status).toBe("not_connected");
    expect(new BillableCallBlocked("x").name).toBe("BillableCallBlocked");
  });
});

describe("the steps", () => {
  const outcome = (o: Partial<TryOnOutcome>): TryOnOutcome => ({ requestId: "r1", status: "failed", provider: "m", providerVersion: "1", durationMs: 1, ...o });

  it("goes explain, consent, photo, preview, sent, answered", () => {
    let s: TryOnStep = startStep(null);
    expect(s.step).toBe("explain");
    s = tryOnReducer(s, { type: "CONTINUE" });
    expect(s.step).toBe("consent");
    s = tryOnReducer(s, { type: "CONSENTED" });
    s = tryOnReducer(s, { type: "PHOTO", photo });
    expect(s.step).toBe("preview");
    s = tryOnReducer(s, { type: "CONFIRM", requestId: "r1" });
    s = tryOnReducer(s, { type: "STARTED" });
    s = tryOnReducer(s, { type: "SLOW" });
    expect(s).toMatchObject({ step: "processing", slow: true });
    // A late answer to an earlier request is ignored.
    expect(tryOnReducer(s, { type: "ANSWERED", outcome: outcome({ requestId: "old" }) })).toBe(s);
    s = tryOnReducer(s, { type: "ANSWERED", outcome: outcome({ status: "not_connected" }) });
    expect(s.step).toBe("result");
    expect(tryOnReducer(s, { type: "RETAKE" }).step).toBe("capture");
  });

  it("starts at the preview when a photo is already in the tab", () => {
    expect(startStep(photo).step).toBe("preview");
  });

  it("offers Try again only for a failure that can be retried, a limited number of times", () => {
    const failed: TryOnStep = { step: "result", photo, outcome: outcome({ error: { code: "x", message: "", retryable: true } }), attempt: 1 };
    expect(canRetry(failed)).toBe(true);
    expect(canRetry({ ...failed, attempt: TRYON_MAX_ATTEMPTS })).toBe(false);
    expect(canRetry({ ...failed, outcome: outcome({ error: { code: "x", message: "", retryable: false } }) })).toBe(false);
    expect(canRetry({ ...failed, outcome: outcome({ status: "not_connected" }) })).toBe(false);
    expect(tryOnReducer(failed, { type: "RETRY", requestId: "r2" })).toMatchObject({ step: "submitted", requestId: "r2", attempt: 2 });
  });

  it("stops when cancelled and keeps the photo", () => {
    const s = tryOnReducer({ step: "processing", photo, requestId: "r1", attempt: 1, slow: false }, { type: "CANCEL" });
    expect(s).toEqual({ step: "cancelled", photo });
  });
});

describe("the plug-in adapter", () => {
  it("posts the look and photo to this app's server, never to a provider", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ status: "disabled", outfitId: "o", provider: "none", modelVersion: "none" }), { status: 200 }));
    const adapter = createHttpTryOn("/api/tryon", fetcher as unknown as typeof fetch);
    const r = await adapter.tryOn({ requestId: "t", outfitId: "o", garmentIds: ["g"], person: { ref: photo.image, category: "try_on", width: 720, height: 960, consentVersion: "c" } });
    expect(fetcher).toHaveBeenCalledWith("/api/tryon", expect.objectContaining({ method: "POST" }));
    expect(r.status).toBe("disabled");
    expect(adapter.billable).toBe(true);
  });

  it("turns anything unexpected into a failed answer", () => {
    const f = { outfitId: "o", garmentIds: ["g"] };
    expect(readGeneratedImage(null, f).status).toBe("failed");
    expect(readGeneratedImage({ status: "weird", outfitId: "o" }, f).status).toBe("failed");
    expect(readGeneratedImage({ status: "ready", outfitId: "o" }, f).error?.code).toBe("bad_response");
    expect(readGeneratedImage({ status: "ready", outfitId: "o", storageRef: "javascript:x" }, f).status).toBe("failed");
    expect(readGeneratedImage({ status: "ready", outfitId: "x", storageRef: "https://a" }, f).error?.code).toBe("wrong_outfit");
    expect(readGeneratedImage({ status: "ready", outfitId: "o", storageRef: "https://a/b.jpg" }, f).status).toBe("ready");
  });
});

describe("the server's try-on endpoint", () => {
  const body = { requestId: "t", outfitId: "o", garmentIds: ["g"], person: { image: "data:image/jpeg;base64,AAAA", width: 720, height: 960, consentVersion: "tryon-server-2026-10-11" } };

  it("checks every request before anything else", () => {
    expect(checkTryOnBody(body)).toBeNull();
    expect(checkTryOnBody({ ...body, person: { ...body.person, image: "https://elsewhere" } })).toBe("photo_missing");
    expect(checkTryOnBody({ ...body, person: { ...body.person, consentVersion: "tryon-device-2026-10-11" } })).toBe("consent_missing");
    expect(checkTryOnBody({ ...body, garmentIds: [] })).toBe("garments_missing");
  });

  it("answers that no engine is connected when none is set up, and calls nothing", async () => {
    const { Readable } = await import("node:stream");
    const req = Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]), { headers: { "content-type": "application/json" } });
    let status = 0;
    let sent = "";
    const res = { writeHead: (s: number) => (status = s), end: (b: string) => (sent = b), writableEnded: false };
    delete process.env.TRYON_PROVIDER;
    await handleTryOn(req, res);
    expect(status).toBe(200);
    expect(JSON.parse(sent)).toMatchObject({ status: "disabled", outfitId: "o", error: { code: "no_provider" } });
  });
});
