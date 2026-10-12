/**
 * Renders the homepage film (scene.html + scene.js, three.js) frame by frame in Chromium and encodes
 * it with ffmpeg into public/media: an H.264 MP4, a VP9 WebM and a WebP poster for each cut.
 *
 *   node video/hero-film/capture.mjs                  first, when the app's screens change
 *   node video/hero-film/render.mjs                   both cuts (desktop 6:5, mobile 4:5)
 *   node video/hero-film/render.mjs --layout mobile   one cut
 *   node video/hero-film/render.mjs --stills 0,1.2,2.6,4.2,5.4,6.2,8   PNG stills in video/.frames
 *
 * WebGL runs on SwiftShader, so no GPU is needed. Fonts come from Google Fonts (network needed).
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
const POSTER_AT = 5.6;

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};
const layouts = flag("--layout") ? [flag("--layout")] : ["desktop", "mobile"];
const stills = flag("--stills")?.split(",").map(Number);

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright-core").catch(() => import("/opt/node22/lib/node_modules/playwright/index.mjs"));

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".jpg": "image/jpeg", ".webp": "image/webp", ".png": "image/png" };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.startsWith("/scene/") ? join(HERE, path.slice(7)) : path.startsWith("/node_modules/") ? join(ROOT, path) : join(PUBLIC, path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await mkdir(OUT, { recursive: true });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined),
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

function ffmpeg(...a) {
  const r = spawnSync("ffmpeg", ["-loglevel", "error", "-y", ...a], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${a.join(" ")}`);
}

for (const layout of layouts) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`${base}/scene/scene.html?layout=${layout}`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  const { w, h, duration } = await page.evaluate(() => ({ ...window.size, duration: window.DURATION }));
  await page.setViewportSize({ width: w, height: h });
  const stage = page.locator("#stage");
  const name = layout === "mobile" ? "praxis-hero-film-mobile" : "praxis-hero-film";

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
  const started = Date.now();
  for (let f = 0; f < frames; f++) {
    await page.evaluate((t) => window.seek(t), f / FPS);
    await stage.screenshot({ path: join(dir, `${String(f).padStart(4, "0")}.png`) });
    if (f % 30 === 0) console.log(`${layout} ${f}/${frames} ${Math.round((Date.now() - started) / 1000)}s`);
  }
  // The poster: the phone and the three looks, settled.
  await page.evaluate((t) => window.seek(t), POSTER_AT);
  await stage.screenshot({ path: join(dir, "poster.png") });
  await page.close();

  // A soft vignette, as a lens would give it.
  const input = ["-framerate", String(FPS), "-i", join(dir, "%04d.png"), "-vf", "vignette=angle=PI/5:mode=forward"];
  ffmpeg(...input, "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p", "-profile:v", "high", "-tune", "film", "-movflags", "+faststart", "-an", join(OUT, `${name}.mp4`));
  ffmpeg(...input, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", "-row-mt", "1", "-deadline", "good", "-cpu-used", "1", "-pix_fmt", "yuv420p", "-an", join(OUT, `${name}.webm`));
  ffmpeg("-i", join(dir, "poster.png"), "-vf", "vignette=angle=PI/5:mode=forward", "-c:v", "libwebp", "-quality", "80", join(OUT, `${name}-poster.webp`));
  console.log(`${layout}: ${frames} frames at ${w}x${h}, ${FPS} fps`);
}

await browser.close();
server.close();
if (!stills && existsSync(WORK)) await rm(WORK, { recursive: true, force: true });
