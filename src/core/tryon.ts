/**
 * See it on me: the try-on request, from the look the customer chose and the photo they gave, to an
 * honest answer. The screens never talk to an adapter: they build a request here and run it here, so
 * connecting a real engine changes the adapter (vision.ts, adapters/tryonHttp.ts) and nothing else.
 *
 * The request is a record that can be kept and traced; the photo travels beside it, never inside it,
 * so a request can be logged or stored without the picture. The photo itself lives in this tab only
 * (see IMAGE_KEYS in images.ts).
 */
import { newId, readJson, session, writeJson } from "./ids";
import { IMAGE_KEYS, IMAGE_POLICIES } from "./images";
import { simScenario } from "./sim";
import { imageServices, type GeneratedImage, type TryOnAdapter } from "./vision";

export const TRYON_CONTRACT = "tryon-2026-10-11";
/** How long a try-on may run before it is given up as timed out. */
export const TRYON_TIMEOUT_MS = 45_000;
/** In test mode's timeout scenario, the limit is short so the state can be seen. */
export const TRYON_SIM_TIMEOUT_MS = 6000;
/** When a try-on has run this long, the screen says it is taking longer than usual. */
export const TRYON_SLOW_AFTER_MS = 5000;

export interface TryOnPhoto {
  /** A data URL held in this tab. */
  image: string;
  source: "camera" | "upload";
  width: number;
  height: number;
  /** The consent wording the customer agreed to when giving it. */
  consentVersion: string;
  takenAt: string;
}

export interface TryOnRequest {
  requestId: string;
  contractVersion: string;
  anonymousSessionId: string;
  userId?: string;
  /** The set of looks and the styling request the chosen look came from. */
  recommendationId: string;
  stylingRequestId: string;
  outfitId: string;
  /** The pieces to show on the customer, in the order they are worn. */
  garmentIds: string[];
  person: { source: TryOnPhoto["source"]; width: number; height: number; consentVersion: string };
  adapter: { id: string; version: string };
  createdAt: string;
}

/** What the customer is told. "not_connected" is the honest answer while no engine is switched on. */
export type TryOnStatus = "ready" | "not_connected" | "failed" | "timed_out" | "cancelled";

export interface TryOnOutcome {
  requestId: string;
  status: TryOnStatus;
  image?: GeneratedImage;
  error?: { code: string; message: string; retryable: boolean };
  provider: string;
  providerVersion: string;
  durationMs: number;
}

export function buildTryOnRequest(input: {
  anonymousSessionId: string;
  userId?: string;
  recommendationId: string;
  stylingRequestId: string;
  outfitId: string;
  garmentIds: string[];
  photo: TryOnPhoto;
  adapter: { id: string; version: string };
  now?: Date;
  requestId?: string;
}): TryOnRequest {
  return {
    requestId: input.requestId ?? newId("tryon"),
    contractVersion: TRYON_CONTRACT,
    anonymousSessionId: input.anonymousSessionId,
    ...(input.userId ? { userId: input.userId } : {}),
    recommendationId: input.recommendationId,
    stylingRequestId: input.stylingRequestId,
    outfitId: input.outfitId,
    garmentIds: [...input.garmentIds],
    person: { source: input.photo.source, width: input.photo.width, height: input.photo.height, consentVersion: input.photo.consentVersion },
    adapter: input.adapter,
    createdAt: (input.now ?? new Date()).toISOString(),
  };
}

/** Problems with a request that mean it is never sent. */
export function checkTryOnRequest(request: TryOnRequest, photo: TryOnPhoto | null): string | null {
  if (!photo?.image) return "photo_missing";
  if (!request.outfitId) return "outfit_missing";
  if (request.garmentIds.length === 0) return "garments_missing";
  if (request.person.consentVersion !== IMAGE_POLICIES.try_on.consentVersion) return "consent_missing";
  if (Math.min(request.person.width, request.person.height) < IMAGE_POLICIES.try_on.minEdge) return "photo_too_small";
  return null;
}

type Services = Pick<ReturnType<typeof imageServices>, "tryOn">;

/**
 * Runs one try-on: sends it through the image services (which refuse billable calls while they are
 * switched off), gives up after the time limit, and stops when cancelled. Always resolves.
 */
export async function runTryOn(
  request: TryOnRequest,
  photo: TryOnPhoto,
  options: { signal?: AbortSignal; timeoutMs?: number; services?: Services; adapter?: Pick<TryOnAdapter, "id" | "version"> } = {},
): Promise<TryOnOutcome> {
  const started = Date.now();
  const services = options.services ?? imageServices();
  const provider = options.adapter?.id ?? request.adapter.id;
  const providerVersion = options.adapter?.version ?? request.adapter.version;
  const done = (status: TryOnStatus, extra: Partial<TryOnOutcome> = {}): TryOnOutcome => ({ requestId: request.requestId, status, provider, providerVersion, durationMs: Date.now() - started, ...extra });

  const invalid = checkTryOnRequest(request, photo);
  if (invalid) return done("failed", { error: { code: invalid, message: "The try-on request is incomplete.", retryable: false } });

  const controller = new AbortController();
  const outer = options.signal;
  const onAbort = () => controller.abort();
  outer?.addEventListener("abort", onAbort, { once: true });
  let timedOut = false;
  const limit = options.timeoutMs ?? (simScenario() === "timeout" ? TRYON_SIM_TIMEOUT_MS : TRYON_TIMEOUT_MS);
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, limit);

  try {
    const image = await services.tryOn(
      {
        requestId: request.requestId,
        outfitId: request.outfitId,
        garmentIds: request.garmentIds,
        person: { ref: photo.image, category: "try_on", width: photo.width, height: photo.height, consentVersion: photo.consentVersion },
      },
      { signal: controller.signal },
    );
    if (image.outfitId !== request.outfitId) return done("failed", { error: { code: "wrong_outfit", message: "The answer was for a different look.", retryable: true } });
    if (image.status === "ready" && image.storageRef) return done("ready", { image });
    if (image.status === "failed") return done("failed", { image, error: image.error ?? { code: "failed", message: "The try-on did not work.", retryable: true } });
    return done("not_connected", { image });
  } catch {
    if (timedOut) return done("timed_out", { error: { code: "timeout", message: "The try-on took too long.", retryable: true } });
    if (outer?.aborted) return done("cancelled");
    return done("failed", { error: { code: "network", message: "The try-on service could not be reached.", retryable: true } });
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", onAbort);
  }
}

