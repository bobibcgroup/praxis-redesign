/** Suite 1: homepage and occasion selection. Country photos are covered by the GEO scenarios. */
import { named, noSideways } from "./lib.mjs";

const OCCASIONS = ["Dinner", "Work", "Date", "Wedding", "Party"];

export default async function (H) {
  const { BASE, scenario, check, body, events, menuClick } = H;

  for (const device of ["desktop", "phone"]) {
    await scenario("P3-1a", "Home loads with its five occasions, the Style DNA section and working navigation", device, async (p, shot) => {
      const res = await p.goto(`${BASE}/?mode=light`);
      check(res.status() === 200, "home answers 200");
      await p.waitForFunction(() => [...document.querySelectorAll(".a-cards img")].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 8000 });
      const cards = p.locator(".a-cards [role=radio]");
      check((await cards.count()) === 5, "five occasion cards");
      check((await cards.allInnerTexts()).join(" ").match(new RegExp(OCCASIONS.join("|"), "g"))?.length >= 5, "each card names its occasion");
      check(/Style DNA/.test(await body(p)), "the Style DNA section shows");
      check(await noSideways(p), "nothing scrolls sideways");
      check(named(await events(p), "landing_viewed").length === 1, "the visit is counted once");
      await shot("home");
      await menuClick(p, /Saved looks/);
      await p.waitForURL(/\/looks/);
      check(/No saved looks yet/.test(await body(p)), "Saved looks opens from the bar or menu");
      await p.getByRole("link", { name: /Start a new look/ }).filter({ visible: true }).first().click();
      await p.waitForURL((u) => u.pathname === "/");
      check((await p.locator(".a-cards").count()) === 1, "Start a new look returns home");
    });

    await scenario("P3-1b", "Each occasion card starts the journey with that occasion", device, async (p) => {
      const venues = {};
      for (const name of OCCASIONS) {
        await p.goto(`${BASE}/?mode=light`);
        await p.getByRole("radio", { name }).first().click();
        await p.waitForURL(/\/moment\/venue/);
        await p.waitForTimeout(400);
        const occasion = new URL(p.url()).searchParams.get("occasion");
        check(occasion === name.toUpperCase(), `${name} opens the place question with occasion=${occasion}`);
        venues[name] = (await p.getByRole("radio").filter({ visible: true }).allInnerTexts()).join("|");
      }
      check(new Set(Object.values(venues)).size === 5, "each occasion asks about its own places");
      const sel = named(await events(p), "occasion_selected");
      check(sel.length === 5 && sel.every((e) => e.properties.surface === "home"), "occasion_selected recorded for each, from home");
    });
  }
}
