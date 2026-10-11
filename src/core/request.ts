/**
 * Turns the customer's answers into the styling request the recommendation service receives.
 * Every question in Style a Moment lands here: occasion, place, time of day, feel and budget,
 * plus the piece they own and their Style DNA when there is one.
 */
import { SPEND, VENUES } from "../shared/catalog";
import { CONTRACT_VERSION, type BudgetBand, type Occasion, type PreferenceSnapshot, type Slot, type StylingRequest, type TimeOfDay, type Vibe, type WardrobeItemRef } from "./contracts";
import { newId, shortHash } from "./ids";

export interface MomentInputs {
  occasion: Occasion;
  venue: string;
  time: TimeOfDay;
  vibe: Vibe;
  spend: BudgetBand;
}

/** Returns the inputs only when every question has an answer. */
export function completeInputs(a: { occasion: Occasion | null; venue: string | null; time: TimeOfDay | null; vibe: Vibe | null; spend: BudgetBand | null }): MomentInputs | null {
  if (!a.occasion || !a.venue || !a.time || !a.vibe || !a.spend) return null;
  return { occasion: a.occasion, venue: a.venue, time: a.time, vibe: a.vibe, spend: a.spend };
}

/** The budget answers as numbers the service can filter on. "No limit" sets no bound. */
export const BUDGET_BOUNDS: Record<BudgetBand, { minimum?: number; maximum?: number }> = {
  SENSIBLE: { maximum: 300 },
  ELEVATED: { minimum: 300, maximum: 900 },
  OPEN: {},
};

/** A stable id for an owned piece, so the same piece is the same item in every request. */
export function wardrobeRef(slot: Slot, label: string, source: WardrobeItemRef["source"], content = ""): WardrobeItemRef {
  return { wardrobeItemId: `wardrobe_${slot}_${shortHash(`${source}|${label}|${content}`)}`, slot, label, source };
}

/** Same answers, same key. Preferences are left out: they inform the engine but are not the brief. */
export function inputKeyFor(inputs: MomentInputs, wardrobe: readonly WardrobeItemRef[] = [], styleProfileId?: string): string {
  const owned = wardrobe.map((w) => w.wardrobeItemId).sort().join("+") || "-";
  return [inputs.occasion, inputs.venue, inputs.time, inputs.vibe, inputs.spend, owned, styleProfileId ?? "-"].join("|");
}

export interface RequestContext {
  anonymousSessionId: string;
  userId?: string;
  wardrobe?: readonly WardrobeItemRef[];
  styleProfileId?: string;
  preferences?: PreferenceSnapshot;
  now?: Date;
  requestId?: string;
}

export function buildStylingRequest(inputs: MomentInputs, ctx: RequestContext): StylingRequest {
  const venue = VENUES[inputs.occasion].find((v) => v.id === inputs.venue);
  const wardrobe = [...(ctx.wardrobe ?? [])];
  const request: StylingRequest = {
    requestId: ctx.requestId ?? newId("req"),
    inputKey: inputKeyFor(inputs, wardrobe, ctx.styleProfileId),
    contractVersion: CONTRACT_VERSION,
    journey: "style_a_moment",
    anonymousSessionId: ctx.anonymousSessionId,
    occasion: inputs.occasion,
    venue: { type: inputs.venue, label: venue?.label ?? inputs.venue },
    timeOfDay: inputs.time,
    preferredVibe: inputs.vibe,
    budget: { band: inputs.spend, ...BUDGET_BOUNDS[inputs.spend], currency: "USD" },
    wardrobeItems: wardrobe,
    generatedAt: (ctx.now ?? new Date()).toISOString(),
  };
  if (ctx.userId) request.userId = ctx.userId;
  if (ctx.styleProfileId) request.styleProfileId = ctx.styleProfileId;
  if (ctx.preferences) request.preferences = ctx.preferences;
  return request;
}

/** The budget as the customer chose it, such as "$300 to $900". */
export function budgetLabel(band: BudgetBand): string {
  return SPEND.find((s) => s.id === band)?.label ?? band;
}
