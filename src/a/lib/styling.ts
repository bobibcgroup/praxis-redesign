/**
 * The screens' side of the recommendation service. The answers in the URL, the piece the customer
 * owns and their Style DNA become one styling request; the response for exactly those inputs is
 * what the build, the results and the try-on show. The build follows the request through the
 * processing states in src/core/processing.ts.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { track } from "../../core/analytics";
import type { StylingRequest, StylingResponse, WardrobeItemRef } from "../../core/contracts";
import { feedbackStore, preferenceSnapshot } from "../../core/feedback";
import { anonymousId } from "../../core/identity";
import { shortHash } from "../../core/ids";
import { processingReducer, resubmit, SLOW_AFTER_MS, type ProcessingEvent, type ProcessingState } from "../../core/processing";
import { buildStylingRequest, completeInputs, inputKeyFor, wardrobeRef, type MomentInputs } from "../../core/request";
import { requestHistory, stylingService } from "../../core/service";
import { profileRef, summarize, type StyleProfile } from "../../core/styleProfile";
import { useJourney } from "./journeyContext";

export interface StylingSpec {
  inputs: MomentInputs;
  wardrobe: WardrobeItemRef[];
  styleProfileId?: string;
  styleProfile?: StyleProfile;
  inputKey: string;
}

/** Everything the customer has told Praxis for this moment, or null while a question is open. */
export function useStylingSpec(): StylingSpec | null {
  const { answers, ownedItem, store } = useJourney();
  const dna = store.dna;
  return useMemo(() => {
    const inputs = completeInputs(answers);
    if (!inputs) return null;
    const wardrobe =
      answers.item && ownedItem && ownedItem.slot === answers.item
        ? [wardrobeRef(ownedItem.slot, ownedItem.name, ownedItem.image ? "upload" : "sample", ownedItem.image ? shortHash(ownedItem.image) : "")]
        : [];
    const styleProfileId = dna ? profileRef(dna) : undefined;
    return { inputs, wardrobe, styleProfileId, styleProfile: dna ?? undefined, inputKey: inputKeyFor(inputs, wardrobe, styleProfileId) };
  }, [answers, ownedItem, dna]);
}

function requestFor(spec: StylingSpec, userId: string | undefined): StylingRequest {
  const anon = anonymousId();
  return buildStylingRequest(spec.inputs, {
    anonymousSessionId: anon,
    userId,
    wardrobe: spec.wardrobe,
    styleProfileId: spec.styleProfileId,
    styleProfile: spec.styleProfile ? summarize(spec.styleProfile) : undefined,
    preferences: preferenceSnapshot(feedbackStore.all(), { anonymousSessionId: anon, userId }),
  });
}

/** Sends one request and records what happened to it. */
async function send(request: StylingRequest, signal?: AbortSignal): Promise<StylingResponse> {
  const service = stylingService();
  track("styling_submitted", { requestId: request.requestId, inputKey: request.inputKey, adapter: `${service.adapter.id}/${service.adapter.version}`, wardrobeItems: request.wardrobeItems.length });
  track("processing_started", { requestId: request.requestId });
  const started = performance.now();
  const response = await service.recommend(request, { signal });
  if (response.error?.code === "cancelled") return response;
  if (response.status === "failed") track("processing_failed", { requestId: request.requestId, code: response.error?.code ?? "unknown" });
  else track("processing_completed", { requestId: request.requestId, recommendationId: response.recommendationId, status: response.status, outfits: response.outfits.length, durationMs: Math.round(performance.now() - started) });
  lastAnswer.set(request.inputKey, response);
  return response;
}

/** Requests in flight by input key, so a remount (or React's development double run) never sends twice. */
const inflight = new Map<string, Promise<StylingResponse>>();

/**
 * The last answer in this tab for each input key, failures included. History keeps only answers worth
 * showing again, so without this a failure would be sent again, unasked, by the next screen.
 * Trying again is the customer's choice (the Try again button), or a reload.
 */
const lastAnswer = new Map<string, StylingResponse>();

