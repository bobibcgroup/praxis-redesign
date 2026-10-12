/**
 * One envelope for every AI service Praxis will use, so each can be swapped from a mock to a real
 * provider without the screens noticing. Each call has its own request id, the person it is for, a
 * typed payload checked before it is sent, a typed result checked when it comes back, a status, an
 * error with a code, a time limit, retries with a pause between them, cancelling, and the provider's
 * name, version and where it processes data.
 *
 * Providers that cost money never run while paid calls are switched off (ALLOW_BILLABLE_IMAGES for
 * images; the same switch for every paid AI call until each has its own), whatever the screen asks.
 * Mocks are free, deterministic and labelled as mocks in every response.
 */
import { ALLOW_BILLABLE_IMAGES } from "../config";
import { newId } from "../ids";

export type ServiceName =
  | "styling_recommendation"
  | "styling_explanation"
  | "outfit_visualization"
  | "virtual_try_on"
  | "face_colour_analysis"
  | "body_fit_analysis"
  | "garment_recognition"
  | "product_matching"
  | "inventory_pricing";

export const SERVICE_CONTRACT_VERSION = "ai-2026-10-12";

export interface ServiceRequest<P> {
  requestId: string;
  service: ServiceName;
  contractVersion: string;
  anonymousSessionId: string;
  userId?: string;
  /** 1 for the first try; each retry is a new attempt of the same request. */
  attempt: number;
  createdAt: string;
  payload: P;
}

/**
 * succeeded: a full answer. partial: some of it. empty: a valid answer with nothing in it.
 * disabled: no provider may run (switched off or not connected); nothing was made.
 */
export type ServiceStatus = "succeeded" | "partial" | "empty" | "failed" | "timed_out" | "cancelled" | "disabled";

export type ServiceErrorCode = "validation_error" | "invalid_response" | "provider_error" | "timeout" | "cancelled" | "billing_blocked" | "not_connected" | "consent_missing";

export interface ServiceError {
  code: ServiceErrorCode;
  message: string;
  retryable: boolean;
}

export interface ProviderInfo {
  id: string;
  version: string;
  /** mock: deterministic stand-in. live: a real provider. */
  mode: "mock" | "live";
  /** Where the input is processed. A provider that sends data off the device must say so. */
  processing: "none" | "on_device" | "server";
  billable: boolean;
}

export interface ServiceResponse<R> {
  requestId: string;
  service: ServiceName;
  contractVersion: string;
  status: ServiceStatus;
  result?: R;
  error?: ServiceError;
  provider: ProviderInfo;
  attempts: number;
  durationMs: number;
  completedAt: string;
  /** Small, non-personal facts for tracing (never a photo, an email or free text). */
  metadata: Record<string, string | number | boolean>;
}

/** What a provider hands back; the envelope adds the rest. */
export interface ProviderAnswer<R> {
  status: "succeeded" | "partial" | "empty" | "failed" | "disabled";
  result?: R;
  error?: ServiceError;
  metadata?: Record<string, string | number | boolean>;
}

export interface ServiceProvider<P, R> extends ProviderInfo {
  run(request: ServiceRequest<P>, options: { signal: AbortSignal }): Promise<ProviderAnswer<R>>;
}

export interface ServiceDefinition<P, R> {
  service: ServiceName;
  /** Null when the payload is complete; otherwise what is wrong with it. Runs before anything is sent. */
  checkPayload(payload: unknown): string | null;
  /** Null when the result has the promised shape. Runs on every answer, mock or live. */
  checkResult(result: unknown): string | null;
  timeoutMs: number;
  /** Retries after the first try, for errors marked retryable. */
  retries: number;
  /** Pause before each retry; doubles every time. */
  backoffMs: number;
  /** Type-only marker tying the definition to its payload and result; never set. */
  readonly __types?: (payload: P) => R;
}

export interface CallOptions {
  signal?: AbortSignal;
  /** Overrides the definition, for tests and test mode. */
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
  allowBillable?: boolean;
  now?: () => number;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), reject(new DOMException("Aborted", "AbortError"))), { once: true });
  });
}

