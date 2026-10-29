/**
 * The screen is 390 x 797, an iPhone below its status bar (the film draws the status bar).
 *
 * Captures the real app screens that the film shows on the phone: home with the occasions, home with
 * Dinner chosen, the build while it works, the three dinner looks, then Style DNA as a signed in
 * Premium customer: the fit step with Slim chosen, the taste step as two tastes are picked, and the
 * saved profile with its colours. They are screenshots of the running app at an iPhone size, so the
 * film always shows Praxis as it is.
 *
 *   npm run build && npm start      (in another terminal, serves http://127.0.0.1:4173)
 *   node video/hero-film/capture.mjs [base url]
 *
 * Writes video/hero-film/screens/*.png and screens/layout.json (where the look thumbnails sit on the
 * results screen, so the prints can leave the screen from them; where each tap lands; where the
 * profile's colours sit, so the swatches can lift from them).
 */
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "screens");
const BASE = process.argv[2] ?? "http://127.0.0.1:4173";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright-core").catch(() => import("/opt/node22/lib/node_modules/playwright/index.mjs"));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 797 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => {
  sessionStorage.setItem("praxis_sim", "slow");
  /* The slow answer keeps the build on screen long enough to photograph; its test mode tag is not part of the film. */
  addEventListener("DOMContentLoaded", () => {
    const style = document.createElement("style");
    style.textContent = ".a-testmode{display:none!important}.a-demo{visibility:hidden}";
    document.head.append(style);
  });
});
const p = await ctx.newPage();
const settle = async (ms = 900) => {
  await p.waitForTimeout(ms);
  await p.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].filter((i) => i.getBoundingClientRect().top < innerHeight).map((i) => i.decode().catch(() => null)));
  });
};

await p.goto(`${BASE}/?mode=light`);
await settle(1500);
await p.screenshot({ path: join(OUT, "home.png") });
const dinner = p.getByRole("radio", { name: "Dinner" }).first();
const box0 = await dinner.boundingBox();
await dinner.click();
await p.waitForTimeout(60);
await p.screenshot({ path: join(OUT, "home-dinner.png") });
for (const name of [/Restaurant/, /Night/, /Sharp/, /\$300 to/]) {
  await p.waitForTimeout(650);
  await p.getByRole("radio", { name }).first().click();
}
await p.waitForURL(/moment\/build/);
await settle(700);
await p.screenshot({ path: join(OUT, "build.png") });
await p.waitForURL(/moment\/results/, { timeout: 20000 });
await settle(2400);
await p.screenshot({ path: join(OUT, "results.png") });
const thumbs = await p.evaluate(() =>
  [...document.querySelectorAll(".a-thumbs-index button, .a-thumbs button")].filter((b) => b.getBoundingClientRect().width > 0).slice(0, 3).map((b) => {
    const r = b.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, label: b.innerText.replace(/\s+/g, " ").trim() };
  }),
);

/* Style DNA, as a signed in Premium customer (a stand-in account; nothing is charged). */
const box = async (locator) => {
  const r = await locator.boundingBox();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
};
const button = (name) => p.getByRole("button", { name }).filter({ visible: true }).first();
await p.evaluate(() => {
  const u = { id: "user_film", name: "Sam", email: "sam@example.com", premium: true };
  localStorage.setItem("praxis_lab_a_user", JSON.stringify(u));
  localStorage.setItem("praxis_lab_a_premium", JSON.stringify({ [u.id]: true }));
});
await p.goto(`${BASE}/?mode=light`);
await settle(1200);
await button("Explore Style DNA").click();
await p.waitForURL(/dna\/face/);
await settle(600);
await p.getByRole("radio", { name: /Use a sample/ }).first().click();
await p.waitForTimeout(500);
await button("Looks right").click();
await p.waitForURL(/dna\/fit/);
await settle(900);
await p.screenshot({ path: join(OUT, "dna-fit.png") });
const slim = p.getByRole("radio", { name: "Slim" }).first();
const slimBox = await box(slim);
await slim.click();
await p.waitForTimeout(60);
await p.screenshot({ path: join(OUT, "dna-fit-slim.png") });
await p.waitForURL(/dna\/lifestyle/);
await settle(600);
await p.getByRole("radio", { name: /Mostly office/ }).first().click();
await p.waitForURL(/dna\/inspiration/);
await settle(1200);
// Down to the list, so both tastes are on screen and picking them doesn't move the page.
await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
await settle(600);
await p.screenshot({ path: join(OUT, "dna-taste.png") });
const tastes = [];
for (const [i, name] of ["Quiet luxury", "Classic tailored"].entries()) {
  const chip = p.getByRole("button", { name }).first();
  tastes.push(await box(chip));
  await chip.click();
  await p.waitForTimeout(400);
  await p.screenshot({ path: join(OUT, `dna-taste-${i + 1}.png`) });
}
await button("Build my Style DNA").click();
await p.waitForURL(/dna\/result/, { timeout: 20000 });
await settle(1200);
await button(/Looks right|Save my Style DNA/).click();
await p.waitForTimeout(1200);
await p.goto(`${BASE}/dna?mode=light`);
await settle(1500);
await p.screenshot({ path: join(OUT, "dna-profile.png") });
const swatches = await p.locator('ul[aria-label="Colours to start with"] li').evaluateAll((els) =>
  els.map((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, hex: getComputedStyle(el).backgroundColor };
  }),
);

await writeFile(join(OUT, "layout.json"), JSON.stringify({ size: [390, 797], dinner: box0, thumbs, slim: slimBox, tastes, swatches }, null, 2));
console.log(JSON.stringify({ dinner: box0, thumbs, slim: slimBox, tastes, swatches }));
await browser.close();
