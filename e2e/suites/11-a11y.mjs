/** Suite 11: keyboard, focus, dialogs, labels, images, contrast (axe) and reduced motion. */
import { heroOf, toStep, upload } from "./lib.mjs";

/** Serious and critical problems axe finds on the page as it stands (WCAG 2.1 A and AA, contrast included). */
async function axe(H, p) {
  await p.addScriptTag({ content: H.AXE });
  return p.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const res = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    return res.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target}`);
  });
}

/** The focused element: its name, whether a focus ring shows, and whether it sits in a dialog. */
const focused = (p) =>
  p.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const s = getComputedStyle(el);
    const ring = (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== "none");
    return { name: (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40), role: el.getAttribute("role") || el.tagName.toLowerCase(), ring, inDialog: Boolean(el.closest("[role=dialog]")) };
  });

/** Tabs until a control whose name matches is focused; returns false after max presses. */
async function tabTo(p, re, max = 60) {
  for (let i = 0; i < max; i++) {
    await p.keyboard.press("Tab");
    const f = await focused(p);
    if (f && re.test(f.name)) return f;
  }
  return null;
}

export default async function (H) {
  const { BASE, scenario, check, body, button, toResults, A, photoFile, step } = H;

  await scenario("P3-11a", "The whole journey by keyboard alone, with a visible focus ring at every step", "desktop", async (p, shot) => {
    await p.goto(`${BASE}/?mode=light`);
    await p.waitForTimeout(800);
    const rings = [];
    for (const [re, url] of [[/^Dinner/, /moment\/venue/], [/^Restaurant/, /moment\/time/], [/^Night/, /moment\/feel/], [/^Sharp/, /moment\/spend/], [/^\$300 to/, /moment\/(build|results)/]]) {
      const f = await tabTo(p, re);
      check(Boolean(f), `Tab reaches ${re.source.replace(/[\\^$]/g, "")}`);
      if (!f) return;
      rings.push(f.ring);
      await p.keyboard.press("Enter");
      await p.waitForURL(url, { timeout: 8000 });
      await p.waitForTimeout(700);
    }
    await p.waitForURL(/moment\/results/, { timeout: 15000 });
    await p.waitForTimeout(800);
    check(rings.every(Boolean), `a focus ring shows on every answer (${rings.map((r) => (r ? "yes" : "no")).join(", ")})`);
    const save = await tabTo(p, /^Save$/);
    check(Boolean(save) && save.ring, "Save is reached by Tab, with a focus ring");
    await p.keyboard.press("Enter");
    await p.waitForTimeout(600);
    check(/Saved/.test(await body(p)), "Enter saves");
    await shot("keyboard");
  });

  for (const device of ["desktop", "phone"]) {
    await scenario("P3-11b", "Every dialog takes focus, keeps Tab inside, closes with Escape and gives focus back", device, async (p) => {
      await toResults(p, A);
      const dialogs = [
        ["Check out", () => button(p, /^Check out/), /^Check out/],
        ["Share", () => button(p, /^Share/), /^Share/],
        ["Restyle", () => button(p, /^Restyle/), /Restyle/],
        ["Viewer", () => p.locator("[aria-label^='View ']").first(), /^View /],
      ];
      if (device === "phone") dialogs.push(["Menu", () => p.getByRole("button", { name: "Menu" }).first(), /^Menu/]);
      for (const [name, opener, back] of dialogs) {
        await opener().focus();
        await p.keyboard.press("Enter");
        await p.waitForTimeout(700);
        const first = await focused(p);
        check(first?.inDialog, `${name}: focus moves into the dialog (${first?.name})`);
        let inside = true;
        for (let i = 0; i < 14; i++) {
          await p.keyboard.press("Tab");
          if (!(await focused(p))?.inDialog) inside = false;
        }
        check(inside, `${name}: Tab stays inside the dialog`);
        await p.keyboard.press("Escape");
        await p.waitForTimeout(600);
        check((await p.getByRole("dialog").count()) === 0, `${name}: Escape closes it`);
        const after = await focused(p);
        check(after && back.test(after.name), `${name}: focus returns to what opened it (${after?.name})`);
      }
    });
  }

  for (const device of ["desktop", "phone"]) {
    await scenario("P3-11c", "No serious accessibility problems, colour contrast included, in the states axe had not seen", device, async (p) => {
      const run = async (label) => {
        const v = await axe(H, p);
        check(v.length === 0, `${label}: ${v.length ? v.join("; ") : "clean"}`);
      };
      await toResults(p, A);
      await run("results");
      await p.locator("[aria-label^='View ']").first().click();
      await p.waitForTimeout(700);
      await run("viewer");
      await button(p, "Close").click();
      await button(p, /^Share/).click();
      await p.waitForTimeout(600);
      await run("share");
      await p.keyboard.press("Escape");
      await button(p, /^Restyle/).click();
      await p.waitForTimeout(600);
      await run("restyle");
      await p.keyboard.press("Escape");
      await p.waitForTimeout(300);
      await button(p, /See it on me/).click();
      await p.waitForURL(/moment\/tryon/);
      await p.waitForTimeout(600);
      await run("try-on, explain");
      await button(p, "Continue").click();
      await p.waitForTimeout(400);
      await run("try-on, consent");
      await button(p, "I agree").click();
      await toStep(p, "capture");
      await run("try-on, capture");
      await upload(p, () => p.getByRole("radio", { name: /Upload a photo/ }).first().click(), await photoFile(p));
      await toStep(p, "preview");
      await run("try-on, preview");
      await button(p, "Use this photo").click();
      await toStep(p, "result");
      await run("try-on, answer");
      await p.goto(`${BASE}/dna/fit?mode=light`);
      await p.waitForTimeout(700);
      await run("Style DNA question");
      await p.goto(`${BASE}/?mode=dark`);
      await p.waitForTimeout(900);
      await run("home, dark");
      await toResults(p, A);
      await p.goto(p.url().replace("mode=light", "mode=dark"));
      await p.waitForTimeout(900);
      await run("results, dark");
    }, { premium: true });
  }

  await scenario("P3-11d", "Images are described; decorative ones are hidden; every field has a label", "desktop", async (p) => {
    const pages = [["home", `${BASE}/?mode=light`], ["question", `${BASE}/moment/venue?mode=light&occasion=DINNER`], ["Style DNA", `${BASE}/dna/inspiration?mode=light`], ["your data", `${BASE}/data?mode=light`]];
    for (const [label, url] of pages) {
      await p.goto(url);
      await p.waitForTimeout(800);
      const r = await p.evaluate(() => ({
        noAlt: [...document.images].filter((i) => !i.hasAttribute("alt") && !i.closest("[aria-hidden=true]")).map((i) => i.src.split("/").pop()),
        unlabelled: [...document.querySelectorAll("input:not([type=hidden]), select, textarea")].filter((f) => !f.labels?.length && !f.getAttribute("aria-label") && !f.getAttribute("aria-labelledby")).map((f) => f.name || f.type),
      }));
      check(r.noAlt.length === 0, `${label}: every image has alt text or is hidden (${r.noAlt.join(", ") || "all described"})`);
      check(r.unlabelled.length === 0, `${label}: every field has a label (${r.unlabelled.join(", ") || "all labelled"})`);
    }
    await toResults(p, A);
    const alt = await p.locator(".a-canvas img").filter({ visible: true }).first().getAttribute("alt");
    check(alt && alt.length > 10 && !/^image|photo$/i.test(alt), `the look's photo is described (${alt})`);
    const roles = await p.evaluate(() => ({ main: document.querySelectorAll("main, [role=main]").length, h1: [...document.querySelectorAll("h1")].filter((h) => h.offsetParent).length, live: document.querySelectorAll("[aria-live]").length }));
    check(roles.h1 === 1, `one visible heading names the page (${roles.h1})`);
    check(roles.live > 0, "changes are announced through a live region");
  });

  await scenario("P3-11e", "With reduced motion, nothing animates: the home film stays still and looks change without movement", "phone", async (p) => {
    await p.goto(`${BASE}/?mode=light`);
    await p.waitForTimeout(1500);
    const film = await p.evaluate(() => [...document.querySelectorAll("video")].map((v) => ({ paused: v.paused, auto: v.autoplay })));
    check(film.every((v) => v.paused), `the home film does not play (${JSON.stringify(film)})`);
    await toResults(p, H.A);
    const first = heroOf(p);
    await p.locator(".a-thumb").filter({ visible: true }).nth(1).click();
    await p.waitForTimeout(50);
    const running = await p.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && a.effect?.getTiming?.().duration > 0).length);
    check(heroOf(p) !== first, "the look changes");
    check(running === 0, `no animation runs (${running})`);
    const transform = await p.evaluate(() => [...document.querySelectorAll("[style*='transform']")].filter((e) => /translate|scale/.test(e.style.transform) && !/none|translate(X|Y)?\(0(px)?\)|scale\(1\)/.test(e.style.transform)).length);
    check(transform === 0, `nothing is mid-movement (${transform})`);
  }, { reducedMotion: "reduce" });
}
