/**
 * Suite 4: See it on me, beyond TRY1 to TRY7. Uploads use file fixtures; Chromium's fake camera is not
 * a physical camera, so real cameras on phones stay a manual check (see the Phase 3 report).
 */
import { brokenJpeg, heroOf, latest, named, textFile, toStep, upload } from "./lib.mjs";

const record = (p) => p.evaluate(() => JSON.parse(sessionStorage.getItem("praxis_tryon_request") || "null"));
const photoInTab = (p) => p.evaluate(() => Boolean(sessionStorage.getItem("praxis_tryon_photo")));

export default async function (H) {
  const { scenario, check, body, button, events, toResults, A, photoFile, step, SIZES } = H;

  async function toCapture(p) {
    await button(p, /See it on me/).click();
    await p.waitForURL(/moment\/tryon/, { timeout: 8000 });
    await p.waitForTimeout(400);
    if ((await step(p)) === "explain") await button(p, "Continue").click();
    if ((await step(p)) === "consent") await button(p, "I agree").click();
    await toStep(p, "capture");
  }
  const uploadPhoto = async (p, file) => upload(p, () => p.getByRole("radio", { name: /Upload a photo/ }).first().click(), file ?? (await photoFile(p)));

  for (const device of ["phone", "desktop"]) {
    await scenario("P3-4a", "The try-on is for the look in front, with that look's own pieces", device, async (p) => {
      await toResults(p, A);
      await p.locator(".a-thumb").filter({ visible: true }).nth(2).click();
      await p.waitForTimeout(600);
      const hero = heroOf(p);
      const outfit = (await latest(H, p)).response.outfits.find((o) => o.outfitId === hero);
      await toCapture(p);
      await uploadPhoto(p);
      await toStep(p, "preview");
      check((await body(p)).includes(`the ${outfit.title} look`), `the preview names the look (${outfit.title})`);
      await button(p, "Use this photo").click();
      await toStep(p, "result");
      const r = await record(p);
      const retail = outfit.garments.filter((g) => g.source === "retail").map((g) => g.garmentId).sort();
      check(r.request.outfitId === hero, `the request names the third look (${r.request.outfitId})`);
      check(JSON.stringify([...r.request.garmentIds].sort()) === JSON.stringify(retail) || r.request.garmentIds.length === outfit.garments.length, "with that look's pieces");
      check(r.outcome.status === "not_connected" && /Nothing was made to look like you/.test(await body(p)), "the stand-in answers honestly");
      check(named(await events(p), "tryon_submitted").every((e) => (e.outfitId ?? e.properties.outfitId) === hero), "the event names the same look");
    }, { premium: true, viewport: device === "phone" ? SIZES[390] : undefined });
  }

  await scenario("P3-4b", "A file that is not a photo, or a broken photo, is refused with the reason", "phone", async (p, shot) => {
    await toResults(p, A);
    await toCapture(p);
    await uploadPhoto(p, textFile);
    await p.waitForTimeout(800);
    check((await p.getByRole("alert").count()) > 0 && (await step(p)) === "capture", `a text file is refused (${(await body(p)).match(/(isn’t a photo|photo type|JPEG|can’t use)[^.]*\./i)?.[0] ?? "no reason found"})`);
    await uploadPhoto(p, brokenJpeg);
    await p.waitForTimeout(1200);
    check((await p.getByRole("alert").count()) > 0 && (await step(p)) === "capture", "a broken photo is refused");
    check(!(await photoInTab(p)), "nothing is kept");
    check(named(await events(p), "photo_rejected").length >= 2, "each refusal is recorded with its reason");
    await shot("refused");
  }, { premium: true });

  await scenario("P3-4c", "Retake deletes the photo; closing and reopening keeps it only in this tab", "phone", async (p) => {
    await toResults(p, A);
    await toCapture(p);
    await uploadPhoto(p);
    await toStep(p, "preview");
    await button(p, "Retake").click();
    await p.waitForTimeout(300);
    check((await step(p)) === "capture" && !(await photoInTab(p)), "Retake deletes the photo and asks again");
    await uploadPhoto(p);
    await toStep(p, "preview");
    await p.getByRole("link", { name: "Back to your looks" }).filter({ visible: true }).first().click();
    await p.waitForURL(/moment\/results/);
    await button(p, /See it on me/).click();
    await p.waitForURL(/moment\/tryon/);
    await p.waitForTimeout(500);
    check((await step(p)) === "preview", "reopening goes back to the photo already given");
    const other = await p.context().newPage();
    await other.goto(p.url());
    await other.waitForTimeout(800);
    check((await other.locator("[data-tryon-step]").getAttribute("data-tryon-step")) === "explain", "a new tab starts without the photo");
    await other.close();
    await button(p, "Retake").click();
    await p.waitForTimeout(300);
    check(!(await photoInTab(p)) && !(await p.evaluate(() => Object.values(localStorage).some((v) => v.includes("data:image")))), "no photo left anywhere");
  }, { premium: true });

  await scenario("P3-4d", "Declining consent leaves without a photo; the camera and upload are both offered", "phone", async (p) => {
    await toResults(p, A);
    await p.evaluate(() => (localStorage.removeItem("praxis_image_consent"), sessionStorage.removeItem("praxis_image_consent")));
    await button(p, /See it on me/).click();
    await p.waitForURL(/moment\/tryon/);
    await button(p, "Continue").click();
    await p.waitForTimeout(300);
    check((await step(p)) === "consent", "consent is asked before any photo");
    await button(p, "Not now").click();
    await p.waitForURL(/moment\/results/);
    check(!(await photoInTab(p)), "declining keeps nothing and goes back to the looks");
    await toCapture(p);
    check((await p.getByRole("radio", { name: /Take a photo/ }).count()) === 1 && (await p.getByRole("radio", { name: /Upload a photo/ }).count()) === 1, "Take a photo and Upload a photo are both offered");
    const accept = await p.locator('input[type="file"]').first().getAttribute("accept");
    check(/image\/jpeg/.test(accept ?? "") && /heic/.test(accept ?? ""), `the phone's photo picker accepts JPEG and HEIC (${accept})`);
  }, { premium: true });

  await scenario("P3-4e", "A try-on that times out says so and can be sent again", "phone", async (p, shot) => {
    await toResults(p, A);
    await p.evaluate(() => sessionStorage.setItem("praxis_sim", "timeout"));
    await toCapture(p);
    await uploadPhoto(p);
    await toStep(p, "preview");
    await button(p, "Use this photo").click();
    await toStep(p, "result", 20000);
    check(/took too long/.test(await body(p)), "the timeout is said plainly");
    check((await button(p, "Try again").count()) === 1, "Try again is offered");
    await shot("timeout");
    await p.evaluate(() => sessionStorage.setItem("praxis_sim", "fast"));
    await button(p, "Try again").click();
    await toStep(p, "result");
    check(/isn’t switched on yet/.test(await body(p)), "sent again, it answers");
  }, { premium: true });

  await scenario("P3-4f", "A photo the service cannot find a person in says why, without retrying blindly", "phone", async (p) => {
    await toResults(p, A);
    await p.evaluate(() => sessionStorage.setItem("praxis_sim", "invalid_image"));
    await toCapture(p);
    await uploadPhoto(p);
    await toStep(p, "preview");
    await button(p, "Use this photo").click();
    await toStep(p, "result");
    check(/couldn’t find you in that photo/.test(await body(p)), "says no person was found");
    check((await button(p, "Try again").count()) === 0 && (await button(p, "Use another photo").count()) === 1, "offers another photo, not the same one again");
  }, { premium: true });
}
