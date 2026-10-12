/** Suite 3: the looks. Switching, pieces and totals, the viewer, save, share and Restyle. */
import { dollars, heroOf, latest, named, pieces, printSrc } from "./lib.mjs";

export default async function (H) {
  const { scenario, check, body, button, events, history, toResults, A } = H;

  for (const device of ["desktop", "phone"]) {
    await scenario("P3-3a", "Switching looks updates the title, photo, pieces and total, with nothing left from the last one", device, async (p, shot) => {
      await toResults(p, A);
      const { response } = await latest(H, p);
      check(response.outfits.length === 3, "three looks");
      const seen = [];
      for (const [i, o] of response.outfits.entries()) {
        await p.locator(".a-thumb").filter({ visible: true }).nth(i).click();
        await p.waitForTimeout(700);
        const title = (await p.locator("h1.a-display").filter({ visible: true }).first().innerText()).trim();
        const src = await printSrc(p);
        const ps = await pieces(p);
        const total = dollars(await p.locator(".a-total .a-mono").filter({ visible: true }).first().innerText());
        check(heroOf(p) === o.outfitId, `look ${i + 1}: the address names ${o.outfitId}`);
        check(title === o.title, `look ${i + 1}: title ${title}`);
        check(src && o.visualization.url.endsWith(src.split("/").pop()), `look ${i + 1}: its own photo`);
        check(ps.length === o.garments.length && o.garments.every((g) => ps.some((x) => x.name === g.name)), `look ${i + 1}: its ${o.garments.length} pieces`);
        check(total === o.pricing.total, `look ${i + 1}: total $${total} matches $${o.pricing.total}`);
        seen.push({ title, src, names: ps.map((x) => x.name).join("|"), total });
      }
      check(new Set(seen.map((s) => s.src)).size === 3 && new Set(seen.map((s) => s.names)).size === 3, "three different photos and sets of pieces");
      check(named(await events(p), "outfit_selected").every((e) => e.properties.method === "thumbnail"), "each switch is recorded with how it was made");
      await shot("third-look");
    });

    await scenario("P3-3b", "Unticking pieces lowers the total by their price, and Check out shows the same total", device, async (p) => {
      await toResults(p, A);
      const total = async () => dollars(await p.locator(".a-total .a-mono").filter({ visible: true }).first().innerText());
      const before = await total();
      const picks = p.locator(".a-pick").filter({ visible: true });
      const first = dollars(await picks.first().locator(".price").innerText());
      await picks.first().click();
      await p.waitForTimeout(300);
      check((await total()) === before - first, `total ${before} less ${first} is ${await total()}`);
      await button(p, /^Check out/).click();
      await p.waitForTimeout(600);
      const sheet = p.getByRole("dialog", { name: "Check out" });
      check(dollars(await sheet.locator(".a-mono.text-\\[17px\\]").innerText()) === before - first, "Check out shows the same total");
      check((await sheet.getByRole("listitem").count()) === (await picks.count()) - 1, "and lists only the pieces still chosen");
      await p.keyboard.press("Escape");
      await p.waitForTimeout(400);
      const n = await picks.count();
      for (let i = 1; i < n; i++) {
        await picks.nth(i).click();
        await p.waitForTimeout(150);
      }
      check(await p.getByRole("button", { name: /^Check out/ }).filter({ visible: true }).first().isDisabled(), "with nothing chosen, Check out is off");
      check(/Select at least one piece to continue/.test(await body(p)), "and says why");
    });

    await scenario("P3-3c", "The viewer opens the look in front, zooms it, and closes with Escape on the same look", device, async (p, shot) => {
      await toResults(p, A);
      await p.locator(".a-thumb").filter({ visible: true }).nth(1).click();
      await p.waitForTimeout(600);
      const hero = heroOf(p);
      const src = await printSrc(p);
      await p.locator("[aria-label^='View ']").first().click();
      await p.waitForTimeout(700);
      const dialog = p.getByRole("dialog");
      check((await dialog.count()) === 1, "the viewer opens");
      const big = dialog.locator("img").first();
      check(((await big.getAttribute("src")) ?? "").endsWith(src.split("/").pop()), "it shows the look in front");
      const scale = () => big.evaluate((i) => new DOMMatrix(getComputedStyle(i).transform === "none" ? "" : getComputedStyle(i).transform).a);
      const s0 = await scale();
      await button(p, "Zoom in").click();
      await p.waitForTimeout(500);
      check((await scale()) > s0, `Zoom in enlarges the photo (${s0} to ${await scale()})`);
      await shot("zoomed");
      await p.keyboard.press("Escape");
      await p.waitForTimeout(500);
      check((await dialog.count()) === 0 && heroOf(p) === hero, "Escape closes it on the same look");
      check(named(await events(p), "outfit_enlarged").length === 1, "the enlarge is recorded once");
    });

    await scenario("P3-3d", "Restyle changes the budget and brings new looks inside it", device, async (p) => {
      await toResults(p, A);
      const firstKey = (await latest(H, p)).request.inputKey;
      await button(p, /^Restyle/).click();
      await p.waitForTimeout(500);
      check((await p.getByRole("dialog").count()) === 1, "Restyle opens the answers");
      await p.getByRole("radio", { name: /The budget/ }).first().click();
      await p.waitForURL(/moment\/spend/);
      await p.waitForTimeout(500);
      await p.getByRole("radio", { name: /Under/ }).first().click();
      await p.waitForURL(/moment\/results/, { timeout: 15000 });
      await p.waitForTimeout(800);
      const { request, response } = await latest(H, p);
      check(request.inputKey !== firstKey && request.budget.band === "SENSIBLE", "a new request with the new budget");
      check(response.outfits.length > 0 && response.outfits.every((o) => o.pricing.total <= 300), "every total is under $300");
      check(named(await events(p), "restyle_changed").some((e) => e.properties.field === "spend"), "the change is recorded");
    });
  }

  await scenario("P3-3e", "On a computer, the arrow keys and the arrows move between looks and stop at the ends", "desktop", async (p) => {
    await toResults(p, A);
    const ids = (await latest(H, p)).response.outfits.map((o) => o.outfitId);
    await p.locator("[aria-label^='View ']").first().focus();
    await p.keyboard.press("ArrowRight");
    await p.waitForTimeout(600);
    check(heroOf(p) === ids[1], "Right arrow shows the second look");
    await button(p, "Next look").click();
    await p.waitForTimeout(600);
    check(heroOf(p) === ids[2], "the Next arrow shows the third");
    await button(p, "Next look").click({ force: true });
    await p.waitForTimeout(400);
    check(heroOf(p) === ids[2], "it stops at the last look");
    await p.locator("[aria-label^='View ']").first().focus();
    await p.keyboard.press("ArrowLeft");
    await p.waitForTimeout(600);
    check(heroOf(p) === ids[1], "Left arrow goes back");
    check((await history(p)).length === 1, "switching looks never sends a new request");
  });
}
