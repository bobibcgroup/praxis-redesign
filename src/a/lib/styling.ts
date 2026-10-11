/**
 * The screens' side of the recommendation service. The answers in the URL, the piece the customer
 * owns and their Style DNA become one styling request; the response for exactly those inputs is
 * what the build, the results and the try-on show.
 */
import { useEffect, useMemo, useState } from "react";
import { track } from "../../core/analytics";
import type { StylingResponse, WardrobeItemRef } from "../../core/contracts";
import { feedbackStore, preferenceSnapshot } from "../../core/feedback";
import { anonymousId } from "../../core/identity";
import { shortHash } from "../../core/ids";
import { buildStylingRequest, completeInputs, inputKeyFor, wardrobeRef, type MomentInputs } from "../../core/request";
import { requestHistory, stylingService } from "../../core/service";
import type { SavedDna } from "../../shared/store";
import { useJourney } from "./journeyContext";

export interface StylingSpec {
  inputs: MomentInputs;
  wardrobe: WardrobeItemRef[];
  styleProfileId?: string;
  inputKey: string;
}

export function styleProfileIdFor(dna: SavedDna | null): string | undefined {
  return dna ? `dna_${shortHash(dna.createdAt)}` : undefined;
}

/** Everything the customer has told Praxis for this moment, or null while a question is open. */
export function useStylingSpec(): StylingSpec | null {
  const { answers, ownedItem, store } = useJourney();
  const dnaId = styleProfileIdFor(store.dna);
  return useMemo(() => {
    const inputs = completeInputs(answers);
    if (!inputs) return null;
    const wardrobe =
      answers.item && ownedItem && ownedItem.slot === answers.item
        ? [wardrobeRef(ownedItem.slot, ownedItem.name, ownedItem.image ? "upload" : "sample", ownedItem.image ? shortHash(ownedItem.image) : "")]
        : [];
    return { inputs, wardrobe, styleProfileId: dnaId, inputKey: inputKeyFor(inputs, wardrobe, dnaId) };
  }, [answers, ownedItem, dnaId]);
}

/** Requests in flight by input key, so a remount (or React's development double run) never sends twice. */
const inflight = new Map<string, Promise<StylingResponse>>();

/**
 * The last answer in this tab for each input key, failures included. History keeps only answers worth
 * showing again, so without this a failure on the build would be sent again, unasked, by the results.
 * Trying again is the customer's choice (the Try again button), or a reload.
 */
const lastAnswer = new Map<string, StylingResponse>();

/** Sends a fresh request for these inputs, unless one for the same inputs is already on its way. */
export function submitStyling(spec: StylingSpec, userId: string | undefined): Promise<StylingResponse> {
  const pending = inflight.get(spec.inputKey);
  if (pending) return pending;
  const run = send(spec, userId)
    .then((response) => {
      lastAnswer.set(spec.inputKey, response);
      return response;
    })
    .finally(() => inflight.delete(spec.inputKey));
  inflight.set(spec.inputKey, run);
  return run;
}

async function send(spec: StylingSpec, userId: string | undefined): Promise<StylingResponse> {
  const anon = anonymousId();
  const request = buildStylingRequest(spec.inputs, {
    anonymousSessionId: anon,
    userId,
    wardrobe: spec.wardrobe,
    styleProfileId: spec.styleProfileId,
    preferences: preferenceSnapshot(feedbackStore.all(), { anonymousSessionId: anon, userId }),
  });
  const service = stylingService();
  track("styling_submitted", { requestId: request.requestId, inputKey: request.inputKey, adapter: `${service.adapter.id}/${service.adapter.version}`, wardrobeItems: request.wardrobeItems.length });
  track("processing_started", { requestId: request.requestId });
  const started = performance.now();
  const response = await service.recommend(request);
  if (response.status === "failed") track("processing_failed", { requestId: request.requestId, code: response.error?.code ?? "unknown" });
  else track("processing_completed", { requestId: request.requestId, recommendationId: response.recommendationId, status: response.status, outfits: response.outfits.length, durationMs: Math.round(performance.now() - started) });
  return response;
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

function lastFailure(inputKey: string): StylingResponse | null {
  const last = lastAnswer.get(inputKey);
  return last?.status === "failed" ? last : null;
}
