/**
 * Renders the home demo (scene.html + scene.js) to video, frame by frame, and writes the
 * finished files to public/media. MP4 (H.264) first, and a VP9 WebM for
 * browsers built without H.264 (open source Chromium on Linux, for one).
 *
 *   node video/hero-demo/render.mjs                 both layouts, every file
 *   node video/hero-demo/render.mjs --stills 0,2.5,4.5,6.5   only PNG stills, for checking
 *   node video/hero-demo/render.mjs --layout mobile
 *
 * Needs Playwright with Chromium (npx playwright install chromium, or a global install; set
 * PLAYWRIGHT_MODULE to its index.mjs if it is not resolvable) and ffmpeg built with libx264,
 * libvpx-vp9 and libwebp. Fonts come from Google Fonts, so the render needs the network.
 */
import { createServer } from "node:http";
import { readFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const PUBLIC = join(ROOT, "public");
const OUT = join(PUBLIC, "media");
const WORK = join(ROOT, "video/.frames");
const FPS = 30;
const SCALE = 2;

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};
const layouts = flag("--layout") ? [flag("--layout")] : ["desktop", "mobile"];
const stills = flag("--stills")?.split(",").map(Number);

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright").catch(() => import("/opt/node22/lib/node_modules/playwright/index.mjs"));

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".jpg": "image/jpeg", ".webp": "image/webp", ".png": "image/png" };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.startsWith("/scene/") ? join(HERE, path.slice(7)) : join(PUBLIC, path);
  try {
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();

function ffmpeg(...a) {
  const r = spawnSync("ffmpeg", ["-loglevel", "error", "-y", ...a], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${a.join(" ")}`);
}

for (const layout of layouts) {
  const page = await browser.newPage({ deviceScaleFactor: SCALE, viewport: { width: 800, height: 800 } });
  await page.goto(`${base}/scene/scene.html?layout=${layout}`);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => (img.onload = img.onerror = r)))));
    await Promise.all([...document.images].map((img) => img.decode().catch(() => null)));
  });
  const { w, h, duration } = await page.evaluate(() => ({ ...window.size, duration: window.DURATION }));
  await page.setViewportSize({ width: w, height: h });
  const stage = page.locator("#stage");
  const name = layout === "mobile" ? "praxis-hero-demo-mobile" : "praxis-hero-demo";

  if (stills) {
    await mkdir(WORK, { recursive: true });
    for (const t of stills) {
      await page.evaluate((t) => window.seek(t), t);
      await stage.screenshot({ path: join(WORK, `${layout}-${t}.png`) });
    }
    console.log(`stills in ${WORK}`);
    await page.close();
    continue;
  }

  const dir = join(WORK, layout);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const frames = Math.round(duration * FPS);
  for (let f = 0; f < frames; f++) {
    await page.evaluate((t) => window.seek(t), f / FPS);
    await stage.screenshot({ path: join(dir, `${String(f).padStart(4, "0")}.png`) });
  }
  // The poster: the three looks, fully developed and held.
  await page.evaluate(() => window.seek(4.9));
  await stage.screenshot({ path: join(dir, "poster.png") });
  await page.close();

  const input = ["-framerate", String(FPS), "-i", join(dir, "%04d.png")];
  ffmpeg(...input, "-c:v", "libx264", "-preset", "slow", "-crf", layout === "mobile" ? "24" : "23", "-pix_fmt", "yuv420p", "-profile:v", "high", "-tune", "film", "-movflags", "+faststart", "-an", join(OUT, `${name}.mp4`));
  ffmpeg(...input, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "38", "-row-mt", "1", "-deadline", "good", "-cpu-used", "1", "-pix_fmt", "yuv420p", "-an", join(OUT, `${name}.webm`));
  ffmpeg("-i", join(dir, "poster.png"), "-c:v", "libwebp", "-quality", "82", join(OUT, `${name}-poster.webp`));
  console.log(`${layout}: ${frames} frames at ${w * SCALE}x${h * SCALE}, ${FPS} fps`);
}

await browser.close();
server.close();
if (!stills && existsSync(WORK)) await rm(WORK, { recursive: true, force: true });
