/** F3, F4 and session data: photo policies, the billable switch, the editable Style DNA, retention. */
import { describe, expect, it } from "vitest";
import { pruneByAge, deleteLocalData, migrateWardrobe, recordSelection, lastSelection, rememberWardrobeItem, wardrobeEntries } from "../data";
import { checkFile, checkQuality, consentFor, deleteImages, disclosure, grantConsent, IMAGE_POLICIES, withdrawConsent } from "../images";
import { applyAnalysis, basisOf, clearCorrection, colourGuide, confirmEstimates, correct, createProfile, fromLegacy, hasEstimates, profileRef, summarize, valueOf } from "../styleProfile";
import { guardBillable, imageServices, mockColourAnalysis, type ColourAnalysisAdapter } from "../vision";
import { ANON, FIXED_NOW, memoryStorage } from "./helpers";

describe("photo policies", () => {
  it("covers all four kinds, each with its own consent, retention and deletion", () => {
    expect(Object.keys(IMAGE_POLICIES).sort()).toEqual(["body_fit", "face_colour", "try_on", "wardrobe_garment"]);
    for (const p of Object.values(IMAGE_POLICIES)) {
      expect(p.why && p.use && p.deletion && p.consentVersion && p.adapter).toBeTruthy();
    }
  });

  it("never says a photo stays on the device unless the policy keeps it there", () => {
    for (const category of Object.keys(IMAGE_POLICIES) as (keyof typeof IMAGE_POLICIES)[]) {
      const d = disclosure(category);
      expect(d.leaves.includes("stays on this device")).toBe(!IMAGE_POLICIES[category].leavesDevice);
    }
  });

  it("asks for a face, wardrobe or try-on photo, and no body photo while fit analysis is not offered", () => {
    expect(IMAGE_POLICIES.face_colour.status).toBe("collecting");
    expect(IMAGE_POLICIES.wardrobe_garment.status).toBe("collecting");
    expect(IMAGE_POLICIES.try_on.status).toBe("collecting");
    expect(IMAGE_POLICIES.body_fit.status).toBe("not_collected");
  });

  it("keeps the try-on photo on the device while no engine is connected, and says so", () => {
    expect(IMAGE_POLICIES.try_on.leavesDevice).toBe(false);
    expect(IMAGE_POLICIES.try_on.retention.where).toBe("this_tab");
    expect(disclosure("try_on").use).toMatch(/isn’t switched on/);
  });

  it("checks the file before reading it and the picture after", () => {
    expect(checkFile({ type: "application/pdf", size: 10 }, "face_colour")).toBe("not_an_image");
    expect(checkFile({ type: "image/gif", size: 10 }, "face_colour")).toBe("unsupported_type");
    expect(checkFile({ type: "image/jpeg", size: 40 * 1024 * 1024 }, "face_colour")).toBe("too_large");
    expect(checkFile({ type: "image/jpeg", size: 1000 }, "face_colour")).toBeNull();
    expect(checkQuality({ width: 200, height: 300, meanLuma: 120 }, "face_colour")).toBe("too_small");
    expect(checkQuality({ width: 900, height: 1200, meanLuma: 20 }, "face_colour")).toBe("too_dark");
    expect(checkQuality({ width: 900, height: 1200, meanLuma: 250 }, "face_colour")).toBe("too_bright");
    expect(checkQuality({ width: 900, height: 1200, meanLuma: null }, "face_colour")).toBeNull();
    expect(checkQuality({ width: 0, height: 0, meanLuma: null }, "face_colour")).toBe("unreadable");
  });

  it("records consent to the current wording only, and withdrawing it deletes the photos", () => {
    const device = memoryStorage();
    expect(consentFor("face_colour", () => device)).toBeNull();
    grantConsent("face_colour", () => device, FIXED_NOW);
    expect(consentFor("face_colour", () => device)?.version).toBe(IMAGE_POLICIES.face_colour.consentVersion);
    device.setItem("praxis_image_consent", JSON.stringify([{ category: "face_colour", version: "old", grantedAt: "x" }]));
    expect(consentFor("face_colour", () => device)).toBeNull();
    grantConsent("face_colour", () => device);
    withdrawConsent("face_colour", () => device);
    expect(consentFor("face_colour", () => device)).toBeNull();
  });

  it("deletes a face photo, and only the photo of a wardrobe piece", () => {
    const tab = memoryStorage();
    tab.setItem("praxis_lab_a_face", JSON.stringify("data:image/jpeg;base64,AAAA"));
    tab.setItem("praxis_lab_a_item", JSON.stringify({ slot: "top", name: "Your own top", image: "data:image/jpeg;base64,AAAA" }));
    deleteImages("face_colour", () => tab);
    deleteImages("wardrobe_garment", () => tab);
    expect(tab.getItem("praxis_lab_a_face")).toBeNull();
    expect(JSON.parse(tab.getItem("praxis_lab_a_item") ?? "{}")).toEqual({ slot: "top", name: "Your own top", image: null });
  });
});

