/**
 * The twelve scenarios from the master spec (section 22), plus accessibility, phone layout and load
 * checks, run in Chromium against a built copy of the app. Repeatable: every scenario starts in a fresh
 * browser profile.
 *
 *   npm run build && npm run e2e
 *
 * Starts `vite preview` on port 4173 unless BASE_URL is set. Needs a Chromium that Playwright can find
 * (PLAYWRIGHT_BROWSERS_PATH, or CHROMIUM_PATH for a specific binary). Writes e2e/results/report.md and
 * report.json, with screenshots, and exits non-zero if anything fails.
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "results");
mkdirSync(OUT, { recursive: true });
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

const DESKTOP = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 };

/* ------------------------------------------------------------ server */

let server = null;
let BASE = process.env.BASE_URL?.replace(/\/$/, "");
if (!BASE) {
  BASE = "http://127.0.0.1:4173";
  server = spawn("npx", ["vite", "preview", "--port", "4173", "--strictPort", "--host", "127.0.0.1"], { cwd: join(here, ".."), stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) break;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

/* ------------------------------------------------------------ harness */

const results = [];
let current = null;

function check(cond, what) {
  current.checks.push({ ok: Boolean(cond), what });
}

async function scenario(id, title, device, fn, { sim } = {}) {
  const ctx = await browser.newContext({ ...(device === "phone" ? PHONE : DESKTOP), reducedMotion: "no-preference" });
  if (sim) await ctx.addInitScript((s) => sessionStorage.setItem("praxis_sim", s), sim);
  const page = await ctx.newPage();
  current = { id, title, device, checks: [], errors: [], status: "passed" };
  page.on("pageerror", (e) => current.errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") current.errors.push(m.text());
  });
  const shot = (name) => page.screenshot({ path: join(OUT, `${id}-${device}-${name}.png`) });
  try {
    await fn(page, shot);
  } catch (e) {
    current.checks.push({ ok: false, what: `ran to the end (${String(e.message).split("\n")[0]})` });
  }
  if (current.errors.length) current.checks.push({ ok: false, what: `no page errors (${current.errors[0]})` });
  current.status = current.checks.every((c) => c.ok) ? "passed" : "failed";
  results.push(current);
  await ctx.close();
}

const body = (p) => p.locator("body").innerText();
const button = (p, name) => p.getByRole("button", { name }).filter({ visible: true }).first();
const events = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("praxis_events") || "[]"));
const history = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("praxis_styling_history") || "[]"));
const lab = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("praxis_lab_a") || "{}"));

/** Home, occasion, then the four questions; ends on the build. */
async function answer(p, { occasion, venue, time, feel, spend }) {
  await p.goto(`${BASE}/?mode=light`);
  await p.getByRole("radio", { name: occasion }).first().click();
  for (const name of [venue, time, feel, spend]) {
    await p.waitForTimeout(650);
    await p.getByRole("radio", { name }).first().click();
  }
  await p.waitForURL(/moment\/build/, { timeout: 8000 });
}
async function toResults(p, picks) {
  await answer(p, picks);
  await p.waitForURL(/moment\/results/, { timeout: 15000 });
  await p.waitForTimeout(1000);
}

const A = { occasion: "Dinner", venue: /Restaurant/, time: /Night/, feel: /Sharp/, spend: /\$300 to/ };
const B = { occasion: "Dinner", venue: /home/i, time: /Sunset/, feel: /Relaxed/, spend: /Under/ };

/* ------------------------------------------------------------ scenarios */