export function buildServiceRequest<P>(service: ServiceName, payload: P, who: { anonymousSessionId: string; userId?: string }, requestId = newId(service.split("_")[0])): ServiceRequest<P> {
  return {
    requestId,
    service,
    contractVersion: SERVICE_CONTRACT_VERSION,
    anonymousSessionId: who.anonymousSessionId,
    ...(who.userId ? { userId: who.userId } : {}),
    attempt: 1,
    createdAt: new Date().toISOString(),
    payload,
  };
}

/**
 * Runs one request through a provider: checks the payload, refuses paid providers while paid calls
 * are off, applies the time limit to each try, retries retryable failures with a growing pause,
 * honours cancelling, and checks the result. Always resolves; never throws.
 */
export async function callService<P, R>(def: ServiceDefinition<P, R>, provider: ServiceProvider<P, R>, request: ServiceRequest<P>, options: CallOptions = {}): Promise<ServiceResponse<R>> {
  const now = options.now ?? Date.now;
  const started = now();
  const info: ProviderInfo = { id: provider.id, version: provider.version, mode: provider.mode, processing: provider.processing, billable: provider.billable };
  let attempts = 0;
  const finish = (status: ServiceStatus, extra: Partial<ServiceResponse<R>> = {}): ServiceResponse<R> => ({
    requestId: request.requestId,
    service: def.service,
    contractVersion: request.contractVersion,
    status,
    provider: info,
    attempts,
    durationMs: Math.max(0, now() - started),
    completedAt: new Date().toISOString(),
    metadata: {},
    ...extra,
  });

  const invalid = def.checkPayload(request.payload);
  if (invalid) return finish("failed", { error: { code: "validation_error", message: invalid, retryable: false } });
  if (provider.billable && !(options.allowBillable ?? ALLOW_BILLABLE_IMAGES)) {
    return finish("disabled", { error: { code: "billing_blocked", message: "Paid AI calls are switched off.", retryable: false } });
  }

  const retries = options.retries ?? def.retries;
  const limit = options.timeoutMs ?? def.timeoutMs;
  const backoff = options.backoffMs ?? def.backoffMs;
  const outer = options.signal;
  let last: ServiceResponse<R> | null = null;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    attempts = attempt;
    if (outer?.aborted) return finish("cancelled", { error: { code: "cancelled", message: "Cancelled.", retryable: false } });
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    outer?.addEventListener("abort", onAbort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, limit);
    try {
      const answer = await provider.run({ ...request, attempt }, { signal: controller.signal });
      if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
      if (answer.status === "disabled") return finish("disabled", { error: answer.error ?? { code: "not_connected", message: "No provider is connected.", retryable: false }, metadata: answer.metadata ?? {} });
      if (answer.status === "failed") {
        last = finish("failed", { error: answer.error ?? { code: "provider_error", message: "The provider failed.", retryable: true }, metadata: answer.metadata ?? {} });
      } else {
        const bad = answer.status === "empty" && answer.result === undefined ? null : def.checkResult(answer.result);
        if (bad) last = finish("failed", { error: { code: "invalid_response", message: bad, retryable: false } });
        else return finish(answer.status, { result: answer.result, metadata: answer.metadata ?? {} });
      }
    } catch {
      if (timedOut) last = finish("timed_out", { error: { code: "timeout", message: "The provider took too long.", retryable: true } });
      else if (outer?.aborted) return finish("cancelled", { error: { code: "cancelled", message: "Cancelled.", retryable: false } });
      else last = finish("failed", { error: { code: "provider_error", message: "The provider could not be reached.", retryable: true } });
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener("abort", onAbort);
    }
    if (!last?.error?.retryable || attempt > retries) break;
    try {
      await sleep(backoff * 2 ** (attempt - 1), outer ?? new AbortController().signal);
    } catch {
      return finish("cancelled", { error: { code: "cancelled", message: "Cancelled.", retryable: false } });
    }
  }
  return last ?? finish("failed", { error: { code: "provider_error", message: "No answer.", retryable: true } });
}