describe("image services", () => {
  const input = { ref: "data:image/jpeg;base64,AAAA", category: "face_colour" as const, width: 900, height: 1200, consentVersion: IMAGE_POLICIES.face_colour.consentVersion };
  const paid: ColourAnalysisAdapter = { ...mockColourAnalysis, id: "paid", billable: true, analyse: async () => ({ status: "completed" }) };

  it("refuses a billable call while the switch is off, before calling the provider", async () => {
    let called = false;
    const spy: ColourAnalysisAdapter = { ...paid, analyse: async () => ((called = true), { status: "completed" }) };
    expect(() => guardBillable(paid, false)).toThrow(/billable/);
    expect((await imageServices({ colour: spy }, false).analyseColour(input)).status).toBe("disabled");
    expect(called).toBe(false);
    expect((await imageServices({ colour: spy }, true).analyseColour(input)).status).toBe("completed");
  });

  it("does not analyse a photo without consent to the current wording", async () => {
    expect((await imageServices({}, false).analyseColour({ ...input, consentVersion: "old" })).status).toBe("failed");
  });

  it("labels the mock estimate as a sample, not a reading of the photo", async () => {
    const r = await imageServices({}, false).analyseColour(input);
    expect(r.status).toBe("completed");
    expect(r.undertone?.source).toBe("sample");
  });

  it("makes no try-on picture without consent to the current try-on wording", async () => {
    const r = await imageServices({}, true).tryOn({ outfitId: "o", garmentIds: ["g"], person: input });
    expect(r).toMatchObject({ status: "failed", kind: "try_on", outfitId: "o", sourceGarmentIds: ["g"], error: { code: "consent_missing" } });
  });
});

describe("editable Style DNA", () => {
  const base = () => createProfile({ photo: "own", fit: "SLIM", week: "OFFICE", tastes: ["quiet-luxury"] }, FIXED_NOW);
  const analysis = { status: "completed" as const, undertone: { value: "cool" as const, source: "sample" as const, adapter: "mock" }, contrast: { value: "high" as const, source: "sample" as const, adapter: "mock" } };

  it("keeps the customer's answers as confirmed and the colour reading as an estimate", () => {
    const p = applyAnalysis(base(), analysis, "own", FIXED_NOW);
    expect(basisOf(p.fit)).toBe("confirmed");
    expect(basisOf(p.undertone)).toBe("inferred");
    expect(hasEstimates(p)).toBe(true);
    expect(p.version).toBe(2);
  });

  it("lets a correction win, and a new estimate never overwrites it", () => {
    let p = applyAnalysis(base(), analysis, "own");
    p = correct(p, "undertone", "warm");
    expect(valueOf(p.undertone)).toBe("warm");
    expect(basisOf(p.undertone)).toBe("corrected");
    p = applyAnalysis(p, { ...analysis, undertone: { ...analysis.undertone, value: "neutral" } }, "own");
    expect(valueOf(p.undertone)).toBe("warm");
    expect(p.undertone.inferred?.value).toBe("neutral");
  });

  it("treats picking the estimate as agreeing with it, and can drop a correction", () => {
    let p = applyAnalysis(base(), analysis, "own");
    p = correct(p, "contrast", "high");
    expect(basisOf(p.contrast)).toBe("confirmed");
    p = correct(p, "contrast", "low");
    p = clearCorrection(p, "contrast");
    expect(valueOf(p.contrast)).toBe("high");
  });

  it("confirms every open estimate with Looks right", () => {
    const p = confirmEstimates(applyAnalysis(base(), analysis, "own"));
    expect(hasEstimates(p)).toBe(false);
    expect(basisOf(p.undertone)).toBe("confirmed");
  });

  it("changes its reference with every change, so requests name the exact profile", () => {
    const a = applyAnalysis(base(), analysis, "own");
    const b = correct(a, "fit", "RELAXED");
    expect(profileRef(b)).not.toBe(profileRef(a));
    expect(summarize(b)).toMatchObject({ fit: { value: "RELAXED", basis: "corrected" }, undertone: { value: "cool", basis: "inferred" } });
    expect(JSON.stringify(b)).not.toMatch(/data:|base64/);
  });

  it("follows the colour guide to the corrected undertone", () => {
    expect(colourGuide("warm", "low")?.palette).not.toEqual(colourGuide("cool", "low")?.palette);
    expect(colourGuide(undefined, "low")).toBeNull();
  });

  it("brings an old saved Style DNA over as an estimate, without its photo", () => {
    const p = fromLegacy({ createdAt: "2026-10-01T00:00:00Z", tones: { undertone: "cool", contrast: "high" }, fit: "REGULAR", lifestyle: "MIXED", presetIds: [], portrait: "data:image/jpeg;base64,AAAA" });
    expect(basisOf(p.undertone)).toBe("inferred");
    expect(p.undertone.inferred?.source).toBe("sample");
    expect(p.photo).toBe("own");
    expect(JSON.stringify(p)).not.toMatch(/base64/);
  });
});