for (const device of ["desktop", "phone"]) {
  await scenario("S1", "First-time visitor gets three looks", device, async (p, shot) => {
    await toResults(p, A);
    const h = await history(p);
    check(h.length === 1, "one styling request sent");
    check(h[0]?.response?.status === "completed" && h[0].response.outfits.length === 3, "three looks returned");
    check((await p.locator(".a-thumbs button, [data-thumb]").count()) >= 3 || /1 of 3/i.test(await body(p)), "three looks shown");
    check(/for illustration/i.test(await body(p)), "the looks say they are examples");
    await shot("results");
  });

  await scenario("S2", "Different venue and time give a different request and looks", device, async (p) => {
    await toResults(p, A);
    await toResults(p, B);
    const [b, a] = await history(p);
    check(a.request.venue.type !== b.request.venue.type && a.request.timeOfDay !== b.request.timeOfDay, "venue and time differ in the request");
    check(a.request.inputKey !== b.request.inputKey, "the request key changes");
    check(a.response.outfits[0].outfitId !== b.response.outfits[0].outfitId, `different first look (${a.response.outfits[0].outfitId} vs ${b.response.outfits[0].outfitId})`);
  });

  await scenario("S3", "Rejecting a look as too formal stores feedback against it", device, async (p, shot) => {
    await toResults(p, A);
    const recommendationId = (await history(p))[0].response.recommendationId;
    const hero = new URL(p.url()).searchParams.get("hero");
    await button(p, /Not for me/).click();
    await p.waitForTimeout(300);
    await button(p, /Too formal/).click();
    await p.waitForTimeout(400);
    const fb = await p.evaluate(() => JSON.parse(localStorage.getItem("praxis_feedback") || "[]"));
    check(fb.length === 1, "stored once");
    check(fb[0]?.reason === "too_formal", "reason is too formal");
    check(fb[0]?.recommendationId === recommendationId && (!hero || fb[0]?.outfitId === hero), "against the right recommendation and look");
    await shot("feedback");
  });

  await scenario("S4", "A guest's saved look survives a refresh", device, async (p) => {
    await toResults(p, A);
    await button(p, /^Save/).click();
    await p.waitForTimeout(800);
    check(!/Sign in to save/i.test(await body(p)), "no sign in asked");
    await p.reload();
    await p.waitForTimeout(800);
    await p.goto(`${BASE}/looks?mode=light`);
    await p.waitForTimeout(800);
    const s = await lab(p);
    check((s.looks ?? []).length === 1, "one saved look in storage after refresh");
    check(!/No saved looks|nothing saved/i.test(await body(p)), "saved looks page lists it");
  });

  await scenario("S5", "Signing in moves a guest's saved look to the account", device, async (p, shot) => {
    await toResults(p, A);
    await button(p, /^Save/).click();
    await p.waitForTimeout(800);
    const owner = (await lab(p)).looks?.[0]?.owner;
    if (!(await p.getByRole("button", { name: /^Sign in$/ }).filter({ visible: true }).count())) {
      await p.getByRole("button", { name: /^Menu$/ }).first().click({ force: true });
      await p.waitForTimeout(400);
    }
    await button(p, /Sign in/).click();
    await p.waitForTimeout(600);
    await button(p, /Apple/).click();
    await p.waitForTimeout(1200);
    const after = (await lab(p)).looks ?? [];
    check(after.length === 1, "still one saved look");
    check(after[0] && after[0].owner !== owner && /user_/.test(JSON.stringify(after[0])), "the look now belongs to the account");
    check((await events(p)).some((e) => e.eventName === "account_migrated"), "migration recorded");
    await shot("signed-in");
  });

  await scenario("S6", "A corrected Style DNA colour is kept", device, async (p, shot) => {
    await p.goto(`${BASE}/dna/face?mode=light`);
    await p.waitForTimeout(600);
    await p.getByRole("radio", { name: /Use a sample/ }).first().click();
    await p.waitForTimeout(500);
    await button(p, "Looks right").click();
    await p.waitForTimeout(600);
    await p.getByRole("radio").first().click();
    await p.waitForTimeout(600);
    await p.getByRole("radio").first().click();
    await p.waitForTimeout(600);
    await p.getByRole("button").filter({ visible: true }).filter({ hasText: /Continue|Build|Next|Skip|Done/ }).first().click();
    await p.waitForURL(/dna\/result/, { timeout: 10000 });
    await p.waitForTimeout(500);
    check(/Example|Estimate/.test(await body(p)), "the colours are marked as an example");
    await button(p, "Not quite right?").click();
    await p.waitForTimeout(400);
    await p.getByRole("button", { name: "Warm" }).filter({ visible: true }).first().click();
    await p.keyboard.press("Escape");
    await p.waitForTimeout(400);
    await button(p, /Looks right|Save my Style DNA/).click();
    await p.waitForTimeout(800);
    await p.reload();
    const dna = (await lab(p)).dna;
    check(dna?.undertone?.corrected?.value === "warm", "the correction is saved");
    check(dna?.undertone?.inferred?.value && dna.undertone.inferred.value !== "warm", "the estimate is kept apart from it");
    await p.goto(`${BASE}/dna?mode=light`);
    await p.waitForTimeout(600);
    check(/Your correction/.test(await body(p)) && /Warm/.test(await body(p)), "the Style DNA page shows the correction");
    await shot("dna");
  });

  await scenario("S7", "An unreadable photo gets a way forward", device, async (p, shot) => {
    const dark = await p.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 600;
      c.height = 800;
      const g = c.getContext("2d");
      g.fillStyle = "#080808";
      g.fillRect(0, 0, 600, 800);
      return c.toDataURL("image/png").split(",")[1];
    });
    await p.goto(`${BASE}/dna/face?mode=light`);
    await p.waitForTimeout(600);
    await p.getByRole("radio", { name: /Upload a photo/ }).first().click();
    await p.waitForTimeout(300);
    check(/where it goes/i.test(await body(p)), "the photo notice comes first");
    const chooser = p.waitForEvent("filechooser", { timeout: 4000 });
    await button(p, "I agree").click();
    await (await chooser).setFiles({ name: "dark.png", mimeType: "image/png", buffer: Buffer.from(dark, "base64") });
    await p.waitForTimeout(1200);
    const t = await body(p);
    check(/too dark|daylight|light/i.test(t) && (await p.getByRole("alert").count()) > 0, "the reason is shown");
    check((await p.getByRole("radio", { name: /Use a sample/ }).count()) > 0, "another photo or a sample can be chosen");
    check(!(await p.evaluate(() => Object.values(localStorage).some((v) => v.includes("data:image")))), "the photo is not stored");
    await shot("refused");
  });

  await scenario(
    "S7b",
    "A photo the analysis cannot read offers a retake or skipping colours",
    device,
    async (p, shot) => {
      await p.goto(`${BASE}/dna/face?mode=light`);
      await p.waitForTimeout(600);
      await p.getByRole("radio", { name: /Use a sample/ }).first().click();
      await p.waitForTimeout(400);
      await button(p, "Looks right").click();
      await p.waitForTimeout(500);
      await p.getByRole("radio").first().click();
      await p.waitForTimeout(500);
      await p.getByRole("radio").first().click();
      await p.waitForTimeout(500);
      await p.getByRole("button").filter({ visible: true }).filter({ hasText: /Continue|Build|Next|Skip|Done/ }).first().click();
      await p.waitForTimeout(1500);
      const t = await body(p);
      check(/couldn’t read your colours/.test(t), "says the photo could not be read");
      check((await button(p, "Retake the photo").count()) && (await button(p, /Skip colours/).count()), "retake or skip offered");
      await button(p, /Skip colours/).click();
      await p.waitForURL(/dna\/result/, { timeout: 5000 });
      check(/No colours yet/.test(await body(p)), "carries on without colours");
      await shot("skip");
    },
    { sim: "invalid_image" },
  );

  await scenario(
    "S8",
    "A slow answer, then a timeout, can be recovered",
    device,
    async (p, shot) => {
      await answer(p, A);
      await p.waitForTimeout(5800);
      check(/taking a little longer than usual/.test(await body(p)), "the delay is said after 5 seconds");
      check(!/\d+\s?%/.test(await body(p)), "no percentage shown");
      check(await button(p, "Cancel").count(), "Cancel is offered");
      await p.waitForTimeout(4500);
      const t = await body(p);
      check(/couldn’t put your looks together this time/.test(t), "the timeout is said plainly");
      check(await button(p, "Try again").count(), "Try again offered");
      check(await button(p, "Change my answers").count(), "Change my answers offered");
      await shot("timeout");
      await p.evaluate(() => sessionStorage.setItem("praxis_sim", "fast"));
      await button(p, "Try again").click();
      await p.waitForURL(/moment\/results/, { timeout: 10000 });
      check(true, "Try again reaches the looks");
    },
    { sim: "timeout" },
  );

  await scenario(
    "S9",
    "Two looks only: the page works and says so",
    device,
    async (p, shot) => {
      await toResults(p, A);
      check(/I found 2 looks this time/.test(await body(p)), "says only two looks came back");
      check((await history(p))[0].response.status === "partial", "the answer is marked partial");
      await button(p, /Next look|Previous look/).click().catch(() => {});
      await button(p, /Check out/).click();
      await p.waitForTimeout(500);
      check(/Check out/.test(await body(p)), "Check out still opens");
      await shot("partial");
    },
    { sim: "partial" },
  );

  await scenario(
    "S10",
    "A sold-out piece never leads to a purchase",
    device,
    async (p, shot) => {
      await toResults(p, A);
      check(/Sold out/.test(await body(p)), "the piece says Sold out");
      const sold = p.locator(".a-piece", { hasText: "Sold out" }).first();
      check((await sold.getByRole("checkbox").count()) === 0, "a sold-out piece cannot be ticked");
      await button(p, /Check out/).click();
      await p.waitForTimeout(600);
      const t = await body(p);
      check(!/Order placed|Purchase \$/.test(t), "no fake order or Purchase button");
      const buy = p.getByRole("button", { name: /Buying isn/ }).filter({ visible: true }).first();
      check((await buy.count()) && (await buy.isDisabled()), "the buy button is disabled");
      check((await p.getByRole("link", { name: /Buy at/ }).count()) === 0, "no link out to a retailer");
      await shot("checkout");
    },
    { sim: "unavailable_products" },
  );
}