/* ------------------------------------------------------------ the photo */

const PHOTO_KEY = IMAGE_KEYS.try_on as string;

/** The try-on photo in this tab, if it was given under the current consent wording. */
export function readTryOnPhoto(tab: () => Storage | undefined = session): TryOnPhoto | null {
  const p = readJson<TryOnPhoto>(tab(), PHOTO_KEY);
  if (!p || typeof p.image !== "string" || p.consentVersion !== IMAGE_POLICIES.try_on.consentVersion) return null;
  return p;
}

/** Keeps the photo in this tab. False when the tab cannot hold it (the screen still has it in memory). */
export function writeTryOnPhoto(photo: TryOnPhoto | null, tab: () => Storage | undefined = session): boolean {
  return writeJson(tab(), PHOTO_KEY, photo);
}

/* ------------------------------------------------------------ the flow */

/**
 * The steps of See it on me, as a typed state machine. The screen shows what this says; nothing here
 * pretends to progress.
 */
export type TryOnStep =
  | { step: "explain" }
  | { step: "consent" }
  | { step: "capture" }
  | { step: "preview"; photo: TryOnPhoto }
  | { step: "submitted"; photo: TryOnPhoto; requestId: string; attempt: number }
  | { step: "processing"; photo: TryOnPhoto; requestId: string; attempt: number; slow: boolean }
  | { step: "result"; photo: TryOnPhoto; outcome: TryOnOutcome; attempt: number }
  | { step: "cancelled"; photo: TryOnPhoto };

export type TryOnEvent =
  | { type: "CONTINUE" }
  | { type: "CONSENTED" }
  | { type: "PHOTO"; photo: TryOnPhoto }
  | { type: "RETAKE" }
  | { type: "CONFIRM"; requestId: string }
  | { type: "STARTED" }
  | { type: "SLOW" }
  | { type: "ANSWERED"; outcome: TryOnOutcome }
  | { type: "CANCEL" }
  | { type: "RETRY"; requestId: string };

/** Tries in all before Try again is no longer offered. */
export const TRYON_MAX_ATTEMPTS = 3;

export function tryOnReducer(state: TryOnStep, event: TryOnEvent): TryOnStep {
  switch (event.type) {
    case "CONTINUE":
      return state.step === "explain" ? { step: IMAGE_POLICIES.try_on.status === "collecting" ? "consent" : "explain" } : state;
    case "CONSENTED":
      return state.step === "consent" ? { step: "capture" } : state;
    case "PHOTO":
      return state.step === "capture" || state.step === "preview" ? { step: "preview", photo: event.photo } : state;
    case "RETAKE":
      return { step: "capture" };
    case "CONFIRM":
      return state.step === "preview" || state.step === "cancelled" ? { step: "submitted", photo: state.photo, requestId: event.requestId, attempt: 1 } : state;
    case "STARTED":
      return state.step === "submitted" ? { step: "processing", photo: state.photo, requestId: state.requestId, attempt: state.attempt, slow: false } : state;
    case "SLOW":
      return state.step === "processing" ? { ...state, slow: true } : state;
    case "ANSWERED":
      if ((state.step !== "processing" && state.step !== "submitted") || event.outcome.requestId !== state.requestId) return state;
      if (event.outcome.status === "cancelled") return { step: "cancelled", photo: state.photo };
      return { step: "result", photo: state.photo, outcome: event.outcome, attempt: state.attempt };
    case "CANCEL":
      return state.step === "processing" || state.step === "submitted" ? { step: "cancelled", photo: state.photo } : state;
    case "RETRY":
      if (state.step !== "result" || !canRetry(state)) return state;
      return { step: "submitted", photo: state.photo, requestId: event.requestId, attempt: state.attempt + 1 };
  }
}

export function canRetry(state: TryOnStep): boolean {
  if (state.step !== "result") return false;
  const { outcome } = state;
  const retryable = outcome.status === "timed_out" || (outcome.status === "failed" && outcome.error?.retryable !== false);
  return retryable && state.attempt < TRYON_MAX_ATTEMPTS;
}

/** Where the flow starts: a photo already given under the current wording goes straight to its preview. */
export function startStep(photo: TryOnPhoto | null): TryOnStep {
  return photo ? { step: "preview", photo } : { step: "explain" };
}
