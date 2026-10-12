/**
 * Suite 12: the AI service contracts. The contract tests themselves are unit tests (vitest); this suite
 * runs them and records each one, then checks the server's plug-in points and the shipped bundle.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SERVICES = ["styling_recommendation", "styling_explanation", "outfit_visualization", "virtual_try_on", "face_colour_analysis", "body_fit_analysis", "garment_recognition", "product_matching", "inventory_pricing"];
const CONTRACT_TESTS = ["src/core/__tests__/ai-services.test.ts", "src/core/__tests__/phase2-integrity.test.ts", "src/core/__tests__/tryon.test.ts", "src/core/__tests__/validate.test.ts"];

/** Strings that would mean a provider is called from the page, or a key shipped in it. */
const FORBIDDEN = [
  [/AIza[0-9A-Za-z_-]{30,}/, "a Google API key"],
  [/sk-(ant-|proj-)?[A-Za-z0-9_-]{24,}/, "a secret key"],
  [/generativelanguage\.googleapis\.com/, "the Gemini API"],
  [/api\.openai\.com/, "the OpenAI API"],
  [/api\.anthropic\.com/, "the Anthropic API"],
  [/api\.replicate\.com|fal\.run|api\.stability\.ai/, "an image-generation API"],
  [/api\.stripe\.com|js\.stripe\.com/, "a payment API"],
];