await scenario("S11", "Phone: the whole journey, swipe, enlarge, back and save", "phone", async (p, shot) => {
  await toResults(p, A);
  const first = new URL(p.url()).searchParams.get("hero");
  const print = p.locator("[aria-label^='View ']").first();
  const box = await print.boundingBox();
  check(box && box.width <= 390, "the print fits the screen");
  const y = box.y + box.height / 2;
  await p.mouse.move(box.x + box.width * 0.8, y);
  await p.mouse.down();
  for (let i = 1; i <= 8; i++) await p.mouse.move(box.x + box.width * (0.8 - i * 0.07), y);
  await p.mouse.up();
  await p.waitForTimeout(600);
  const second = new URL(p.url()).searchParams.get("hero");
  check(second && second !== first, "a sideways swipe moves to the next look");
  await print.click();
  await p.waitForTimeout(700);
  check(await p.getByRole("dialog").count(), "a tap opens the look large");
  await button(p, "Zoom in").click();
  await p.waitForTimeout(300);
  await shot("viewer");
  await button(p, "Close").click();
  await p.waitForTimeout(500);
  check((await p.getByRole("dialog").count()) === 0 && new URL(p.url()).searchParams.get("hero") === second, "closing returns to the same look");
  await button(p, /^Save/).click();
  await p.waitForTimeout(700);
  check(((await lab(p)).looks ?? []).length === 1, "the look is saved");
  await p.goBack();
  await p.waitForTimeout(700);
  check(/moment\//.test(p.url()), "Back stays in the journey");
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!overflow, "no sideways scroll");
});

