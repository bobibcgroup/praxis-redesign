/**
 * POST /api/ai/<service>: where each AI service's real provider plugs in (the page side is
 * src/core/ai/http.ts; the contracts are src/core/ai/services.ts). The body is the request envelope;
 * the answer is a ProviderAnswer { status, result?, error?, metadata? }.
 *
 * A provider is a module in server/providers/<name>.mjs exporting `id`, `version`, `billable` and
 * `async run(request, { signal })`. Which module answers a service comes from AI_PROVIDER_<SERVICE>
 * (for example AI_PROVIDER_FACE_COLOUR_ANALYSIS=acme-colour). Nothing is set by default, so every
 * service answers "disabled" and nothing is charged. A billable provider also needs ALLOW_BILLABLE_AI=true.
 *
 * One free provider switches itself on: with GEMINI_API_KEY set, styling_explanation is answered by
 * gemini-free (server/providers/gemini-free.mjs), unless AI_PROVIDER_STYLING_EXPLANATION names another
 * provider or says "off". Likewise RETAIL_SHOPIFY_STORE switches on shopify-feed for product_matching
 * (real pieces from one store, for testing). GET /api/ai tells the page which services have a provider
 * that may run, and which of them only test browsers use.
 *
 * One paid provider is approved by its owner within a budget: with GEMINI_API_KEY set, outfit_visualization
 * is answered by gemini-image (server/providers/gemini-image.mjs), which runs only while the approved
 * spend lasts (server/visuals.mjs: OUTFIT_IMAGE_BUDGET_USD, OUTFIT_IMAGE_DAILY_USD).
 * AI_PROVIDER_OUTFIT_VISUALIZATION=off stops it at once.
 *
 * Bodies are held in memory for the call only and never logged: only the service, request id,
 * status and time taken are.
 */
import { pathToFileURL, fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { readBody } from "./tryon.mjs";
import { afterVisual, approval, beforeVisual } from "./visuals.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const AI_SERVICES = [
  "styling_recommendation",
  "styling_explanation",
  "outfit_visualization",
  "virtual_try_on",
  "face_colour_analysis",
  "body_fit_analysis",
  "garment_recognition",
  "product_matching",
  "inventory_pricing",
];
export const AI_TIMEOUT_MS = 40_000;

const err = (code, message, retryable) => ({ code, message, retryable });

/** Checks the envelope. Returns an error message, or null when it is complete. */
export function checkEnvelope(service, body) {
  if (!body || typeof body !== "object") return "not an object";
  if (body.service !== service) return "service does not match the address";
  if (typeof body.requestId !== "string" || !body.requestId) return "requestId missing";
  if (typeof body.anonymousSessionId !== "string" || !body.anonymousSessionId) return "anonymousSessionId missing";
  if (typeof body.contractVersion !== "string") return "contractVersion missing";
  if (!body.payload || typeof body.payload !== "object") return "payload missing";
  return null;
}

/** Free providers that switch on by themselves when their key is set: service -> [provider, key variable]. */
export const FREE_DEFAULTS = { styling_explanation: ["gemini-free", "GEMINI_API_KEY"], product_matching: ["shopify-feed", "RETAIL_SHOPIFY_STORE"] };

/**
 * Paid providers whose spend the owner approved, within the budget server/visuals.mjs enforces:
 * service -> [provider, key variable]. Tarek approved 10 to 25 USD of outfit pictures on 2026-10-12.
 */
export const APPROVED_DEFAULTS = { outfit_visualization: ["gemini-image", "GEMINI_API_KEY"] };

/** The provider named for a service, or the free default when its key is set. "off" switches it off. */
export function providerName(service, env = process.env) {
  const named = (env[`AI_PROVIDER_${service.toUpperCase()}`] ?? "").trim();
  if (named === "off") return "";
  if (named) return named;
  const free = FREE_DEFAULTS[service] ?? APPROVED_DEFAULTS[service];
  return free && (env[free[1]] ?? "").trim() ? free[0] : "";
}

