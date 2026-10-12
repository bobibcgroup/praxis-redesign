/**
 * Suite 6: the client's own pieces. Praxis has no wardrobe screen: a piece is added from the looks
 * ("Use something I own"), the client names its type (the mock does not read the photo), and Your data
 * lists and deletes it. A full wardrobe (a list to browse, edit and delete one by one) is a product
 * decision, flagged in the Phase 3 report.
 */
import { latest, named, textFile, upload } from "./lib.mjs";

export default async function (H) {
  const { BASE, scenario, check, body, button, events, toResults, A, photoFile } = H;

  async function addOwn(p, slot, file) {
    await p.locator(".a-personal-card").filter({ visible: true }).nth(1).click();
    await p.waitForURL(/moment\/you\/item/);
    await p.getByRole("radio", { name: slot }).first().click();
    await p.waitForTimeout(300);
    await p.getByRole("radio", { name: /Upload a photo/ }).first().click();
    await p.waitForTimeout(300);
    await upload(p, () => button(p, "I agree").click(), file);
  }

  for (const device of ["desktop", "phone"]) {
    await scenario("P3-6a", "An uploaded top is checked, used in every look as the client's own, and kept out of the total", device, async (p, shot) => {
      await toResults(p, A);
      await addOwn(p, "Top", await photoFile(p, { width: 800, height: 800 }));
      await p.waitForURL(/moment\/results/, { timeout: 15000 });
      await p.waitForTimeout(800);
      const { request, response } = await latest(H, p);
      check(request.wardrobeItems.length === 1 && request.wardrobeItems[0].slot === "top" && request.wardrobeItems[0].source === "upload", "the request carries an uploaded top");
      check(!JSON.stringify(request).includes("data:image"), "the request carries no photo");
      check(response.outfits.every((o) => o.garments.filter((g) => g.slot === "top").every((g) => g.source === "wardrobe")), "every look uses it as the top");
      const own = p.locator(".a-piece").filter({ visible: true }).filter({ hasText: "Yours" });
      check((await own.count()) === 1 && (await own.locator("input").count()) === 0, "it reads Yours and cannot be unticked or bought");
      const o = response.outfits.find((x) => x.outfitId === (new URL(p.url()).searchParams.get("hero") ?? response.outfits[0].outfitId));
      check(o.pricing.total === o.garments.filter((g) => g.source === "retail").reduce((s, g) => s + g.product.price, 0), "the total counts only pieces to buy");
      await button(p, /^Check out/).click();
      await p.waitForTimeout(500);
      check(!/Your own top/.test(await p.getByRole("dialog", { name: "Check out" }).innerText()), "Check out leaves it out");
      await p.keyboard.press("Escape");
      check(named(await events(p), "wardrobe_item_added").some((e) => e.properties.slot === "top" && e.properties.source === "upload"), "the piece is recorded by type, never by photo");
      check(!(await p.evaluate(() => Object.values(localStorage).some((v) => v.includes("data:image")))), "the photo is not kept on the device");
      await shot("own-top");
    });
  }

  await scenario("P3-6b", "A photo of a piece that is not a photo, or too dark, is refused with the reason", "phone", async (p) => {
    await toResults(p, A);
    await addOwn(p, "Shoes", textFile);
    await p.waitForTimeout(800);
    check((await p.getByRole("alert").count()) > 0 && /moment\/you\/item/.test(p.url()), `a text file is refused (${(await p.getByRole("alert").first().innerText().catch(() => "")).trim()})`);
    await upload(p, () => p.locator('input[aria-label="Upload a photo of the piece"]').evaluate((i) => i.click()), await photoFile(p, { shade: "#030303" }));
    await p.waitForTimeout(1200);
    check(/dark/i.test(await p.getByRole("alert").first().innerText().catch(() => "")), "a dark photo is refused, saying why");
    check((await p.getByRole("radio", { name: /Try it with an example/ }).count()) === 1, "an example is still offered");
  });

  await scenario("P3-6c", "Changing the piece swaps it in the looks, and Your data lists and deletes it", "desktop", async (p) => {
    await toResults(p, A);
    await p.locator(".a-personal-card").filter({ visible: true }).nth(1).click();
    await p.getByRole("radio", { name: "Shoes" }).first().click();
    await p.waitForTimeout(300);
    await p.getByRole("radio", { name: /Try it with an example/ }).first().click();
    await p.waitForURL(/moment\/results/, { timeout: 15000 });
    await p.waitForTimeout(600);
    check(/Change my piece/.test(await body(p)), "the card now reads Change my piece");
    await p.locator(".a-personal-card").filter({ visible: true }).nth(1).click();
    await p.waitForURL(/moment\/you\/item/);
    await button(p, "Choose another piece").click();
    await p.getByRole("radio", { name: "Bottom" }).first().click();
    await p.waitForTimeout(300);
    await p.getByRole("radio", { name: /Try it with an example/ }).first().click();
    await p.waitForURL(/moment\/results/, { timeout: 15000 });
    await p.waitForTimeout(600);
    const { request } = await latest(H, p);
    check(request.wardrobeItems.length === 1 && request.wardrobeItems[0].slot === "bottom", "the new piece replaces the old one in the request");
    await p.goto(`${BASE}/data?mode=light`);
    await p.waitForTimeout(600);
    check(/Pieces you own/.test(await body(p)) && /2 pieces, by name only|1 piece, by name only/.test(await body(p)), `Your data lists the pieces by name (${(await body(p)).match(/Pieces you own\s*\n?\s*([^\n]+)/)?.[1]})`);
    await button(p, /Delete everything/).click();
    await p.waitForTimeout(400);
    const confirm = p.getByRole("button", { name: /Delete everything|Yes, delete/ }).filter({ visible: true });
    if (await confirm.count()) await confirm.last().click();
    await p.waitForTimeout(1200);
    await p.goto(`${BASE}/data?mode=light`);
    await p.waitForTimeout(600);
    check(/Pieces you own\s*\n?\s*None/.test(await body(p)), "after deleting, none are left");
  });
}
