#!/usr/bin/env node
/**
 * Smoke tests for a deployed Praxis. Read-only apart from one labelled test error report: nothing is
 * saved, bought or deleted, and no paid service can be reached (the AI and try-on checks expect the
 * "not connected" answer).
 *
 *   node tools/smoke.mjs https://praxis-redesign-production.up.railway.app [expected-commit]
 *
 * With playwright-core and a Chromium available (CHROMIUM_PATH, or Playwright's own), it also opens
 * the home page on a phone and a desktop and walks to the looks. Exits non-zero on any failure.
 */
const BASE = (process.argv[2] ?? process.env.SMOKE_URL ?? "").replace(/\/$/, "");
const EXPECT = (process.argv[3] ?? process.env.SMOKE_COMMIT ?? "").slice(0, 7);
if (!BASE) {
  console.error("Usage: node tools/smoke.mjs <url> [expected-commit]");
  process.exit(2);
}

const results = [];
const check = (ok, what) => {
  results.push({ ok: Boolean(ok), what });
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
};
const get = (path, init) => fetch(`${BASE}${path}`, { redirect: "manual", ...init });
const post = (path, body) => get(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function step(name, fn) {
  try {
    await fn();
  } catch (err) {
    check(false, `${name}: ${err?.message ?? err}`);
  }
}

await step("health", async () => {
  const res = await get("/api/health");
  const h = await res.json();
  check(res.status === 200 && h.ok, `health answers (version ${h.version}, commit ${h.commit})`);
  if (EXPECT) check(h.commit === EXPECT, `the deployed commit is ${EXPECT}`);
  check(Array.isArray(h.ai?.providersSet) && h.ai.providersSet.length === 0, "no AI provider is named (free ones on: " + (h.ai?.freeOn?.join(", ") || "none") + ")");
  check(h.ai?.billableAllowed === false && h.tryOn?.billableAllowed === false && h.tryOn?.providerSet === false, "paid AI and image calls are off");
});

let code = "";
await step("pages", async () => {
  const res = await get("/");
  const html = await res.text();
  check(res.status === 200 && html.includes('id="root"'), "home page loads");
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  for (const src of scripts) {
    const r = await get(src);
    code += await r.text();
    check(r.status === 200, `script ${src} loads`);
  }
  for (const path of ["/moment/venue?occasion=DINNER", "/looks", "/wardrobe", "/data", "/dna"]) {
    const r = await get(path);
    check(r.status === 200 && (await r.text()).includes('id="root"'), `${path.split("?")[0]} loads`);
  }
  check(!code.includes("Analytics in this browser"), "the test mode page is not in the live build");
  for (const [re, what] of [
    [/AIza[0-9A-Za-z_-]{30,}/, "Google key"],
    [/sk-(ant-|proj-)?[A-Za-z0-9_-]{24,}/, "secret key"],
    [/generativelanguage\.googleapis\.com|api\.openai\.com|api\.anthropic\.com|api\.stripe\.com/, "provider address"],
  ])
    check(!re.test(code), `no ${what} in the page`);
});

await step("files", async () => {
  const r = await get("/images/home/date-480.webp", { method: "HEAD" });
  check(r.status === 200, "a home photo loads");
  for (const file of ["praxis-hero-film.mp4", "praxis-hero-film.webm", "praxis-hero-film-poster.webp", "praxis-hero-film-mobile.mp4", "praxis-hero-film-mobile.webm", "praxis-hero-film-mobile-poster.webp"]) {
    const f = await get(`/media/${file}`, { method: "HEAD" });
    check(f.status === 200, `the home film file ${file} loads`);
  }
  for (const file of ["/mediapipe/vision_wasm_internal.wasm", "/mediapipe/vision_wasm_internal.js", "/models/face_landmarker.task"]) {
    const f = await get(file, { method: "HEAD" });
    check(f.status === 200, `the on-device colour reader file ${file} loads`);
  }
  const missing = await get("/assets/does-not-exist.js");
  check(missing.status === 404, "a missing file is a real 404");
  const country = await get("/api/country");
  check(country.status === 200, "country lookup answers");
});

await step("ai", async () => {
  const envelope = { requestId: "smoke", service: "styling_recommendation", contractVersion: "ai-2026-10-12", anonymousSessionId: "anon_smoke", attempt: 1, createdAt: new Date().toISOString(), payload: { smoke: true } };
  const ai = await (await post("/api/ai/styling_recommendation", envelope)).json();
  check(ai.status === "disabled" && ai.error?.code === "not_connected", "AI plug-in point answers not connected");
  const t = await (await post("/api/tryon", { requestId: "smoke", outfitId: "o", garmentIds: ["g"], person: { image: "data:image/jpeg;base64,AAAA", width: 720, height: 960, consentVersion: "tryon-server-2026-10-11" } })).json();
  check(t.status === "disabled", "try-on plug-in point makes nothing");
  const live = await (await get("/api/ai")).json();
  check(Array.isArray(live.live) && live.live.every((s) => s.billable === false), `only free AI answers (${live.live?.map((s) => s.provider).join(", ") || "none"})`);
  if (live.live?.some((s) => s.service === "styling_explanation")) {
    // The free writer is on: one look, in words only, and its answer must keep the voice rules.
    const look = { outfitId: "smoke-look", role: "SHARPER", title: "Navy evening", pieces: [{ slot: "top", name: "Navy merino knit" }, { slot: "outer", name: "Charcoal wool blazer" }, { slot: "bottom", name: "Grey flannel trousers" }, { slot: "shoes", name: "Dark brown suede loafers" }] };
    const request = { occasion: "DINNER", venue: { label: "Restaurant" }, timeOfDay: "NIGHT", preferredVibe: "SHARP", budget: { band: "ELEVATED" } };
    const words = await (await post("/api/ai/styling_explanation", { ...envelope, requestId: "smoke-words", service: "styling_explanation", payload: { request, outfitId: look.outfitId, looks: [look] } })).json();
    const line = words.result?.looks?.[0];
    check(words.status === "succeeded" && !!line?.summary && !!line?.note, `the free writer answers (${words.status}${words.error ? `, ${words.error.message}` : ""})`);
    if (line) console.log(`      line: ${line.summary}\n      note: ${line.note}`);
  }
});

await step("monitoring", async () => {
  const r = await post("/api/client-error", { name: "SmokeTest", where: "smoke", path: "/", release: "smoke", frames: [] });
  check(r.status === 204, "error reports are accepted (look for SmokeTest in the Railway log)");
});

await step("browser", async () => {
  let chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    console.log("SKIP  browser walk-through (playwright-core not installed)");
    return;
  }
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const [device, viewport, mobile] of [
    ["phone", { width: 390, height: 844 }, true],
    ["desktop", { width: 1440, height: 900 }, false],
  ]) {
    const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.name));
    await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const cards = await p.locator(".a-cards [role=radio]").count();
    check(cards >= 5, `${device}: home shows the occasions (${cards})`);
    await p.goto(`${BASE}/moment/results?occasion=DINNER&venue=RESTAURANT&time=NIGHT&vibe=SHARP&spend=ELEVATED`, { waitUntil: "networkidle" });
    await p.waitForSelector(".a-thumb, .a-piece", { timeout: 20000 });
    check((await p.locator(".a-piece").count()) > 0, `${device}: looks are shown with their pieces`);
    await p.goto(`${BASE}/wardrobe`, { waitUntil: "networkidle" });
    check(await p.getByRole("heading", { name: "Your wardrobe" }).isVisible(), `${device}: the wardrobe opens`);
    check(errors.length === 0, `${device}: no page errors${errors.length ? ` (${errors.join(", ")})` : ""}`);
    await ctx.close();
  }
  await browser.close();
});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} smoke checks passed against ${BASE}`);
process.exit(failed.length ? 1 : 0);
