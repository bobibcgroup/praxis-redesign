/** Suite 2: Style a moment, the four questions and the request they make. */
import { latest } from "./lib.mjs";

export default async function (H) {
  const { BASE, scenario, check, body, button, history, toResults, A } = H;

  for (const device of ["desktop", "phone"]) {
    await scenario("P3-2a", "Every answer, and a piece the client owns, reaches the styling request", device, async (p) => {
      await toResults(p, A);
      const { request, response } = await latest(H, p);
      const anon = await p.evaluate(() => JSON.parse(localStorage.getItem("praxis_anon") || "{}").id);
      check(request.occasion === "DINNER" && request.venue.type === "RESTAURANT" && request.timeOfDay === "NIGHT" && request.preferredVibe === "SHARP", "occasion, place, time and feel are in the request");
      check(request.budget.band === "ELEVATED" && request.budget.minimum === 300 && request.budget.maximum === 900 && request.budget.currency === "USD", "the budget is in the request as a band and as numbers");
      check(request.anonymousSessionId === anon && /^req_/.test(request.requestId) && request.contractVersion && request.inputKey.startsWith("DINNER|RESTAURANT|NIGHT|SHARP|ELEVATED"), "the request has its id, the visitor, the contract and a key for these answers");
      check(response.requestId === request.requestId && response.inputKey === request.inputKey, "the answer is tied to that request");
      const q = new URL(p.url()).searchParams;
      check(q.get("venue") === "RESTAURANT" && q.get("time") === "NIGHT" && q.get("vibe") === "SHARP" && q.get("spend") === "ELEVATED", "the answers are kept in the address");
      await p.locator(".a-personal-card").filter({ visible: true }).nth(1).click();
      await p.waitForURL(/moment\/you\/item/);
      await p.getByRole("radio", { name: "Shoes" }).first().click();
      await p.waitForTimeout(300);
      await p.getByRole("radio", { name: /Try it with an example/ }).first().click();
      await p.waitForURL(/moment\/results/, { timeout: 15000 });
      await p.waitForTimeout(800);
      const second = await latest(H, p);
      check(second.request.requestId !== request.requestId && second.request.wardrobeItems.length === 1 && second.request.wardrobeItems[0].slot === "shoes", "a new request carries the owned shoes");
      check(second.response.outfits.every((o) => o.garments.some((g) => g.source === "wardrobe" && g.slot === "shoes")), "every look keeps the owned shoes");
      check(/Yours/.test(await body(p)), "the owned piece reads Yours");
    });

    await scenario("P3-2b", "Going back keeps each answer, also after a reload", device, async (p) => {
      await p.goto(`${BASE}/?mode=light`);
      await p.getByRole("radio", { name: "Dinner" }).first().click();
      for (const name of [/Restaurant/, /Night/]) {
        await p.waitForTimeout(650);
        await p.getByRole("radio", { name }).first().click();
      }
      await p.waitForURL(/moment\/feel/);
      await p.goBack();
      await p.waitForURL(/moment\/time/);
      await p.waitForTimeout(500);
      check((await p.getByRole("radio", { name: /Night/ }).first().getAttribute("aria-checked")) === "true", "browser Back shows the time chosen");
      await p.reload();
      await p.waitForTimeout(800);
      check((await p.getByRole("radio", { name: /Night/ }).first().getAttribute("aria-checked")) === "true", "still chosen after a reload");
      await button(p, /back/i).click();
      await p.waitForURL(/moment\/venue/);
      await p.waitForTimeout(500);
      check((await p.getByRole("radio", { name: /Restaurant/ }).first().getAttribute("aria-checked")) === "true", "the Back button shows the place chosen");
      check((await history(p)).length === 0, "nothing was sent while answering");
    });
  }

  await scenario("P3-2c", "Incomplete or invalid answers never send a request", "desktop", async (p) => {
    for (const q of ["occasion=DINNER&venue=RESTAURANT", "occasion=DINNER&venue=RESTAURANT&time=NIGHT&vibe=SHARP&spend=LOTS", "occasion=DINNER&venue=BEACH&time=NIGHT&vibe=SHARP&spend=OPEN", "occasion=DINNER&venue=RESTAURANT&time=NOON&vibe=SHARP&spend=OPEN"]) {
      await p.goto(`${BASE}/moment/build?mode=light&${q}`);
      await p.waitForTimeout(1500);
      check(!/moment\/(build|results)/.test(p.url()), `${q} goes back to a question (${new URL(p.url()).pathname})`);
    }
    check((await history(p)).length === 0, "no request was sent");
  });

  await scenario("P3-2d", "Every occasion, start to finish, gives valid looks", "desktop", async (p) => {
    for (const name of ["Dinner", "Work", "Date", "Wedding", "Party"]) {
      await p.goto(`${BASE}/?mode=light`);
      await p.getByRole("radio", { name }).first().click();
      for (let i = 0; i < 4; i++) {
        await p.waitForTimeout(650);
        if (/moment\/(build|results)/.test(p.url())) break;
        await p.getByRole("radio").filter({ visible: true }).first().click();
      }
      await p.waitForURL(/moment\/results/, { timeout: 15000 });
      await p.waitForTimeout(600);
      const { request, response } = await latest(H, p);
      check(request.occasion === name.toUpperCase() && ["completed", "partial"].includes(response.status) && response.outfits.length >= 1, `${name}: ${response.outfits.length} looks for ${request.venue.type}, ${request.timeOfDay}, ${request.preferredVibe}, ${request.budget.band}`);
      check(response.outfits.every((o) => o.pricing.total <= (request.budget.maximum ?? Infinity)), `${name}: every total inside the budget`);
    }
  });
}
