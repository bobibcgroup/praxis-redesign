/** Stage 1, data safety on a shared device: owners, sign out, saves that survive bad data. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { migrateLooks, visibleTo, type OwnedLook } from "../account";
import { createFeedbackStore } from "../feedback";
import { buildStylingRequest } from "../request";
import { createRequestHistory } from "../service";
import { mockRecommend } from "../adapters/mock";
import { ANON, FIXED_NOW, SCENARIO_A, memoryStorage } from "./helpers";

const OTHER_GUEST = "anon_other";

describe("who sees what", () => {
  it("shows a guest's looks only to that guest, and an account's only to that account", () => {
    const guest = { owner: { anonymousSessionId: ANON } };
    expect(visibleTo(guest, undefined, ANON)).toBe(true);
    expect(visibleTo(guest, undefined, OTHER_GUEST)).toBe(false);
    expect(visibleTo(guest, "user_1", ANON)).toBe(false);
    const account = { owner: { anonymousSessionId: ANON, userId: "user_1" } };
    expect(visibleTo(account, "user_1", OTHER_GUEST)).toBe(true);
    expect(visibleTo(account, "user_2", ANON)).toBe(false);
    expect(visibleTo(account, undefined, ANON)).toBe(false);
  });

  it("moves only this guest's looks at sign in, never a previous guest's", () => {
    const looks: OwnedLook[] = [
      { id: "mine", dedupeKey: "a", savedAt: "2026-10-10T10:00:00Z", owner: { anonymousSessionId: ANON } },
      { id: "theirs", dedupeKey: "b", savedAt: "2026-10-09T10:00:00Z", owner: { anonymousSessionId: OTHER_GUEST } },
    ];
    const r = migrateLooks(looks, "user_1", ANON);
    expect(r.moved).toBe(1);
    expect(r.looks.find((l) => l.id === "mine")?.owner?.userId).toBe("user_1");
    expect(r.looks.find((l) => l.id === "theirs")?.owner?.userId).toBeUndefined();
  });

  it("finds an earlier answer only for the person who asked for it", async () => {
    const history = createRequestHistory(() => memoryStorage());
    const request = buildStylingRequest(SCENARIO_A, { anonymousSessionId: ANON, userId: "user_1", now: FIXED_NOW, requestId: "req_s1" });
    history.record(request, mockRecommend(request));
    expect(history.latest(request.inputKey, { anonymousSessionId: ANON, userId: "user_1" })).not.toBeNull();
    expect(history.latest(request.inputKey, { anonymousSessionId: ANON, userId: "user_2" })).toBeNull();
    expect(history.latest(request.inputKey, { anonymousSessionId: ANON })).toBeNull();
  });

  it("shows feedback on a look only to the person who gave it", () => {
    const store = createFeedbackStore(() => memoryStorage());
    store.record({ anonymousSessionId: ANON, userId: "user_1", recommendationId: "rec_1", requestId: "req_1", outfitId: "o", feedback: "more_like_this", adapter: { id: "mock", version: "1" } });
    expect(store.latestFor("rec_1", "o", { anonymousSessionId: ANON, userId: "user_1" })).not.toBeNull();
    expect(store.latestFor("rec_1", "o", { anonymousSessionId: ANON, userId: "user_2" })).toBeNull();
    expect(store.latestFor("rec_1", "o", { anonymousSessionId: ANON })).toBeNull();
  });
});

describe("saved data in this browser", () => {
  let local: Storage;
  beforeEach(() => {
    vi.resetModules();
    local = memoryStorage();
    vi.stubGlobal("window", { localStorage: local, sessionStorage: memoryStorage() });
  });

  const look = (id: string) => ({ id: `${id}_1`, savedAt: "2026-10-10T10:00:00Z", occasionLabel: "Dinner", dedupeKey: id, look: { id, role: "classic", title: id, pieces: [] } });

  it("skips one unreadable look instead of losing every save", async () => {
    local.setItem("praxis_lab_a", JSON.stringify({ looks: [look("a"), { broken: true }, null, look("b")] }));
    const { readState } = await import("../../shared/store");
    expect(readState("a")?.looks.map((l) => l.look.id)).toEqual(["a", "b"]);
  });

  it("keeps unreadable data aside before anything is written over it", async () => {
    local.setItem("praxis_lab_a", "{not json");
    const { readState, backupKeyFor } = await import("../../shared/store");
    expect(readState("a")?.looks).toEqual([]);
    expect(local.getItem(backupKeyFor("a"))).toBe("{not json");
  });

  it("reads a Style DNA from version 1 as a profile with no owner yet", async () => {
    const { readState } = await import("../../shared/store");
    local.setItem("praxis_lab_a", JSON.stringify({ looks: [], dna: { createdAt: "2026-10-01T00:00:00Z", fit: null, lifestyle: null } }));
    const state = readState("a");
    expect(state?.version).toBe(2);
    expect(state?.profiles).toHaveLength(1);
    expect(state?.profiles[0].owner).toBeUndefined();
  });

  it("starts a new guest at sign out", async () => {
    const identity = await import("../identity");
    const before = identity.anonymousId();
    const after = identity.rotateAnonymousId();
    expect(after).not.toBe(before);
    expect(identity.anonymousId()).toBe(after);
  });
});

describe("the stand-in accounts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", { localStorage: memoryStorage(), sessionStorage: memoryStorage() });
    vi.stubGlobal("localStorage", (globalThis as unknown as { window: { localStorage: Storage } }).window.localStorage);
  });

  it("gives Apple and Google their own accounts and takes a name from the address", async () => {
    const { PROVIDER_ADDRESS, nameFrom, isEmail } = await import("../../a/lib/user");
    const { userIdFor } = await import("../identity");
    expect(userIdFor(PROVIDER_ADDRESS.apple)).not.toBe(userIdFor(PROVIDER_ADDRESS.google));
    expect(nameFrom("tarek.hassoun@outlook.com")).toBe("Tarek");
    expect(nameFrom(PROVIDER_ADDRESS.apple)).toBe("Apple account");
    expect(isEmail("you@example.com")).toBe(true);
    expect(isEmail("you@")).toBe(false);
    expect(isEmail("")).toBe(false);
  });
});