await scenario("S12", "Analytics: once each, stable ids, real actions only", "desktop", async (p) => {
  await toResults(p, A);
  await p.reload();
  await p.waitForTimeout(1200);
  await button(p, /^Save/).click();
  await p.waitForTimeout(600);
  const ev = await events(p);
  const names = ev.map((e) => e.eventName);
  const count = (n) => names.filter((x) => x === n).length;
  const rid = (await history(p))[0].response.recommendationId;
  check(ev.length > 0 && ev.every((e) => e.anonymousSessionId === ev[0].anonymousSessionId), "one anonymous id throughout");
  check(new Set(ev.map((e) => e.eventId)).size === ev.length, "every event id is unique");
  check(count("styling_submitted") === 1 && count("processing_completed") === 1, "one request, counted once, also after a reload");
  check(count("results_viewed") === 1, "results counted once per recommendation, also after a reload");
  check(count("look_saved") === 1, "one save, one event");
  check(ev.filter((e) => e.recommendationId || e.properties?.recommendationId).every((e) => (e.recommendationId ?? e.properties.recommendationId) === rid), "events carry the recommendation they belong to");
  check(!/data:|base64|blob:/.test(JSON.stringify(ev)), "no photo data in events");
  check(count("recommendation_rejected") === 0 && count("look_shared") === 0, "nothing recorded that did not happen");
});

/* ------------------------------------------------------------ accessibility */