const cache = new Map();
async function providerFor(service) {
  const name = providerName(service);
  if (!name || !/^[a-z0-9-]+$/.test(name)) return null;
  if (cache.has(name)) return cache.get(name);
  const file = join(HERE, "providers", `${name}.mjs`);
  if (!existsSync(file)) return null;
  const mod = await import(pathToFileURL(file).href);
  if (typeof mod.run !== "function") return null;
  cache.set(name, mod);
  return mod;
}

export async function handleAi(req, res, service) {
  const reply = (status, payload) => {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify(payload));
  };
  if (!AI_SERVICES.includes(service)) return reply(404, { status: "failed", error: err("not_connected", "No such service.", false) });
  if (!String(req.headers["content-type"] ?? "").startsWith("application/json")) return reply(415, { status: "failed", error: err("validation_error", "Send JSON.", false) });
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (e) {
    return reply(e?.code === "too_large" ? 413 : 400, { status: "failed", error: err("validation_error", "The request could not be read.", false) });
  }
  const problem = checkEnvelope(service, body);
  if (problem) return reply(400, { status: "failed", error: err("validation_error", problem, false) });

  const engine = await providerFor(service).catch(() => null);
  if (!engine) return reply(200, { status: "disabled", error: err("not_connected", "No provider is set up for this service.", false) });
  if (engine.billable && !engine.budgeted && process.env.ALLOW_BILLABLE_AI !== "true") return reply(200, { status: "disabled", error: err("billing_blocked", "Paid AI calls are switched off on the server.", false) });

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(engine.timeoutMs) || AI_TIMEOUT_MS);
  req.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  // Outfit pictures: the same composition comes from the cache, and each visitor has a daily ceiling.
  const visual = service === "outfit_visualization";
  let go = null;
  if (visual) {
    const fwd = req.headers["x-forwarded-for"];
    const address = (typeof fwd === "string" ? fwd.split(",")[0].trim() : "") || req.socket?.remoteAddress || "";
    const early = beforeVisual(body, engine, Date.now(), address);
    if (early.answer) {
      clearTimeout(timer);
      return reply(200, { ...early.answer, metadata: { ...(early.answer.metadata ?? {}), provider: engine.id, providerVersion: engine.version } });
    }
    go = early.go;
  }
  try {
    let out = await engine.run(body, { signal: controller.signal, ...(go ? { visual: go } : {}) });
    if (visual) out = afterVisual(body, engine, out, go);
    console.log(`ai ${service} ${body.requestId} ${out?.status ?? "unknown"} ${Date.now() - started}ms`);
    return reply(200, { ...out, metadata: { ...(out?.metadata ?? {}), provider: engine.id, providerVersion: engine.version } });
  } catch {
    const timedOut = controller.signal.aborted;
    // A call cut off mid-way may still have been charged: the most it could cost is counted.
    if (visual) afterVisual(body, engine, { status: "failed", metadata: { costUsd: timedOut ? (go?.hold ?? 0) : 0 } }, go);
    console.log(`ai ${service} ${body.requestId} ${timedOut ? "timed_out" : "failed"} ${Date.now() - started}ms`);
    return reply(timedOut ? 504 : 502, { status: "failed", error: err(timedOut ? "timeout" : "provider_error", "The provider did not answer.", true) });
  } finally {
    clearTimeout(timer);
  }
}

/** GET /api/ai: the services whose provider may run now, so the page only calls those. No keys, no names of people. */
export async function liveServices() {
  const live = [];
  for (const service of AI_SERVICES) {
    const engine = await providerFor(service).catch(() => null);
    if (!engine) continue;
    if (Array.isArray(engine.SERVICES) && !engine.SERVICES.includes(service)) continue;
    if (engine.billable && !engine.budgeted && process.env.ALLOW_BILLABLE_AI !== "true") continue;
    const testOnly = typeof engine.testOnly === "function" && engine.testOnly();
    // A budgeted provider is listed while its approved spend lasts; the page then may call it.
    const approved = engine.billable && engine.budgeted ? approval(engine).approved : undefined;
    if (approved === false) continue;
    live.push({ service, provider: engine.id, version: engine.version, billable: Boolean(engine.billable), ...(approved ? { approved: true } : {}), ...(testOnly ? { testOnly: true } : {}) });
  }
  return live;
}
