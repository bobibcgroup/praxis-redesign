/** Suite 13: the events a full session records, their identifiers, and that nothing sensitive is in them. */
import { named, toStep, upload } from "./lib.mjs";

const REQUIRED = ["occasion_selected", "question_answered", "styling_submitted", "results_viewed", "outfit_selected", "look_saved", "look_shared", "tryon_opened", "tryon_photo_ready", "photo_consent_given", "wardrobe_item_added", "checkout_initiated", "style_dna_completed"];

export default async function (H) {
  const { BASE, scenario, check, button, events, history, A, photoFile } = H;

  await scenario("P3-13a", "A full session records each required event once, with its identifiers and nothing sensitive", "desktop", async (p) => {
    await p.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
    // Style DNA first, so it is part of the same session.
    await p.goto(`${BASE}/dna/face?mode=light`);
    await p.waitForTimeout(600);
    await p.getByRole("radio", { name: /Use a sample/ }).first().click();
    await p.waitForTimeout(400);
    await button(p, "Looks right").click();
    await p.getByRole("radio", { name: "Slim" }).first().click();
    await p.waitForURL(/dna\/lifestyle/);
    await p.waitForTimeout(400);
    await p.getByRole("radio").first().click();
    await p.waitForURL(/dna\/inspiration/);
    await p.getByRole("button", { name: "Quiet luxury" }).click();
    await button(p, "Build my Style DNA").click();
    await p.waitForURL(/dna\/result/, { timeout: 10000 });
    await p.waitForTimeout(1500);
    await button(p, /Looks right|Save my Style DNA/).click();
    await p.waitForTimeout(800);
    await H.toResults(p, A);
    await p.locator(".a-thumb").filter({ visible: true }).nth(1).click();
    await p.waitForTimeout(500);
    await button(p, /^Save/).click();
    await p.waitForTimeout(600);
    await p.goto(p.url().replace(/([?&])done=saved&?/, "$1"));
    await p.waitForTimeout(800);
    await button(p, /^Share/).click();
    await p.waitForTimeout(400);
    await button(p, /^Copy link$/).click();
    await p.keyboard.press("Escape");
    await p.waitForTimeout(300);
    await button(p, /^Check out/).click();
    await p.waitForTimeout(500);
    await p.keyboard.press("Escape");
    await p.waitForTimeout(300);
    await p.locator(".a-personal-card").filter({ visible: true }).nth(1).click();
    await p.getByRole("radio", { name: "Shoes" }).first().click();
    await p.waitForTimeout(300);
    await p.getByRole("radio", { name: /Try it with an example/ }).first().click();
    await p.waitForURL(/moment\/results/, { timeout: 15000 });
    await p.waitForTimeout(800);
    await button(p, /See it on me/).click();
    await p.waitForURL(/moment\/tryon/);
    await button(p, "Continue").click();
    await button(p, "I agree").click();
    await upload(p, () => p.getByRole("radio", { name: /Upload a photo/ }).first().click(), await photoFile(p));
    await toStep(p, "preview");
    await button(p, "Use this photo").click();
    await toStep(p, "result");

    const ev = await events(p);
    const user = await p.evaluate(() => JSON.parse(localStorage.getItem("praxis_lab_a_user") || "null"));
    const anon = await p.evaluate(() => JSON.parse(localStorage.getItem("praxis_anon") || "{}").id);
    for (const n of REQUIRED) check(named(ev, n).length >= 1, `${n} recorded (${named(ev, n).length})`);
    check(named(ev, "question_answered").map((e) => e.properties.step).sort().join() === "1,2,3,4", "one answer event per question, steps 1 to 4");
    check(named(ev, "results_viewed").length === 2, "results counted once per set of looks (two sets: before and after the owned piece)");
    check(named(ev, "look_saved").length === 1 && named(ev, "look_shared").length === 1 && named(ev, "checkout_initiated").length === 1, "save, share and Check out counted once each");
    check(ev.every((e) => /^evt_|^[0-9a-f-]{8,}/.test(e.eventId) && !Number.isNaN(Date.parse(e.timestamp)) && e.applicationVersion), "every event has an id, a time and the app version");
    check(new Set(ev.map((e) => e.eventId)).size === ev.length, "event ids are unique");
    check(ev.every((e) => e.anonymousSessionId === anon), "every event carries the visitor's anonymous id");
    check(ev.every((e) => e.userId === user.id), "and the account id, since this person is signed in");
    const rids = new Set((await history(p)).map((h) => h.response.recommendationId));
    check(ev.filter((e) => e.recommendationId).every((e) => rids.has(e.recommendationId)), "recommendation ids point to real answers");
    const all = JSON.stringify(ev);
    check(!all.includes("@") && !all.includes(user.email), "no email address");
    check(!/data:image|base64|blob:/.test(all), "no photo data");
    check(!/me\.jpg|\.png|\.heic/i.test(all), "no file names");
    check(!/undertone|contrast|cool|warm/.test(JSON.stringify(named(ev, "style_dna_completed").concat(named(ev, "style_dna_corrected")))), "no Style DNA values, only that it was saved");
    check(named(ev, "tryon_photo_ready").every((e) => Object.keys(e.properties).join() === "source"), "the photo event says only how the photo was taken");
    check(!ev.some((e) => e.testMode), "nothing is marked as test mode");
  }, { premium: true });
}
