/**
 * Guards for outfit pictures on the server, whatever provider makes them (server/ai.mjs calls these
 * around outfit_visualization):
 * - The same composition is answered from a cache (keyed by the page's cacheKey, which names the exact
 *   pieces, variants, model setup and provider), so it is never made, or paid for, twice.
 * - Each visitor has a daily ceiling of new pictures (VISUALIZATION_DAILY_CAP, default 20).
 * - A ledger counts requests, cache hits, refusals, failures and the estimated cost (a provider's
 *   costPerImageUsd), and each call is logged with its cost. Nothing about the person is logged.
 */
const KEEP_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 500;
const KEY = /^vis_[0-9a-f]{8}$/;

const cache = new Map();
const perVisitor = new Map();
export const ledger = { requests: 0, cacheHits: 0, refused: 0, failures: 0, costUsd: 0 };

export function resetVisuals() {
  cache.clear();
  perVisitor.clear();
  Object.assign(ledger, { requests: 0, cacheHits: 0, refused: 0, failures: 0, costUsd: 0 });
}

const dailyCap = () => {
  const n = Number(process.env.VISUALIZATION_DAILY_CAP);
  return Number.isFinite(n) && n >= 0 ? n : 20;
};

/** Before calling the provider: a cached answer, a refusal, or null to go ahead. */
export function beforeVisual(body, now = Date.now()) {
  const key = body?.payload?.spec?.cacheKey;
  if (typeof key === "string" && KEY.test(key)) {
    const hit = cache.get(key);
    if (hit && now - hit.at < KEEP_MS && hit.answer?.result?.outfitId === body.payload.outfitId) {
      ledger.cacheHits += 1;
      return { answer: { ...hit.answer, metadata: { ...(hit.answer.metadata ?? {}), cached: true, costUsd: 0 } } };
    }
  }
  const day = new Date(now).toISOString().slice(0, 10);
  const who = String(body?.anonymousSessionId ?? "");
  const seen = perVisitor.get(who);
  const count = seen && seen.day === day ? seen.count : 0;
  if (count >= dailyCap()) {
    ledger.refused += 1;
    return { answer: { status: "failed", error: { code: "rate_limited", message: "Enough pictures for today.", retryable: false } } };
  }
  perVisitor.set(who, { day, count: count + 1 });
  return null;
}

/** After the provider answers: checks the picture is for this outfit, records the cost, keeps it for the same composition. */
export function afterVisual(body, engine, out, now = Date.now()) {
  ledger.requests += 1;
  const costUsd = Number(engine?.costPerImageUsd) || 0;
  const ok = (out?.status === "succeeded" || out?.status === "partial") && out.result?.outfitId === body.payload.outfitId;
  if (!ok) {
    ledger.failures += 1;
    if (out?.status === "succeeded") return { status: "failed", error: { code: "validation_error", message: "The picture was for another outfit.", retryable: false } };
    return out;
  }
  ledger.costUsd = Math.round((ledger.costUsd + costUsd) * 10000) / 10000;
  const answer = { ...out, metadata: { ...(out.metadata ?? {}), costUsd } };
  const key = body.payload?.spec?.cacheKey;
  if (typeof key === "string" && KEY.test(key)) {
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
    cache.set(key, { at: now, answer });
  }
  console.log(`visual ${body.requestId} ${engine?.id ?? "unknown"} cost=${costUsd} total=${ledger.costUsd} requests=${ledger.requests} hits=${ledger.cacheHits}`);
  return answer;
}