/** Sends a fresh request for these inputs, unless one for the same inputs is already on its way. */
export function submitStyling(spec: StylingSpec, userId: string | undefined): Promise<StylingResponse> {
  const pending = inflight.get(spec.inputKey);
  if (pending) return pending;
  const run = send(requestFor(spec, userId)).finally(() => inflight.delete(spec.inputKey));
  inflight.set(spec.inputKey, run);
  return run;
}

function lastFailure(inputKey: string): StylingResponse | null {
  const last = lastAnswer.get(inputKey);
  return last?.status === "failed" ? last : null;
}

/**
 * The response for these exact inputs: the latest one on record, or a new request when there is
 * none (a shared link, or storage that was cleared).
 */
export function useStylingResponse(spec: StylingSpec | null): { response: StylingResponse | null; loading: boolean } {
  const { user } = useJourney();
  const known = spec ? (requestHistory.latest(spec.inputKey)?.response ?? lastFailure(spec.inputKey)) : null;
  const [fetched, setFetched] = useState<StylingResponse | null>(null);
  const userId = user?.id;

  useEffect(() => {
    if (!spec || known) return;
    let alive = true;
    void submitStyling(spec, userId).then((r) => {
      if (alive) setFetched(r);
    });
    return () => {
      alive = false;
    };
  }, [spec, known, userId]);

  const response = known ?? (fetched && spec && fetched.inputKey === spec.inputKey ? fetched : null);
  return { response, loading: Boolean(spec) && !response };
}

type RunEvent = ProcessingEvent | { type: "RESUBMIT" };

function runReducer(state: ProcessingState, event: RunEvent): ProcessingState {
  return event.type === "RESUBMIT" ? resubmit(state) : processingReducer(state, event);
}

export interface StylingRun {
  state: ProcessingState;
  retry: () => void;
  cancel: () => void;
  /** After a cancel: a fresh request for the same answers. */
  restart: () => void;
}

/**
 * One styling request from the build screen, through its states: sent, working, taking longer than
 * usual, answered (complete, partial or empty), failed with Try again, out of tries, or cancelled.
 * Each try is a new request with its own id.
 */
export function useStylingRun(spec: StylingSpec | null, userId: string | undefined): StylingRun {
  const [state, dispatch] = useReducer(runReducer, { status: "idle" });
  const [attempt, setAttempt] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const requestId = useRef<string | null>(null);
  const retrying = useRef(false);
  const key = spec?.inputKey ?? null;

  useEffect(() => {
    if (!spec) return;
    const c = new AbortController();
    controller.current = c;
    const request = requestFor(spec, userId);
    requestId.current = request.requestId;
    if (retrying.current) {
      retrying.current = false;
      dispatch({ type: "RESUBMIT" });
    } else {
      dispatch({ type: "RESET" });
      dispatch({ type: "SUBMIT" });
      // The answers were checked when the spec was built: an incomplete set never gets here.
      dispatch({ type: "INPUTS_VALID" });
    }
    dispatch({ type: "STARTED" });
    const slow = setTimeout(() => {
      dispatch({ type: "SLOW" });
      track("processing_delayed", { requestId: request.requestId });
    }, SLOW_AFTER_MS);
    void send(request, c.signal).then((response) => {
      clearTimeout(slow);
      if (!c.signal.aborted) dispatch({ type: "ANSWERED", response });
    });
    return () => {
      clearTimeout(slow);
      c.abort();
    };
    // A new run for new inputs, a new user, or a retry; nothing else.
  }, [key, userId, attempt]);

  const retry = useCallback(() => {
    if (state.status !== "failed") return;
    track("retry_requested", { attempt: state.attempt + 1, code: state.code });
    dispatch({ type: "RETRY" });
    retrying.current = true;
    setAttempt((a) => a + 1);
  }, [state]);

  const cancel = useCallback(() => {
    if (requestId.current) track("processing_cancelled", { requestId: requestId.current });
    dispatch({ type: "CANCEL" });
    controller.current?.abort();
  }, []);

  const restart = useCallback(() => setAttempt((a) => a + 1), []);

  return { state, retry, cancel, restart };
}
