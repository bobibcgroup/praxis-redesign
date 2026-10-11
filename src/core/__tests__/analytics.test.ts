/** The analytics dictionary: closed, typed, private, and counted once. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { memoryStorage } from "./helpers";

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("window", { localStorage: memoryStorage(), sessionStorage: memoryStorage() });
});

async function load() {
  return import("../analytics");
}

describe("analytics", () => {
  it("refuses unknown events and properties, missing or wrong values", async () => {
    const { validateEvent } = await load();
    expect(validateEvent("made_up", {}).ok).toBe(false);
    expect(validateEvent("look_saved", { outfitId: "a", signedIn: false, extra: 1 }).ok).toBe(false);
    expect(validateEvent("look_saved", { outfitId: "a" }).ok).toBe(false);
    expect(validateEvent("question_answered", { question: "colour", answer: "x", step: 1, restyle: false }).ok).toBe(false);
    expect(validateEvent("question_answered", { question: "venue", answer: "BAR", step: "1", restyle: false }).ok).toBe(false);
    expect(validateEvent("question_answered", { question: "venue", answer: "BAR", step: 1, restyle: false }).ok).toBe(true);
  });

  it("refuses anything that could carry personal data", async () => {
    const { validateEvent } = await load();
    const props = (answer: string) => ({ step: "photo", answer });
    expect(validateEvent("style_dna_step", props("data:image/jpeg;base64,AAAA")).ok).toBe(false);
    expect(validateEvent("style_dna_step", props("someone@example.com")).ok).toBe(false);
    expect(validateEvent("style_dna_step", props("x".repeat(200))).ok).toBe(false);
    expect(validateEvent("style_dna_step", props("own")).ok).toBe(true);
  });

  it("accepts the styling request event exactly as the screens send it", async () => {
    const { validateEvent } = await load();
    const props = { requestId: "req_1", inputKey: "DINNER|RESTAURANT|NIGHT|SHARP|ELEVATED|-|-", adapter: "mock/1.0.0", wardrobeItems: 0 };
    expect(validateEvent("styling_submitted", props).ok).toBe(true);
  });

  it("stamps the anonymous id, the build and the ids, and lifts the look's ids to the top", async () => {
    const { track, localSink } = await load();
    const e = track("outfit_selected", { recommendationId: "rec_1", outfitId: "dinner_sharper_01", rank: 2, method: "swipe" });
    expect(e).toMatchObject({ eventName: "outfit_selected", recommendationId: "rec_1", outfitId: "dinner_sharper_01", journey: "style_a_moment", properties: { rank: 2, method: "swipe" } });
    expect(e?.anonymousSessionId).toMatch(/^anon_/);
    expect(e?.applicationVersion).toBeTruthy();
    expect(e?.properties).not.toHaveProperty("recommendationId");
    expect(localSink.read()).toHaveLength(1);
  });

  it("keeps the same anonymous id across events", async () => {
    const { track } = await load();
    const a = track("landing_viewed", { via: "none" });
    const b = track("occasion_selected", { occasion: "DINNER", surface: "home" });
    expect(a?.anonymousSessionId).toBe(b?.anonymousSessionId);
  });

  it("records a once-per-visit event once, however often it is called", async () => {
    const { track, localSink } = await load();
    for (let i = 0; i < 3; i += 1) track("results_viewed", { recommendationId: "rec_1", outfits: 3, mode: "demonstration", shared: false }, { once: "rec_1" });
    track("results_viewed", { recommendationId: "rec_2", outfits: 3, mode: "demonstration", shared: false }, { once: "rec_2" });
    expect(localSink.read().map((e) => e.recommendationId)).toEqual(["rec_1", "rec_2"]);
  });

  it("does not record a refused event", async () => {
    const { track, localSink } = await load();
    // @ts-expect-error: the dictionary has no such property, so the type refuses it too.
    expect(track("look_saved", { outfitId: "a", signedIn: true, email: "a@b.c" })).toBeNull();
    expect(localSink.read()).toHaveLength(0);
  });

  it("adds the account id once someone is signed in", async () => {
    const { track } = await load();
    window.localStorage.setItem("praxis_lab_a_user", JSON.stringify({ id: "user_1", name: "Bob", email: "bob@praxis.app", premium: false }));
    expect(track("signin_completed", { method: "apple", surface: "sync_offer" })?.userId).toBe("user_1");
  });
});