describe("session data", () => {
  it("prunes records older than their retention period", () => {
    const recs = [{ at: "2026-10-10T00:00:00Z" }, { at: "2026-01-01T00:00:00Z" }, { at: undefined }];
    expect(pruneByAge(recs, 90, (r) => r.at, FIXED_NOW)).toHaveLength(2);
    expect(pruneByAge(recs, null, (r) => r.at, FIXED_NOW)).toHaveLength(3);
  });

  it("remembers the chosen look per set of looks", () => {
    const s = memoryStorage();
    recordSelection("rec_1", "a", () => s);
    recordSelection("rec_1", "b", () => s);
    recordSelection("rec_2", "c", () => s);
    expect(lastSelection("rec_1", () => s)).toBe("b");
    expect(lastSelection("rec_3", () => s)).toBeNull();
  });

  it("keeps wardrobe pieces by name and type only, and moves a guest's to the account", () => {
    const s = memoryStorage();
    rememberWardrobeItem({ wardrobeItemId: "w1", slot: "top", label: "Your own top", source: "upload" }, { anonymousSessionId: ANON }, () => s);
    expect(wardrobeEntries(() => s)).toHaveLength(1);
    expect(s.getItem("praxis_wardrobe")).not.toMatch(/data:|base64/);
    const m = migrateWardrobe(wardrobeEntries(() => s), "user_1", ANON);
    expect(m.moved).toBe(1);
    expect(m.entries[0].owner.userId).toBe("user_1");
  });

  it("deletes everything Praxis keeps, and nothing else", () => {
    const device = memoryStorage();
    const tab = memoryStorage();
    device.setItem("praxis_lab_a", "{}");
    device.setItem("praxis_events", "[]");
    device.setItem("someone_else", "1");
    tab.setItem("praxis_lab_a_face", "x");
    expect(deleteLocalData([() => device, () => tab])).toBe(3);
    expect(device.getItem("someone_else")).toBe("1");
    expect(device.length + tab.length).toBe(1);
  });
});

describe("review fixes", () => {
  it("keeps a confirmation under a correction, so dropping the correction goes back to it", async () => {
    const sp = await import("../styleProfile");
    let p = sp.createProfile({ photo: "own", fit: "SLIM", week: "OFFICE", tastes: [] });
    p = sp.applyAnalysis(p, { status: "completed", undertone: { value: "cool", source: "model", adapter: "x" }, contrast: { value: "high", source: "model", adapter: "x" } } as never, "own");
    p = sp.confirmEstimates(p);
    p = sp.correct(p, "undertone", "warm");
    p = sp.clearCorrection(p, "undertone");
    expect(sp.basisOf(p.undertone)).toBe("confirmed");
  });
  it("keeps corrections when the answers are given again", async () => {
    const sp = await import("../styleProfile");
    let p = sp.createProfile({ photo: "own", fit: "SLIM", week: "OFFICE", tastes: [] });
    p = sp.correct(p, "fit", "RELAXED");
    p = sp.updateAnswers(p, { fit: "REGULAR", week: "SOCIAL", tastes: ["a"] });
    expect(sp.valueOf(p.fit)).toBe("RELAXED");
    expect(sp.valueOf(p.week)).toBe("SOCIAL");
  });
  it("treats a size the feed left out as unknown stock", async () => {
    const { stockFor } = await import("../retail");
    expect(stockFor({ availability: "in_stock", sizeAvailability: { S: "in_stock" } }, "L")).toBe("unknown");
    expect(stockFor({ availability: "in_stock", sizeAvailability: { S: "in_stock" } }, "S")).toBe("in_stock");
  });
});
