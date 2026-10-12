/** Phase 4: the wardrobe's records and the error reports from the page. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { forgetWardrobeItem, rememberWardrobeItem, setWardrobePhoto, updateWardrobeItem, wardrobeEntries, wardrobePhoto } from "../data";
import { framesOf, reportError, reportFor } from "../monitoring";
import { wardrobeRef } from "../request";
import { ANON, memoryStorage } from "./helpers";

describe("wardrobe", () => {
  it("keeps a piece by name, type and colour, and corrects it without changing its id", () => {
    const s = memoryStorage();
    const ref = { ...wardrobeRef("top", "Navy overshirt", "described", "x"), colour: "Navy" };
    rememberWardrobeItem(ref, { anonymousSessionId: ANON }, () => s);
    expect(wardrobeEntries(() => s)[0]).toMatchObject({ label: "Navy overshirt", slot: "top", colour: "Navy", source: "described" });
    const next = updateWardrobeItem(ref.wardrobeItemId, { label: "  Linen shirt ", slot: "top", colour: "" }, () => s);
    expect(next).toMatchObject({ wardrobeItemId: ref.wardrobeItemId, label: "Linen shirt" });
    expect(next?.colour).toBeUndefined();
    expect(wardrobeEntries(() => s)).toHaveLength(1);
  });

  it("refuses an empty name and an unknown piece", () => {
    const s = memoryStorage();
    const ref = wardrobeRef("shoes", "Loafers", "described", "y");
    rememberWardrobeItem(ref, { anonymousSessionId: ANON }, () => s);
    expect(updateWardrobeItem(ref.wardrobeItemId, { label: "   " }, () => s)?.label).toBe("Loafers");
    expect(updateWardrobeItem("nope", { label: "x" }, () => s)).toBeNull();
  });

  it("removes one piece and its photo, leaving the others", () => {
    const s = memoryStorage();
    const tab = memoryStorage();
    const a = wardrobeRef("top", "A", "upload", "1");
    const b = wardrobeRef("bottom", "B", "described", "2");
    rememberWardrobeItem(a, { anonymousSessionId: ANON }, () => s);
    rememberWardrobeItem(b, { anonymousSessionId: ANON }, () => s);
    setWardrobePhoto(a.wardrobeItemId, "data:image/jpeg;base64,AAAA", () => tab);
    expect(wardrobePhoto(a.wardrobeItemId, () => tab)).toContain("data:image");
    forgetWardrobeItem(a.wardrobeItemId, () => s, () => tab);
    expect(wardrobeEntries(() => s).map((e) => e.label)).toEqual(["B"]);
    expect(wardrobePhoto(a.wardrobeItemId, () => tab)).toBeNull();
  });

  it("keeps photos in the tab only, and only the most recent eight", () => {
    const s = memoryStorage();
    const tab = memoryStorage();
    for (let i = 0; i < 10; i += 1) setWardrobePhoto(`w${i}`, `data:image/jpeg;base64,${i}`, () => tab);
    expect(wardrobePhoto("w0", () => tab)).toBeNull();
    expect(wardrobePhoto("w9", () => tab)).toBeTruthy();
    expect(Object.keys(JSON.parse(tab.getItem("praxis_wardrobe_photos") ?? "{}"))).toHaveLength(8);
    expect(s.length).toBe(0);
  });
});

describe("error reports", () => {
  it("send the error's name and app frames, never its message, query or another site", () => {
    const err = new TypeError("Cannot read sam@example.com's look");
    err.stack = "TypeError: Cannot read sam@example.com's look\n    at x (https://praxis.app/assets/index-abc.js:12:34)\n    at y (https://evil.example/tracker.js:1:1)\n    at z (https://praxis.app/assets/index-abc.js?v=1:56:78)";
    const r = reportFor(err, "page", "/moment/results?occasion=DINNER&email=sam@example.com");
    expect(r.name).toBe("TypeError");
    expect(r.path).toBe("/moment/results");
    expect(r.frames).toEqual(["/assets/index-abc.js:12:34"]);
    expect(JSON.stringify(r)).not.toMatch(/sam@|Cannot read|evil/);
  });

  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: memoryStorage(), sessionStorage: memoryStorage() });
  });

  it("odd names become Error, and each tab sends one report per error and five at most", () => {
    expect(reportFor({ name: "<script>" }, "x", "/").name).toBe("Error");
    expect(framesOf(undefined)).toEqual([]);
    const sent: string[] = [];
    const send = (b: string) => sent.push(b);
    const same = new Error("a");
    expect(reportError(same, "page", send)).toBe(true);
    expect(reportError(same, "page", send)).toBe(false);
    for (let i = 0; i < 10; i += 1) reportError({ name: `E${i}` }, "page", send);
    expect(sent).toHaveLength(5);
  });
});
