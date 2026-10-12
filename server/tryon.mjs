/**
 * POST /api/tryon: the one place a real try-on engine plugs in. The page sends the look and the
 * customer's photo here (src/core/adapters/tryonHttp.ts); this checks the request and hands it to the
 * provider named by TRYON_PROVIDER, a module in server/providers/<name>.mjs. Provider keys are read
 * from the server's environment by that module and never reach the page.
 *
 * Two switches, both off by default, so nothing is ever charged by accident:
 *   TRYON_PROVIDER=<name>        which provider module to use (none: every request answers "disabled")
 *   ALLOW_BILLABLE_IMAGES=true   allows a provider that costs money to be called at all
 * The page has its own pair (VITE_TRYON_ADAPTER=http, VITE_ALLOW_BILLABLE_IMAGES=true).
 *
 * The photo is held in memory for the call only: never written to disk, never logged. Only the
 * request id, the status and the time taken are logged.
 */
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
/** A 1280 px JPEG is well under 1 MB as a data URL; anything far larger is refused before it is read. */
export const MAX_BODY_BYTES = 8 * 1024 * 1024;
export const PROVIDER_TIMEOUT_MS = 40_000;
const IMAGE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

function disabled(body, reason) {
  return {
    imageId: `img_${Date.now().toString(36)}`,
    outfitId: body?.outfitId ?? "",
    kind: "try_on",
    sourceGarmentIds: Array.isArray(body?.garmentIds) ? body.garmentIds : [],
    provider: "none",
    modelVersion: "none",
    status: "disabled",
    error: { code: reason, message: "No try-on engine is switched on.", retryable: false },
    createdAt: new Date().toISOString(),
    retention: { deletable: true },
  };
}

function failed(body, code, message, retryable) {
  return { ...disabled(body, code), status: "failed", error: { code, message, retryable } };
}

/** Checks the request. Returns an error code, or null when it is complete. */
export function checkTryOnBody(body) {
  if (!body || typeof body !== "object") return "invalid_request";
  if (typeof body.requestId !== "string" || !body.requestId) return "invalid_request";
  if (typeof body.outfitId !== "string" || !body.outfitId) return "outfit_missing";
  if (!Array.isArray(body.garmentIds) || body.garmentIds.length === 0 || !body.garmentIds.every((g) => typeof g === "string")) return "garments_missing";
  const person = body.person;
  if (!person || typeof person.image !== "string" || !IMAGE.test(person.image)) return "photo_missing";
  if (typeof person.consentVersion !== "string" || !person.consentVersion.startsWith("tryon-server-")) return "consent_missing";
  return null;
}

let loaded = null;
/** The provider module, loaded once. Each exports `id`, `version`, `billable` and `async tryOn(request, { signal })`. */
async function provider() {
  const name = (process.env.TRYON_PROVIDER ?? "").trim();
  if (!name || !/^[a-z0-9-]+$/.test(name)) return null;
  if (loaded?.name === name) return loaded.module;
  const file = join(HERE, "providers", `${name}.mjs`);
  if (!existsSync(file)) return null;
  loaded = { name, module: await import(pathToFileURL(file).href) };
  return loaded.module;
}

export function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("too large"), { code: "too_large" }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** Answers one try-on request. Always JSON in the GeneratedImage shape (src/core/vision.ts). */
export async function handleTryOn(req, res) {
  const reply = (status, payload) => {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify(payload));
  };
  if (!String(req.headers["content-type"] ?? "").startsWith("application/json")) return reply(415, failed(null, "unsupported_type", "Send JSON.", false));
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (e) {
    if (e?.code === "too_large") return reply(413, failed(null, "too_large", "The photo is too large.", false));
    return reply(400, failed(null, "invalid_request", "The request could not be read.", false));
  }
  const problem = checkTryOnBody(body);
  if (problem) return reply(400, failed(body, problem, "The try-on request is incomplete.", false));

  const engine = await provider().catch(() => null);
  if (!engine) return reply(200, disabled(body, "no_provider"));
  if (engine.billable && process.env.ALLOW_BILLABLE_IMAGES !== "true") return reply(200, disabled(body, "billable_off"));

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  req.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  try {
    const out = await engine.tryOn(
      { requestId: body.requestId, outfitId: body.outfitId, garmentIds: body.garmentIds, person: { image: body.person.image, width: body.person.width, height: body.person.height } },
      { signal: controller.signal },
    );
    console.log(`tryon ${body.requestId} ${out?.status ?? "unknown"} ${Date.now() - started}ms`);
    return reply(200, { ...out, outfitId: body.outfitId, kind: "try_on", provider: engine.id, modelVersion: out?.modelVersion ?? engine.version });
  } catch {
    console.log(`tryon ${body.requestId} failed ${Date.now() - started}ms`);
    const timedOut = controller.signal.aborted;
    return reply(timedOut ? 504 : 502, failed(body, timedOut ? "provider_timeout" : "provider_error", "The try-on service did not answer.", true));
  } finally {
    clearTimeout(timer);
  }
}