const PAGES = [
  ["home", "/?mode=light"],
  ["question", "/moment/venue?mode=light&occasion=DINNER"],
  ["style-dna-photo", "/dna/face?mode=light"],
  ["your-data", "/data?mode=light"],
  ["saved-looks", "/looks?mode=light"],
];
for (const device of ["desktop", "phone"]) {
  await scenario("A11Y", "No serious or critical accessibility problems (axe)", device, async (p) => {
    const run = async (name) => {
      await p.addScriptTag({ content: AXE });
      const r = await p.evaluate(async () => {
        // eslint-disable-next-line no-undef
        const res = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
        return res.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target}`);
      });
      check(r.length === 0, `${name}: ${r.length ? r.join("; ") : "clean"}`);
    };
    for (const [name, path] of PAGES) {
      await p.goto(BASE + path);
      await p.waitForTimeout(900);
      await run(name);
    }
    await toResults(p, A);
    await run("results");
    await button(p, /Check out/).click();
    await p.waitForTimeout(600);
    await run("check-out");
  });

  await scenario("LAYOUT", "Controls are at least 44px and nothing scrolls sideways", device, async (p) => {
    for (const path of ["/?mode=light", "/moment/venue?mode=light&occasion=DINNER", "/dna/face?mode=light", "/data?mode=light"]) {
      await p.goto(BASE + path);
      await p.waitForTimeout(800);
      const small = await p.evaluate(() =>
        [...document.querySelectorAll("button, a[href], [role=radio], [role=checkbox], input[type=checkbox]")]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && !el.closest("[aria-hidden=true]") && !el.classList.contains("sr-only");
          })
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.height < 43.5 && r.width < 43.5;
          })
          .map((el) => (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 30)),
      );
      check(small.length === 0, `${path}: ${small.length ? `small targets: ${small.join(", ")}` : "targets 44px or more"}`);
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      check(!overflow, `${path}: no sideways scroll`);
    }
  });
}

/* ------------------------------------------------------------ performance */

const perf = [];
for (const device of ["desktop", "phone"]) {
  await scenario("PERF", "Home loads quickly", device, async (p) => {
    const cdp = await p.context().newCDPSession(p);
    await cdp.send("Network.enable");
    if (device === "phone") await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    let bytes = 0;
    cdp.on("Network.loadingFinished", (e) => (bytes += e.encodedDataLength));
    await p.goto(`${BASE}/?mode=light`, { waitUntil: "load" });
    await p.waitForTimeout(1500);
    const m = await p.evaluate(
      () =>
        new Promise((resolve) => {
          const nav = performance.getEntriesByType("navigation")[0];
          new PerformanceObserver((list) => {
            const e = list.getEntries();
            resolve({ lcp: Math.round(e[e.length - 1].startTime), dcl: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd) });
          }).observe({ type: "largest-contentful-paint", buffered: true });
        }),
    );
    const cls = await p.evaluate(() => performance.getEntriesByType("layout-shift").reduce((s, e) => s + (e.hadRecentInput ? 0 : e.value), 0));
    perf.push({ device, ...m, cls: Number(cls.toFixed(3)), kb: Math.round(bytes / 1024) });
    const budget = device === "phone" ? 4000 : 2500;
    check(m.lcp <= budget, `largest paint ${m.lcp} ms (budget ${budget} ms${device === "phone" ? ", slow 4G" : ""})`);
    check(cls <= 0.1, `layout shift ${cls.toFixed(3)} (budget 0.1)`);
  });
}

/* ------------------------------------------------------------ report */

await browser.close();
server?.kill();

const passed = results.filter((r) => r.status === "passed").length;
const lines = [
  "# Scenario test report",
  "",
  `Run against ${BASE} on ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC. ${passed} of ${results.length} runs passed.`,
  "",
  "| Scenario | Device | Result | Checks |",
  "| --- | --- | --- | --- |",
  ...results.map((r) => `| ${r.id} ${r.title} | ${r.device} | ${r.status} | ${r.checks.filter((c) => c.ok).length}/${r.checks.length} |`),
  "",
  "## Failed checks",
  "",
  ...(results.flatMap((r) => r.checks.filter((c) => !c.ok).map((c) => `- ${r.id} ${r.device}: ${c.what}`)).length
    ? results.flatMap((r) => r.checks.filter((c) => !c.ok).map((c) => `- ${r.id} ${r.device}: ${c.what}`))
    : ["None."]),
  "",
  "## Load",
  "",
  "| Device | Largest paint | DOM ready | Load | Layout shift | Transferred |",
  "| --- | --- | --- | --- | --- | --- |",
  ...perf.map((m) => `| ${m.device} | ${m.lcp} ms | ${m.dcl} ms | ${m.load} ms | ${m.cls} | ${m.kb} KB |`),
  "",
];
writeFileSync(join(OUT, "report.md"), lines.join("\n"));
writeFileSync(join(OUT, "report.json"), JSON.stringify({ base: BASE, results, perf }, null, 2));
console.log(lines.join("\n"));
process.exit(passed === results.length ? 0 : 1);
