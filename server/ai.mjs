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
 * Bodies are held in memory for the call only and never logged: only the service, request id,
 * status and time taken are.
 */
import { pathToFileURL, fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { readBody } from "./tryon.mjs";

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

const cache = new Map();
async function providerFor(service) {
  const name = (process.env[`AI_PROVIDER_${service.toUpperCase()}`] ?? "").trim();
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
  if (engine.billable && process.env.ALLOW_BILLABLE_AI !== "true") return reply(200, { status: "disabled", error: err("billing_blocked", "Paid AI calls are switched off on the server.", false) });

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  req.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  try {
    const out = await engine.run(body, { signal: controller.signal });
    console.log(`ai ${service} ${body.requestId} ${out?.status ?? "unknown"} ${Date.now() - started}ms`);
    return reply(200, { ...out, metadata: { ...(out?.metadata ?? {}), provider: engine.id, providerVersion: engine.version } });
  } catch {
    const timedOut = controller.signal.aborted;
    console.log(`ai ${service} ${body.requestId} ${timedOut ? "timed_out" : "failed"} ${Date.now() - started}ms`);
    return reply(timedOut ? 504 : 502, { status: "failed", error: err(timedOut ? "timeout" : "provider_error", "The provider did not answer.", true) });
  } finally {
    clearTimeout(timer);
  }
}
