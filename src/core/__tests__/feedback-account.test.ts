/** F5 and F6: feedback is stored against the right look, and a guest's looks move to the account once. */
import { describe, expect, it } from "vitest";
import { migrateFeedback, migrateLooks, visibleTo, type OwnedLook } from "../account";
import { createFeedbackStore, preferenceSnapshot } from "../feedback";
import { ANON, memoryStorage } from "./helpers";

const base = { anonymousSessionId: ANON, recommendationId: "rec_1", requestId: "req_1", adapter: { id: "mock", version: "1.0.0" } };

describe("feedback store", () => {
  it("stores a rejection with its reason against the customer, request, recommendation, look and adapter", () => {
    const store = createFeedbackStore(() => memoryStorage());
    const f = store.record({ ...base, outfitId: "dinner_sharper_01", feedback: "not_for_me", reason: "too_formal" });
    expect(f).toMatchObject({ ...base, outfitId: "dinner_sharper_01", feedback: "not_for_me", reason: "too_formal" });
    expect(f.eventId).toMatch(/^fb_/);
    expect(store.latestFor("rec_1", "dinner_sharper_01")?.eventId).toBe(f.eventId);
    expect(store.latestFor("rec_2", "dinner_sharper_01")).toBeNull();
  });

  it("keeps feedback across a reload of the store", () => {
    const storage = memoryStorage();
    createFeedbackStore(() => storage).record({ ...base, outfitId: "a", feedback: "more_like_this" });
    expect(createFeedbackStore(() => storage).all()).toHaveLength(1);
  });

  it("can take back the latest word", () => {
    const store = createFeedbackStore(() => memoryStorage());
    const f = store.record({ ...base, outfitId: "a", feedback: "more_like_this" });
    store.withdraw(f.eventId);
    expect(store.latestFor("rec_1", "a")).toBeNull();
  });

  it("sums feedback into preferences, the newest word on each look winning", () => {
    const store = createFeedbackStore(() => memoryStorage());
    store.record({ ...base, outfitId: "a", feedback: "not_for_me", reason: "too_formal" });
    store.record({ ...base, outfitId: "a", feedback: "more_like_this" });
    store.record({ ...base, outfitId: "b", feedback: "not_for_me", garmentId: "b_shoes" });
    store.record({ ...base, anonymousSessionId: "anon_someone_else", outfitId: "c", feedback: "not_for_me", reason: "too_casual" });
    const p = preferenceSnapshot(store.all(), { anonymousSessionId: ANON });
    expect(p.likedOutfitIds).toEqual(["a"]);
    expect(p.rejectedOutfitIds).toEqual(["b"]);
    expect(p.reasonCounts).toEqual({ too_formal: 1 });
    expect(p.dislikedGarmentIds).toEqual(["b_shoes"]);
  });

  it("keeps each account's feedback to that account, and a guest's to the guest", () => {
    const store = createFeedbackStore(() => memoryStorage());
    store.record({ ...base, userId: "user_a", outfitId: "a", feedback: "more_like_this" });
    store.record({ ...base, outfitId: "g", feedback: "more_like_this" });
    expect(preferenceSnapshot(store.all(), { anonymousSessionId: ANON }).likedOutfitIds).toEqual(["g"]);
    expect(preferenceSnapshot(store.all(), { anonymousSessionId: ANON, userId: "user_b" }).likedOutfitIds).toEqual([]);
    expect(preferenceSnapshot(store.all(), { anonymousSessionId: ANON, userId: "user_a" }).likedOutfitIds).toEqual(["a"]);
  });
});

const look = (id: string, key: string, savedAt: string, userId?: string): OwnedLook => ({ id, dedupeKey: key, savedAt, owner: { anonymousSessionId: ANON, userId } });

describe("account migration", () => {
  it("moves guest looks onto the account and keeps one copy of a look saved twice", () => {
    const looks = [
      look("1", "dinner_sharper_01|A", "2026-10-10T10:00:00Z"),
      look("2", "dinner_sharper_01|A", "2026-10-09T10:00:00Z", "user_1"),
      look("3", "dinner_relaxed_01|B", "2026-10-08T10:00:00Z"),
      look("4", "work_safest_01|C", "2026-10-07T10:00:00Z", "user_other"),
    ];
    const r = migrateLooks(looks, "user_1", ANON);
    expect(r.moved).toBe(2);
    expect(r.duplicates).toBe(1);
    expect(r.looks.map((l) => l.id)).toEqual(["1", "3", "4"]);
    expect(r.looks.find((l) => l.id === "1")?.owner?.userId).toBe("user_1");
    expect(r.looks.find((l) => l.id === "4")?.owner?.userId).toBe("user_other");
  });

  it("is safe to run twice", () => {
    const once = migrateLooks([look("1", "k", "2026-10-10T10:00:00Z")], "user_1", ANON);
    const twice = migrateLooks(once.looks, "user_1", ANON);
    expect(twice).toEqual({ looks: once.looks, moved: 0, duplicates: 0 });
  });

  it("shows a person their account's looks and this device's guest looks, never another account's", () => {
    expect(visibleTo({ owner: { anonymousSessionId: ANON } }, undefined)).toBe(true);
    expect(visibleTo({ owner: { anonymousSessionId: ANON, userId: "user_1" } }, "user_1")).toBe(true);
    expect(visibleTo({ owner: { anonymousSessionId: ANON, userId: "user_1" } }, undefined)).toBe(false);
    expect(visibleTo({ owner: { anonymousSessionId: ANON, userId: "user_1" } }, "user_2")).toBe(false);
    expect(visibleTo({}, "user_2")).toBe(true);
  });

  it("gives this browser's guest feedback the account id and drops exact repeats", () => {
    const store = createFeedbackStore(() => memoryStorage());
    store.record({ ...base, outfitId: "a", feedback: "not_for_me", reason: "too_formal" });
    store.record({ ...base, outfitId: "a", feedback: "not_for_me", reason: "too_formal" });
    store.record({ ...base, anonymousSessionId: "anon_other", outfitId: "b", feedback: "more_like_this" });
    const r = migrateFeedback(store.all(), "user_1", ANON);
    expect(r.moved).toBe(2);
    expect(r.records).toHaveLength(2);
    expect(r.records.find((f) => f.outfitId === "a")?.userId).toBe("user_1");
    expect(r.records.find((f) => f.outfitId === "b")?.userId).toBeUndefined();
  });
});
