/**
 * The life of one styling request, as a typed state machine. The screens show what this says, and
 * this follows what the service actually does: no timers pretending to be progress, no percentages.
 */
import type { StylingResponse } from "./contracts";

export type ProcessingState =
  | { status: "idle" }
  | { status: "validating" }
  | { status: "submitted"; attempt: number }
  | { status: "processing"; attempt: number }
  | { status: "delayed"; attempt: number }
  | { status: "partial"; response: StylingResponse }
  | { status: "completed"; response: StylingResponse }
  | { status: "empty"; response: StylingResponse }
  | { status: "failed"; attempt: number; code: string; retryable: boolean; response?: StylingResponse }
  | { status: "retry_requested"; attempt: number }
  | { status: "retry_exhausted"; attempt: number; code: string }
  | { status: "cancelled" };

export type ProcessingEvent =
  | { type: "SUBMIT" }
  | { type: "INPUTS_VALID" }
  | { type: "INPUTS_INVALID" }
  | { type: "STARTED" }
  | { type: "SLOW" }
  | { type: "ANSWERED"; response: StylingResponse }
  | { type: "RETRY" }
  | { type: "CANCEL" }
  | { type: "RESET" };

/** Tries in all, the first included, before the screen stops offering Try again. */
export const MAX_ATTEMPTS = 3;
/** When a request has run this long, the screen says it is taking longer than usual. */
export const SLOW_AFTER_MS = 5000;
/** When a request has run this long, it is given up as timed out. */
export const TIMEOUT_MS = 20000;

const WORKING = new Set(["submitted", "processing", "delayed"]);

export function isWorking(s: ProcessingState): boolean {
  return WORKING.has(s.status) || s.status === "validating" || s.status === "retry_requested";
}

function attemptOf(s: ProcessingState): number {
  return "attempt" in s ? s.attempt : 0;
}

export function processingReducer(state: ProcessingState, event: ProcessingEvent): ProcessingState {
  switch (event.type) {
    case "RESET":
      return { status: "idle" };
    case "SUBMIT":
      return state.status === "idle" || state.status === "cancelled" ? { status: "validating" } : state;
    case "INPUTS_INVALID":
      return state.status === "validating" ? { status: "idle" } : state;
    case "INPUTS_VALID":
      return state.status === "validating" ? { status: "submitted", attempt: 1 } : state;
    case "STARTED":
      return state.status === "submitted" ? { status: "processing", attempt: state.attempt } : state;
    case "SLOW":
      return state.status === "processing" || state.status === "submitted" ? { status: "delayed", attempt: state.attempt } : state;
    case "ANSWERED": {
      if (!WORKING.has(state.status)) return state;
      const r = event.response;
      if (r.status === "completed") return { status: "completed", response: r };
      if (r.status === "partial") return { status: "partial", response: r };
      if (r.status === "empty") return { status: "empty", response: r };
      const attempt = attemptOf(state);
      const code = r.error?.code ?? "unknown";
      const retryable = r.error?.retryable !== false;
      if (!retryable || attempt >= MAX_ATTEMPTS) return { status: "retry_exhausted", attempt, code };
      return { status: "failed", attempt, code, retryable, response: r };
    }
    case "RETRY":
      if (state.status !== "failed" || !state.retryable) return state;
      return { status: "retry_requested", attempt: state.attempt + 1 };
    case "CANCEL":
      return isWorking(state) ? { status: "cancelled" } : state;
  }
}

/** From retry_requested, the request goes out again as a new submission at the same attempt. */
export function resubmit(state: ProcessingState): ProcessingState {
  return state.status === "retry_requested" ? { status: "submitted", attempt: state.attempt } : state;
}