export default async function (H) {
  const { BASE, scenario, check } = H;

  await scenario("P3-12a", "Every mock provider meets its contract: valid and invalid requests and answers, errors, provider choice", "node", async () => {
    const out = join(H.OUT, "contract-tests.json");
    rmSync(out, { force: true });
    try {
      execFileSync("npx", ["vitest", "run", ...CONTRACT_TESTS, "--reporter=json", `--outputFile=${out}`], { cwd: ROOT, stdio: "ignore", timeout: 180_000 });
    } catch {
      // Failures are read from the report below.
    }
    const report = JSON.parse(readFileSync(out, "utf8"));
    const tests = report.testResults.flatMap((f) => f.assertionResults.map((a) => ({ name: `${f.name.split("__tests__/")[1]}: ${a.fullName}`, ok: a.status === "passed", status: a.status })));
    for (const f of CONTRACT_TESTS) check(report.testResults.some((r) => r.name.endsWith(f) && r.assertionResults.length > 0), `${f.split("/").pop()} ran`);
    check(tests.length > 0, `${tests.length} contract tests ran`);
    for (const t of tests) check(t.ok, `${t.name}${t.ok ? "" : ` (${t.status})`}`);
  });

  await scenario("P3-12b", "The server's AI plug-in points answer 'not connected' for all nine services and refuse bad requests", "node", async () => {
    for (const service of SERVICES) {
      const envelope = { requestId: `e2e_${service}`, service, contractVersion: "ai-2026-10-12", anonymousSessionId: "anon_e2e", attempt: 1, createdAt: new Date().toISOString(), payload: { e2e: true } };
      const res = await fetch(`${BASE}/api/ai/${service}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(envelope) });
      const json = await res.json();
      check(res.status === 200 && json.status === "disabled" && json.error?.code === "not_connected", `${service}: disabled, not connected`);
    }
    const bad = await fetch(`${BASE}/api/ai/face_colour_analysis`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service: "face_colour_analysis" }) });
    check(bad.status === 400 && (await bad.json()).error?.code === "validation_error", "an incomplete envelope is refused (400)");
    const wrong = await fetch(`${BASE}/api/ai/face_colour_analysis`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: "x", service: "product_matching", anonymousSessionId: "a", contractVersion: "v", payload: {} }) });
    check(wrong.status === 400, "an envelope for another service is refused");
    check((await fetch(`${BASE}/api/ai/make_me_rich`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status === 404, "an unknown service is 404");
    check((await fetch(`${BASE}/api/ai/face_colour_analysis`)).status === 405, "only POST is accepted");
    const live = await (await fetch(`${BASE}/api/ai`)).json();
    check(Array.isArray(live.live) && live.live.every((x) => x.billable === false), `the server lists only free services as live (${live.live?.map((x) => x.provider).join(", ") || "none"})`);
    check((await fetch(`${BASE}/api/ai/face_colour_analysis`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: "hi" })).status === 415, "only JSON is accepted");
    const tryon = await fetch(`${BASE}/api/tryon`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: "t", outfitId: "o", garmentIds: ["g"], person: { image: "data:image/jpeg;base64,AAAA", width: 720, height: 960, consentVersion: "tryon-server-2026-10-11" } }) });
    const t = await tryon.json();
    check(t.status === "disabled" && t.error?.code === "no_provider", "the try-on endpoint makes nothing (no provider)");
  });

  await scenario("P3-12c", "The page ships no provider key and no direct call to any AI, image or payment API", "node", async () => {
    const html = await (await fetch(`${BASE}/`)).text();
    const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
    const chunks = new Set(scripts);
    let code = "";
    for (const src of chunks) code += await (await fetch(new URL(src, BASE))).text();
    for (const m of code.matchAll(/["'](\/assets\/[^"']+\.js)["']/g)) if (!chunks.has(m[1])) code += await (await fetch(new URL(m[1], BASE))).text();
    check(code.length > 50_000, `read the shipped JavaScript (${Math.round(code.length / 1024)} KB)`);
    for (const [re, what] of FORBIDDEN) check(!re.test(code), `no ${what} in the page`);
    check(/\/api\/ai/.test(code) && /\/api\/tryon/.test(code), "live providers are reached only through this app's own server");
  });

  await scenario("P3-12d", "Style DNA, the looks and a try-on in one session send nothing to an AI service", "desktop", async (p) => {
    const calls = [];
    p.on("request", (r) => {
      const u = new URL(r.url());
      if ((u.pathname.startsWith("/api/ai/") || (u.pathname === "/api/ai" && r.method() !== "GET")) || u.pathname.startsWith("/api/tryon") || !["127.0.0.1", "localhost", "fonts.googleapis.com", "fonts.gstatic.com"].includes(u.hostname)) calls.push(`${r.method()} ${u.host}${u.pathname}`);
    });
    await p.goto(`${BASE}/dna/face?mode=light`);
    await p.waitForTimeout(600);
    await p.getByRole("radio", { name: /Use a sample/ }).first().click();
    await p.waitForTimeout(400);
    await H.button(p, "Looks right").click();
    await p.getByRole("radio", { name: "Slim" }).first().click();
    await p.waitForURL(/dna\/lifestyle/);
    await p.waitForTimeout(400);
    await p.getByRole("radio").first().click();
    await p.waitForURL(/dna\/inspiration/);
    await H.button(p, /Skip this|Build my Style DNA/).click();
    await p.waitForURL(/dna\/result/, { timeout: 10000 });
    await p.waitForTimeout(1500);
    await H.toResults(p, H.A);
    await H.button(p, /See it on me/).click();
    await p.waitForURL(/moment\/tryon/);
    await H.button(p, "Continue").click();
    await H.button(p, "I agree").click();
    const chooser = p.waitForEvent("filechooser");
    await p.getByRole("radio", { name: /Upload a photo/ }).first().click();
    await (await chooser).setFiles(await H.photoFile(p));
    await p.waitForFunction(() => document.querySelector("[data-tryon-step]")?.getAttribute("data-tryon-step") === "preview", null, { timeout: 8000 });
    await H.button(p, "Use this photo").click();
    await p.waitForFunction(() => document.querySelector("[data-tryon-step]")?.getAttribute("data-tryon-step") === "result", null, { timeout: 8000 });
    check(calls.length === 0, `no AI, image, retailer or payment request left the page (${calls.slice(0, 3).join(", ") || "none"})`);
  }, { premium: true });

  await scenario("P4-12e", "The live build hides test mode, says no paid provider is on, and logs page errors without personal details", "desktop", async (p) => {
    const h = await (await fetch(`${BASE}/api/health`)).json();
    check(h.ok && h.version && h.commit, `health answers (${h.version}, ${h.commit})`);
    check(h.ai.providersSet.length === 0 && !h.ai.billableAllowed && !h.tryOn.providerSet && !h.tryOn.billableAllowed, "no AI or try-on provider is on, paid calls are off");
    check((await fetch(`${BASE}/api/client-error`)).status === 405, "error reports are POST only");
    check((await fetch(`${BASE}/api/client-error`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "not json" })).status === 400, "a broken report is refused");
    await p.goto(`${BASE}/internal/analytics?mode=light`);
    await p.waitForTimeout(800);
    check(!/Analytics in this browser/.test(await H.body(p)) && new URL(p.url()).pathname === "/", "the test mode page is not in the live build (it leads home)");
    const sent = [];
    await p.route("**/api/client-error", async (route) => {
      sent.push(route.request().postData() ?? "");
      await route.fulfill({ status: 204 });
    });
    await p.evaluate(() => setTimeout(() => {
      const e = new TypeError("sam@example.com broke it");
      throw e;
    }, 0));
    await p.waitForTimeout(800);
    // The error was thrown on purpose; it is not a fault of the page.
    H.current.errors = H.current.errors.filter((m) => !/broke it/.test(m));
    check(sent.length === 1, "an uncaught error is reported once");
    const r = JSON.parse(sent[0] || "{}");
    check(r.name === "TypeError" && r.where === "window" && r.path === "/" && r.release, "the report has the error's name, where, path and release");
    check(!/sam@|broke/.test(sent[0] || ""), "and never the message");
  });
}
