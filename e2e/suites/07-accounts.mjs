/** Suite 7: saved looks, sign in, sharing and account separation, beyond S4, S5 and ISO1 to ISO3. */
import { heroOf, latest, named } from "./lib.mjs";

export default async function (H) {
  const { BASE, browser, DESKTOP, PHONE, scenario, check, body, button, events, lab, toResults, A, menuClick } = H;

  for (const device of ["desktop", "phone"]) {
    await scenario("P3-7a", "A saved look reopens with its pieces, can be removed, undone, and removed for good", device, async (p, shot) => {
      await toResults(p, A);
      const hero = heroOf(p) ?? (await latest(H, p)).response.outfits[0].outfitId;
      const title = (await p.locator("h1.a-display").filter({ visible: true }).first().innerText()).trim();
      await button(p, /^Save/).click();
      await p.waitForTimeout(700);
      await p.goto(`${BASE}/looks?mode=light`);
      await p.waitForTimeout(800);
      const fit = await p.evaluate(() => {
        const W = innerWidth;
        const outside = [...document.querySelectorAll("header, header *, h1")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > W + 1 || r.left < -1); }).length;
        const first = document.querySelector("a.a-rail-card")?.getBoundingClientRect().left ?? 0;
        return { outside, first, stage: document.querySelector(".a-stage")?.scrollWidth ?? 0, W };
      });
      check(fit.outside === 0 && fit.stage <= fit.W, `the page is the window's width; only the row of looks slides (stage ${fit.stage} of ${fit.W})`);
      check(fit.first >= 16, `the first look keeps its margin (${Math.round(fit.first)} px)`);
      await p.locator("a.a-rail-card").first().click();
      await p.waitForURL(/\/looks\/.+/);
      await p.waitForTimeout(600);
      check((await body(p)).includes(title) && (await p.locator(".a-piece").filter({ visible: true }).count()) >= 3, `the saved look reopens with its pieces (${title})`);
      check(named(await events(p), "saved_look_reopened").some((e) => (e.outfitId ?? e.properties.outfitId) === hero), "the reopen is recorded");
      await shot("saved-look");
      await button(p, "Remove").click();
      await p.waitForURL(/\/looks(\?|$)/);
      await p.waitForTimeout(400);
      check(/Removed/.test(await body(p)) && (await button(p, "Undo").count()) === 1, "Remove offers Undo");
      await button(p, "Undo").click();
      await p.waitForTimeout(500);
      check((await p.locator("a.a-rail-card").count()) === 1, "Undo puts it back");
      await p.locator("a.a-rail-card").first().click();
      await p.waitForURL(/\/looks\/.+/);
      await button(p, "Remove").click();
      await p.waitForTimeout(6800);
      await p.reload();
      await p.waitForTimeout(800);
      check(/No saved looks yet/.test(await body(p)) && ((await lab(p)).looks ?? []).length === 0, "removed for good after the Undo time");
    });
  }

  await scenario("P3-7b", "A shared link opens the same looks in another browser, without Check out", "phone", async (p, shot) => {
    await p.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
    await toResults(p, A);
    const first = (await latest(H, p)).response.outfits[0].outfitId;
    await button(p, /^Share/).click();
    await p.waitForTimeout(500);
    await button(p, /^Copy link$/).click();
    await p.waitForTimeout(400);
    const link = await p.evaluate(() => navigator.clipboard.readText());
    check(link.startsWith(BASE) && /moment\/results/.test(link), `the link is to these looks (${link.replace(BASE, "")})`);
    check(!/@|email|anon_|user_/.test(link), "the link carries no identity");
    check(named(await events(p), "look_shared").some((e) => e.properties.channel === "link"), "the share is recorded");
    const friendCtx = await browser.newContext(PHONE);
    const f = await friendCtx.newPage();
    await f.goto(link);
    await f.waitForTimeout(2500);
    const friendFirst = JSON.parse((await f.evaluate(() => localStorage.getItem("praxis_styling_history"))) || "[]")[0]?.response?.outfits?.[0]?.outfitId;
    check(friendFirst === first, `the friend sees the same first look (${friendFirst})`);
    check((await f.getByRole("button", { name: /^Check out/ }).filter({ visible: true }).count()) === 0 && (await f.getByRole("link", { name: /Get your own looks/ }).filter({ visible: true }).count()) === 1, "no Check out; Get your own looks instead");
    check(((await f.evaluate(() => JSON.parse(localStorage.getItem("praxis_lab_a") || "{}").looks)) ?? []).length === 0, "nothing of the sender's is on the friend's device");
    await f.screenshot({ path: `${H.OUT}/P3-7b-friend.png` });
    await friendCtx.close();
  });

  await scenario("P3-7c", "Signed in, a saved look stays across visits on this device; another device does not have it", "desktop", async (p) => {
    await p.goto(`${BASE}/?mode=light`);
    await menuClick(p, /^Sign in$/);
    await p.waitForTimeout(400);
    await p.locator("#gate-email").fill("returning@example.com");
    await button(p, /Continue with email/).click();
    await p.waitForTimeout(1400);
    await toResults(p, A);
    await button(p, /^Save/).click();
    await p.waitForTimeout(700);
    const next = await p.context().newPage();
    await p.close();
    await next.goto(`${BASE}/looks?mode=light`);
    await next.waitForTimeout(900);
    check((await next.locator("a.a-rail-card").count()) === 1, "a new visit on this device still has the look");
    check(JSON.parse((await next.evaluate(() => localStorage.getItem("praxis_lab_a_user"))) || "null")?.email === "returning@example.com", "and is still signed in");
    const other = await browser.newContext(DESKTOP);
    const o = await other.newPage();
    await o.goto(`${BASE}/looks?mode=light`);
    await o.waitForTimeout(800);
    check(/No saved looks yet/.test(await o.locator("body").innerText()), "another device has nothing: saved looks live in this browser until accounts have a server (known limit)");
    await other.close();
  });

  /* Several saved looks make a row wider than the window. Only that row may slide: the page, its bar and
     its heading stay the window's width (Tarek found the whole page sliding and the menu off screen). */
  for (const device of ["phone", "desktop"]) {
    await scenario("P3-7d", "Signed in with three saved looks, only the row of looks slides sideways", device, async (p, shot) => {
      await p.goto(`${BASE}/?mode=light`);
      await menuClick(p, /^Sign in$/);
      await p.waitForTimeout(400);
      await p.locator("#gate-email").fill("rail@example.com");
      await button(p, /Continue with email/).click();
      await p.waitForTimeout(1400);
      await toResults(p, A);
      for (let i = 0; i < 3; i += 1) {
        await p.locator(".a-thumbs button").filter({ visible: true }).nth(i).click();
        await p.waitForTimeout(500);
        await button(p, /^Save/).click();
        await p.waitForTimeout(500);
      }
      await p.goto(`${BASE}/looks?mode=light`);
      await p.waitForTimeout(900);
      const m = await p.evaluate(() => {
        const W = innerWidth;
        const outside = [...document.querySelectorAll("header, header *, h1")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > W + 1 || r.left < -1); }).length;
        const rail = document.querySelector("ul.a-rail");
        return { W, cards: document.querySelectorAll("a.a-rail-card").length, outside, stage: document.querySelector(".a-stage").scrollWidth, doc: document.documentElement.scrollWidth, rail: rail.scrollWidth > rail.clientWidth };
      });
      check(m.cards === 3, `three saved looks (${m.cards})`);
      check(m.outside === 0, "the bar, the menu and the heading are inside the window");
      check(m.stage <= m.W && m.doc <= m.W, `the page is the window's width (${m.stage} of ${m.W})`);
      if (device === "phone") check(m.rail, "the row of looks slides inside itself");
      await p.evaluate(() => window.scrollTo(300, 0));
      check((await p.evaluate(() => scrollX)) === 0, "the page itself does not move sideways");
      await shot("saved");
    });
  }
}
