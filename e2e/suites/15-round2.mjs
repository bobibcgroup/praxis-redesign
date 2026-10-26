/** Suite 15: the second consultant review (2026-10-26), checked at the eight screen sizes the brief names. */

const VIEWPORTS = [
  [375, 812], [390, 844], [430, 932], [768, 1024],
  [1024, 768], [1366, 768], [1440, 900], [1920, 1080],
];
const touch = (w) => (w < 1024 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {});
const vp = (w, h) => ({ viewport: { viewport: { width: w, height: h }, ...touch(w) } });
const RETIRED = /Less usual|More of a daytime look|More of an evening look|Works day or night|alternative|One of my|Right for /;

export default async function (H) {
  const { BASE, scenario, check, body, button } = H;
  const results = (q) => `${BASE}/moment/results?${q}&mode=light`;
  const why = (p) => button(p, /Why this look/);
  const openWhy = async (p) => {
    if ((await why(p).getAttribute("aria-expanded")) !== "true") await why(p).click();
    await p.waitForTimeout(450);
    return p.locator(".a-why-list").filter({ visible: true }).first().innerText();
  };

  /* The contradictions the review found, each at its own answers. */
  const CASES = [
    { q: "occasion=WORK&venue=OFFICE&time=NIGHT&vibe=SHARP&spend=ELEVATED", says: /evening commitments/, never: /daytime|daylight/ },
    { q: "occasion=WORK&venue=EVENT&time=NIGHT&vibe=SAFE&spend=ELEVATED", says: /event floor/, never: /daytime|daylight/ },
    { q: "occasion=DATE&venue=RESTAURANT&time=DAY&vibe=SAFE&spend=SENSIBLE", says: /daytime date/, never: /night|evening look/ },
    { q: "occasion=DATE&venue=WALK&time=DAY&vibe=SHARP&spend=ELEVATED", says: /casual setting with a confident finish/i, never: /relaxed/ },
    { q: "occasion=PARTY&venue=LAUNCH&time=DAY&vibe=SHARP&spend=ELEVATED", says: /daytime opening/, never: /after dark|evening look/ },
    { q: "occasion=PARTY&venue=CLUB&time=NIGHT&vibe=SAFE&spend=SENSIBLE", says: /in a club/, never: /Less usual/ },
    { q: "occasion=WEDDING&venue=GARDEN&time=SUNRISE&vibe=SAFE&spend=OPEN", says: /morning ceremony/, never: /day or night|night/ },
    { q: "occasion=DINNER&venue=BAR&time=SUNSET&vibe=SAFE&spend=SENSIBLE", says: /at the bar/, never: /Less usual/ },
  ];

  for (const device of ["desktop", "phone"]) {
    await scenario("P5-15a", "Why this look: folded after the pieces, three groups, true to the hour and the place", device, async (p, shot) => {
      for (const c of CASES) {
        await p.goto(results(c.q));
        await p.waitForTimeout(1200);
        check((await why(p).getAttribute("aria-expanded")) === "false", `folded at first (${c.q.split("&").slice(0, 3).join(" ")})`);
        const text = await openWhy(p);
        const groups = await p.locator(".a-why-list > div").filter({ visible: true }).count();
        check(groups === 3, `three groups (${groups})`);
        check(c.says.test(text), `says ${c.says}`);
        check(!c.never.test(text.split("\n").slice(2, 4).join(" ")) && !RETIRED.test(text), `no contradiction or retired wording: ${text.replace(/\n/g, " | ").slice(0, 160)}`);
      }
      await shot("why");
    });
  }

  for (const device of ["desktop", "phone"]) {
    await scenario("P5-15b", "After saving: See saved looks leads, the look is one tap back, signing in is a quiet offer", device, async (p, shot) => {
      await p.goto(results("occasion=DINNER&venue=RESTAURANT&time=NIGHT&vibe=SHARP&spend=ELEVATED"));
      await p.waitForTimeout(1200);
      await button(p, /^Save$/).click();
      await p.waitForTimeout(900);
      const t = await body(p);
      check(/You’re set/.test(t) && /in this browser on this device/.test(t), "the save is confirmed, and where it is kept");
      const primary = p.locator(".a-primary").filter({ visible: true });
      check((await primary.count()) === 1 && /See saved looks/.test(await primary.first().innerText()), "one primary action: See saved looks");
      const signIn = p.locator('[aria-live="polite"] button').filter({ hasText: /^Sign in$/ }).filter({ visible: true });
      check((await signIn.count()) === 0 || (await signIn.first().evaluate((e) => e.classList.contains("a-tertiary"))), "sign in is quiet");
      check(!/follow you|any device|every device/i.test(t), "no promise of other devices");
      await shot("saved");
      await p.getByRole("link", { name: "Back to this look" }).filter({ visible: true }).first().click();
      await p.waitForTimeout(900);
      check(!/done=/.test(p.url()) && (await p.locator('[aria-label="Pieces"]').filter({ visible: true }).count()) === 1, "Back to this look shows the look and its pieces again");
      check((await button(p, /^Saved$/).count()) === 1, "and it shows as saved");
    });
  }

  for (const [w, h] of [[1024, 768], [1366, 768], [1440, 900], [1470, 712], [1920, 1080], [390, 844], [375, 812]]) {
    await scenario("P5-15c", `Share: both ways to share in view without scrolling, ${w}x${h}`, w >= 1024 ? "desktop" : "phone", async (p, shot) => {
      await p.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
      await p.goto(results("occasion=DINNER&venue=RESTAURANT&time=NIGHT&vibe=SHARP&spend=ELEVATED"));
      await p.waitForTimeout(1200);
      await button(p, /^Share$/).click();
      await p.waitForTimeout(900);
      const m = await p.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"][aria-label="Share this look"]');
        const region = dialog?.querySelector('[role="region"]');
        const find = (re) => [...dialog.querySelectorAll("button")].find((b) => re.test(b.textContent))?.getBoundingClientRect();
        return { scrolls: region ? region.scrollHeight > region.clientHeight + 1 : true, story: find(/Share to your story|Preparing/)?.bottom ?? 9999, ask: find(/Ask a friend/)?.bottom ?? 9999, copy: find(/Copy link/)?.bottom ?? 9999, vh: innerHeight };
      });
      check(m.story <= m.vh && m.ask <= m.vh && m.copy <= m.vh, `Share to your story, Ask a friend and Copy link in view (${Math.round(m.ask)} of ${m.vh})`);
      check(!m.scrolls, "nothing in the panel needs scrolling");
      await button(p, /Copy link/).click();
      await p.waitForTimeout(300);
      check((await button(p, /Copied/).count()) === 1, "Copy link still says Copied");
      await shot("share");
    }, vp(w, h));
  }

  for (const device of ["desktop", "phone"]) {
    await scenario("P5-15d", "A friend's link: the look they sent is named, pieces and prices to compare, nothing to buy", device, async (p, shot) => {
      await p.goto(results("occasion=DINNER&venue=RESTAURANT&time=NIGHT&vibe=SHARP&spend=ELEVATED"));
      await p.waitForTimeout(1200);
      const sender = (await p.locator(".a-total .a-mono").filter({ visible: true }).first().innerText()).trim();
      await p.locator(".a-thumb").filter({ visible: true }).nth(1).click();
      await p.waitForTimeout(900);
      const url = new URL(p.url());
      url.searchParams.set("via", "friend");
      await p.goto(url.toString());
      await p.waitForTimeout(1200);
      const t = await body(p);
      check(/The look your friend sent/i.test(t), "the look they had open is the one named");
      check((await p.locator('input[type="checkbox"]').count()) === 0, "no boxes to tick");
      check((await p.getByRole("button", { name: /^Check out/ }).count()) === 0, "no Check out");
      check((await p.locator(".a-piece .a-mono").filter({ visible: true }).count()) >= 3, "each piece shows its price");
      await p.locator(".a-thumb").filter({ visible: true }).nth(0).click();
      await p.waitForTimeout(900);
      check((await p.locator(".a-total .a-mono").filter({ visible: true }).first().innerText()).trim() === sender, "the other looks show the same total the sender saw");
      await shot("friend");
    });
  }

  for (const [w, h] of [[1024, 768], [1366, 768], [1440, 900], [1470, 712], [1920, 1080], [390, 844]]) {
    await scenario("P5-15e", `Style DNA introduction: what it gives, what is in preview, the price and Start without scrolling, ${w}x${h}`, w >= 1024 ? "desktop" : "phone", async (p, shot) => {
      await p.goto(`${BASE}/?mode=light&gate=dna`);
      await p.waitForTimeout(1200);
      const t = await body(p);
      check(/your fit, your lifestyle and your personal taste/.test(t) && !/your week/.test(t), "your lifestyle, not your week");
      check(/Go beyond the occasion/.test(t) && /In preview/i.test(t) && /come next/.test(t), "what it is, and what is in preview");
      check(!/Your own pieces, worked into your looks/.test(t), "nothing listed that everyone already gets");
      const m = await p.evaluate(() => {
        const s = document.querySelector(".a-gate-scroll");
        const start = [...document.querySelectorAll(".a-gate button")].find((b) => b.textContent.trim() === "Start")?.getBoundingClientRect();
        return { scrolls: s ? s.scrollHeight > s.clientHeight + 1 : true, start: start?.bottom ?? 9999, vh: innerHeight };
      });
      check(!m.scrolls && m.start <= m.vh, `no scrolling; Start at ${Math.round(m.start)} of ${m.vh}`);
      await shot("dna-intro");
    }, vp(w, h));
  }

  for (const device of ["desktop", "phone"]) {
    await scenario("P5-15f", "Wardrobe: Add a piece first, then each piece with its picture or colour", device, async (p, shot) => {
      await p.goto(`${BASE}/wardrobe?mode=light`);
      await p.waitForTimeout(900);
      await button(p, /^Add a piece$/).click();
      await p.waitForTimeout(300);
      await p.getByRole("radio", { name: /^Top$/ }).first().click();
      await p.getByLabel("What you call it").fill("Navy overshirt");
      await p.getByLabel("Colour (optional)").fill("Navy");
      await button(p, /Add to my wardrobe/).click();
      await p.waitForTimeout(600);
      const add = await button(p, /^Add a piece$/).boundingBox();
      const list = await p.getByRole("list", { name: "Pieces you own" }).boundingBox();
      check(add && list && add.y < list.y, "Add a piece sits above the pieces");
      const tile = await p.locator(".a-piece-tile").first().evaluate((e) => ({ w: e.getBoundingClientRect().width, bg: getComputedStyle(e).backgroundColor }));
      check(tile.w >= 56 && /rgb\(32, 42, 74\)/.test(tile.bg), `the piece shows its colour (${tile.bg})`);
      check((await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)), "nothing scrolls sideways");
      await shot("wardrobe");
    });
  }

  await scenario("P5-15g", "The larger view is opened by an expand mark, not a magnifying glass", "desktop", async (p) => {
    await p.goto(results("occasion=DINNER&venue=RESTAURANT&time=NIGHT&vibe=SHARP&spend=ELEVATED"));
    await p.waitForTimeout(1200);
    check((await p.locator(".a-zoom-cue svg.lucide-maximize2").count()) === 1, "expand icon");
    check((await p.locator(".a-zoom-cue svg.lucide-search").count()) === 0, "no magnifier");
    await p.locator(".a-enlarge").click();
    await p.waitForTimeout(700);
    check((await p.getByRole("dialog").count()) >= 1, "it still opens the larger view");
  });

  for (const [w, h] of VIEWPORTS) {
    await scenario("P5-15h", `Results at ${w}x${h}: title, pieces and the main action, nothing sideways`, w >= 1024 ? "desktop" : "phone", async (p, shot) => {
      await p.goto(results("occasion=PARTY&venue=LAUNCH&time=DAY&vibe=SHARP&spend=ELEVATED"));
      await p.waitForTimeout(1300);
      const m = await p.evaluate(() => {
        const vis = (sel) => [...document.querySelectorAll(sel)].find((e) => e.getBoundingClientRect().width > 0);
        const title = vis("h1.a-display")?.getBoundingClientRect();
        const check = [...document.querySelectorAll("button")].find((b) => /^Check out/.test(b.textContent.trim()) && b.getBoundingClientRect().width > 0)?.getBoundingClientRect();
        return { sideways: document.documentElement.scrollWidth > innerWidth, title: title ? title.top >= 0 && title.top < innerHeight : false, check: check ? check.bottom <= innerHeight && check.height >= 44 : false };
      });
      check(!m.sideways, "nothing scrolls sideways");
      check(m.title, "the title is in the first view");
      check(m.check, "Check out is in view at 44 px");
      check((await why(p).getAttribute("aria-expanded")) === "false", "Why this look waits, folded");
      await shot("results");
    }, vp(w, h));
  }

  await scenario("P5-15i", "Prices: the total, Check out and the checkout sheet agree; unticking updates all three; example prices say so", "desktop", async (p, shot) => {
    await p.goto(results("occasion=WORK&venue=CLIENT&time=DAY&vibe=SHARP&spend=ELEVATED"));
    await p.waitForTimeout(1200);
    const money = (t) => Number(String(t).replace(/[^0-9.]/g, ""));
    const prices = await p.locator(".a-piece .price").filter({ visible: true }).allInnerTexts();
    const sum = prices.map(money).reduce((a, b) => a + b, 0);
    const total = async () => money(await p.locator(".a-total .a-mono").filter({ visible: true }).first().innerText());
    const hint = async () => money(await p.getByRole("button", { name: /^Check out/ }).locator(".hint").innerText());
    check((await total()) === sum && (await hint()) === sum, `the total and Check out are the sum of the pieces ($${sum})`);
    check(/for illustration/.test(await body(p)), "example prices are labelled as illustration");
    await p.locator(".a-piece.a-pick").filter({ visible: true }).first().click();
    await p.waitForTimeout(300);
    const less = sum - money(prices[0]);
    check((await total()) === less && (await hint()) === less, `unticking a piece takes it off both ($${less})`);
    await p.getByRole("button", { name: /^Check out/ }).click();
    await p.waitForTimeout(700);
    const sheet = p.getByRole("dialog", { name: "Check out" });
    check(money(await sheet.locator(".a-mono").last().innerText()) === less, "the checkout sheet shows the same total");
    check(/Prices are examples/.test(await sheet.innerText()) && (await sheet.getByRole("button", { name: /Buying isn’t open yet/ }).count()) === 1, "no purchase is offered for example pieces");
    await shot("checkout");
  });
}
