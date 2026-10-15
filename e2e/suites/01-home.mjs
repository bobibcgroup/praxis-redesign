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

    /* The home film: its round control always tells the truth, it holds on the occasions, and it never
       restarts on its own after the visitor paused it. */
    await scenario("P4-1f", "The home film plays, pauses, holds on the occasions and leaves the screen paused", device, async (p, shot) => {
      await p.goto(`${BASE}/?mode=light`);
      const film = p.locator(".a-demo video");
      const button = p.locator(".a-demo-toggle");
      const state = () => film.evaluate((v) => ({ paused: v.paused, time: v.currentTime, src: v.currentSrc, muted: v.muted, loop: v.loop, inline: v.playsInline }));
      /* On a phone the film sits under the occasions. */
      const toFilm = () => film.evaluate((v) => v.scrollIntoView({ block: "center" }));
      await toFilm();
      await p.waitForFunction(() => {
        const v = document.querySelector(".a-demo video");
        return v && !v.paused && v.currentTime > 0.3;
      }, null, { timeout: 15000 });
      const s0 = await state();
      check(s0.muted && s0.loop && s0.inline, "the film is muted, loops and plays inline");
      check(device === "phone" ? /hero-film-mobile\./.test(s0.src) : /hero-film\./.test(s0.src) && !/mobile/.test(s0.src), `the ${device} cut plays (${s0.src.split("/").pop()})`);
      check((await button.getAttribute("aria-label")) === "Pause the film", "the control offers Pause while it plays");
      const box = await button.boundingBox();
      check(box && box.width >= 44 && box.height >= 44, "the control is at least 44 px");
      await shot("film");

      await button.click();
      await p.waitForTimeout(300);
      check((await state()).paused, "Pause stops the film");
      check((await button.getAttribute("aria-label")) === "Play the film", "the control then offers Play");
      await p.mouse.wheel(0, 2400);
      await p.waitForTimeout(500);
      await toFilm();
      await p.waitForTimeout(800);
      check((await state()).paused, "back on screen, a paused film stays paused");
      await button.click();
      await p.waitForTimeout(500);
      check(!(await state()).paused, "Play starts it again");
      await button.focus();
      await p.keyboard.press("Enter");
      await p.waitForTimeout(300);
      check((await state()).paused, "the control works from the keyboard");
      await p.keyboard.press("Space");
      await p.waitForTimeout(400);
      check(!(await state()).paused, "and Space plays it again");

      await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await p.waitForTimeout(800);
      check((await state()).paused, "off screen, the film pauses");
      await toFilm();
      await p.waitForTimeout(1000);
      check(!(await state()).paused, "back on screen, it plays again");

      if (device === "desktop") {
        await p.locator(".a-cards [role=radio]").nth(1).hover();
        await p.waitForTimeout(400);
        check((await state()).paused, "the film holds while the pointer is on the occasions");
        await p.mouse.move(5, 5);
        await p.waitForTimeout(600);
        check(!(await state()).paused, "and plays again when it leaves");
      }
      if (device === "desktop") {
        await p.locator(".a-cards [role=radio]").first().focus();
        await p.waitForTimeout(400);
        check((await state()).paused, "the film holds while an occasion has focus");
      }
    });

    await scenario("P4-1g", "With reduced motion the film waits on its poster until Play is chosen", device, async (p) => {
      await p.goto(`${BASE}/?mode=light`);
      const film = p.locator(".a-demo video");
      await p.waitForTimeout(1500);
      const v = await film.evaluate((v) => ({ paused: v.paused, time: v.currentTime, poster: v.poster }));
      check(v.paused && v.time === 0, "the film does not start on its own");
      check(/hero-film(-mobile)?-poster\.webp$/.test(v.poster), "the poster shows the phone and the three looks");
      const button = p.locator(".a-demo-toggle");
      await button.scrollIntoViewIfNeeded();
      check((await button.getAttribute("aria-label")) === "Play the film", "the control offers Play");
      await button.click();
      await p.waitForFunction(() => {
        const v = document.querySelector(".a-demo video");
        return v && !v.paused && v.currentTime > 0.2;
      }, null, { timeout: 15000 });
      check((await button.getAttribute("aria-label")) === "Pause the film", "Play starts it, and the control offers Pause");
    }, { reducedMotion: "reduce" });
  }

  /*
   * Above the fold: on a 1440 x 900 screen the window under the browser's bars is about 760 to 790 px tall,
   * and the hero with every step of how it works fits in it. Smaller windows keep the whole hero and its five
   * occasions in view and scroll for the rest. Nothing is clipped.
   */
  for (const [w, h, all] of [[1920, 1080, true], [1440, 900, true], [1440, 790, true], [1440, 760, true], [1366, 768, true], [1280, 800, true], [1024, 768, true], [1366, 660, false], [1280, 690, false]]) {
    await scenario("P5-1h", `Home above the fold at ${w} x ${h}`, "desktop", async (p, shot) => {
      await p.goto(`${BASE}/?mode=light`);
      await p.waitForTimeout(900);
      const m = await p.evaluate(() => {
        const r = (s) => document.querySelector(s)?.getBoundingClientRect();
        const steps = [...document.querySelectorAll(".a-steps li")].map((li) => li.getBoundingClientRect().bottom);
        const cards = [...document.querySelectorAll(".a-cards [role=radio]")].map((c) => c.getBoundingClientRect().bottom);
        return { steps: Math.max(...steps), strip: r(".a-steps").bottom, cards: Math.max(...cards), demo: r(".a-demo").bottom, title: r(".a-hero-title").top, header: r("header").bottom, sideways: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      check(m.cards <= h && m.demo <= h, `the hero, its five occasions and the film are in view (cards end ${Math.round(m.cards)}, film ${Math.round(m.demo)})`);
      if (all) check(m.strip <= h, `every step of how it works is in view (ends at ${Math.round(m.strip)} of ${h})`);
      check(m.title - m.header >= 16, `the headline keeps its room under the bar (${Math.round(m.title - m.header)} px)`);
      check(!m.sideways, "nothing scrolls sideways");
      if (w === 1440 && h === 790) {
        const cards = p.locator(".a-cards [role=radio]");
        for (let i = 0; i < 5; i += 1) check(await cards.nth(i).isVisible(), `occasion ${i + 1} visible`);
        await shot("fold");
      }
    }, { viewport: { viewport: { width: w, height: h } } });
  }

  // The Style DNA banner: his whole face is in the picture and no line of the copy sits over it.
  // Face boxes are in the source pictures' own pixels (wide 2400 x 840, phone 800 x 600).
  for (const [w, h, device] of [[1920, 1080, "desktop"], [1440, 900, "desktop"], [1280, 800, "desktop"], [1024, 768, "desktop"], [768, 1024, "desktop"], [390, 844, "phone"]]) {
    await scenario("P5-1i", `Style DNA banner face clear at ${w} x ${h}`, device, async (p, shot) => {
      await p.goto(`${BASE}/?mode=light`);
      await p.locator(".a-dna").scrollIntoViewIfNeeded();
      await p.waitForFunction(() => document.querySelector(".a-dna-image img")?.complete && document.querySelector(".a-dna-image img").naturalWidth > 0);
      const m = await p.evaluate(() => {
        const img = document.querySelector(".a-dna-image img");
        const r = img.getBoundingClientRect();
        const nw = img.naturalWidth, nh = img.naturalHeight, wide = nw / nh > 2;
        const f = wide ? { x0: 490 / 2400, x1: 770 / 2400, y0: 110 / 840, y1: 480 / 840 } : { x0: 350 / 800, x1: 560 / 800, y0: 95 / 600, y1: 370 / 600 };
        const fit = getComputedStyle(img).objectPosition.split(" ").map((v) => parseFloat(v) / 100);
        const s = Math.max(r.width / nw, r.height / nh), dw = nw * s, dh = nh * s;
        const ox = (r.width - dw) * fit[0], oy = (r.height - dh) * fit[1];
        const face = { l: r.left + ox + f.x0 * dw, r: r.left + ox + f.x1 * dw, t: r.top + oy + f.y0 * dh, b: r.top + oy + f.y1 * dh };
        const lines = [...document.querySelectorAll(".a-dna-copy > *")].map((e) => e.getBoundingClientRect());
        return {
          wide,
          whole: face.l >= r.left - 1 && face.r <= r.right + 1 && face.t >= r.top - 1 && face.b <= r.bottom + 1,
          over: lines.some((t) => t.left < face.r && t.right > face.l && t.top < face.b && t.bottom > face.t),
          sideways: document.documentElement.scrollWidth > innerWidth + 1,
        };
      });
      check(m.wide === (w >= 768), `the ${w >= 768 ? "wide" : "phone"} picture is used`);
      check(m.whole, "his whole face is in the picture");
      check(!m.over, "no line of the copy sits over his face");
      check(!m.sideways, "nothing scrolls sideways");
      if (w === 1440 || w === 390) await shot("dna");
    }, { viewport: { viewport: { width: w, height: h } } });
  }
}
