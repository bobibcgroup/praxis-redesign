/**
 * Gemini on Google's free tier, for the stylist's words only (styling_explanation). The rules engine
 * still chooses the three looks from the photographed library; Gemini writes, for each look, the one
 * line tying it to the brief and the stylist's note, in Praxis's voice.
 *
 * What is sent: the customer's answers (occasion, place, time, feel, budget), what their Style DNA says
 * in words, the name and colour of a piece they own, and each look's name and pieces. Never a photo,
 * an email, a name or an id: Google may use free-tier requests to improve its products.
 *
 * Needs GEMINI_API_KEY (a free key from https://aistudio.google.com/apikey, on a project without
 * billing). GEMINI_MODEL picks the model; without it the provider asks Google which models the key
 * can use and takes the newest Flash Lite (then Flash), since model names are retired over time.
 * Not billable: on a project
 * without billing Google refuses rather than charges when the free limits are reached, and the page
 * then keeps the rules engine's words.
 */
export const id = "gemini-free";
export const billable = false;
/** The model named in GEMINI_MODEL, or "auto": the newest Flash Lite the key can use (resolveModel). */
export const MODEL = (process.env.GEMINI_MODEL ?? "").trim() || "auto";
export const version = MODEL;
export const SERVICES = ["styling_explanation"];

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

const OCCASION = { DINNER: "dinner", WORK: "work", DATE: "a date", WEDDING: "a wedding", PARTY: "a party" };
const TIME = { SUNRISE: "morning", DAY: "daytime", SUNSET: "early evening", NIGHT: "night" };
const VIBE = { SAFE: "classic, nothing that could go wrong", SHARP: "sharp, a step up", RELAXED: "relaxed, easy" };
const BUDGET = { SENSIBLE: "sensible", ELEVATED: "elevated", OPEN: "open" };
const WEEK = { OFFICE: "mostly office", SOCIAL: "mostly social", CASUAL: "mostly casual", MIXED: "a mix" };

const VOICE = [
  "You are Praxis, a personal stylist for men, writing to one customer in the first person.",
  "Warm, precise and brief, like a good tailor. Plain words. No exclamation marks.",
  'Say "pieces", never "products". Say "Style DNA", never "DNA" on its own.',
  "Never use dashes of any kind (no hyphen between words, no en dash, no em dash). Use commas or full stops.",
  "Never mention AI, models, algorithms, data or analysis. Never use marketing words like elevate, curated, effortless, game changer, must have.",
  "Never invent pieces, brands, prices, stock or sizes. Only talk about the pieces listed for each look.",
].join(" ");

/** The brief in words, built from known values only: nothing free text reaches the prompt unlabelled. */
export function briefOf(request) {
  const r = request ?? {};
  const lines = [
    `Occasion: ${OCCASION[r.occasion] ?? "an occasion"}.`,
    r.venue?.label ? `Place: ${String(r.venue.label).slice(0, 40)}.` : null,
    `Time: ${TIME[r.timeOfDay] ?? "not given"}.`,
    `Feel they asked for: ${VIBE[r.preferredVibe] ?? "not given"}.`,
    `Budget for the whole look: ${BUDGET[r.budget?.band] ?? "not given"}.`,
  ];
  const p = r.styleProfile;
  if (p) {
    const dna = [
      p.undertone ? `${p.undertone.value} undertone` : null,
      p.contrast ? `${p.contrast.value} contrast` : null,
      p.fit ? `prefers a ${String(p.fit.value).toLowerCase()} fit` : null,
      p.week ? `week is ${WEEK[p.week.value] ?? "a mix"}` : null,
      Array.isArray(p.tastes) && p.tastes.length ? `likes ${p.tastes.slice(0, 4).map((t) => String(t).toLowerCase().slice(0, 24)).join(", ")}` : null,
    ].filter(Boolean);
    if (dna.length) lines.push(`Their Style DNA: ${dna.join("; ")}.`);
  }
  const owned = Array.isArray(r.wardrobeItems) ? r.wardrobeItems.filter((w) => w && w.source !== "sample") : [];
  if (owned.length) lines.push(`They are wearing a piece they own: ${owned.map((w) => (w.colour && !String(w.label).toLowerCase().includes(String(w.colour).toLowerCase()) ? `${w.colour} ${w.label}` : String(w.label)).slice(0, 60)).join("; ")}.`);
  return lines.filter(Boolean).join("\n");
}

export function looksOf(looks) {
  return (Array.isArray(looks) ? looks : []).slice(0, 3).map((l) => ({
    outfitId: String(l.outfitId),
    text: `Look ${String(l.outfitId)} (${String(l.role)}), "${String(l.title).slice(0, 40)}": ${(Array.isArray(l.pieces) ? l.pieces : [])
      .slice(0, 6)
      .map((p) => `${String(p.name).slice(0, 60)}${p.owned ? " (theirs)" : ""}`)
      .join(", ")}.`,
  }));
}

export function promptFor(payload) {
  const looks = looksOf(payload.looks);
  return [
    "The customer's brief:",
    briefOf(payload.request),
    "",
    "The three looks I chose for them:",
    ...looks.map((l) => l.text),
    "",
    "For each look write:",
    "summary: one sentence, at most 110 characters, tying the look to their brief (the occasion, place, time and feel).",
    "note: one or two short sentences, at most 140 characters, on why these pieces work together, as a stylist would say it.",
    "Use each look's id exactly as given.",
  ].join("\n");
}

const SCHEMA = {
  type: "OBJECT",
  properties: {
    looks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { outfitId: { type: "STRING" }, summary: { type: "STRING" }, note: { type: "STRING" } },
        required: ["outfitId", "summary", "note"],
      },
    },
  },
  required: ["looks"],
};

/**
 * The model to call. A named GEMINI_MODEL is used as it is. Otherwise Google's list of models for this
 * key is read once, and the newest stable Flash Lite that can generate text is taken (Flash if there is
 * no Lite). Previews, experiments and audio, image or live models are left out.
 */
let resolved = null;
export function resetModel() {
  resolved = null;
}
export function pickModel(models) {
  const usable = (Array.isArray(models) ? models : [])
    .filter((m) => Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"))
    .map((m) => String(m.name ?? "").replace(/^models\//, ""))
    .filter((n) => /^gemini-/.test(n) && /flash/.test(n) && !/preview|exp|tts|image|live|audio|thinking|embedding|\d{3}$/.test(n));
  const rank = (n) => {
    const v = Number(/^gemini-(\d+(?:\.\d+)?)/.exec(n)?.[1] ?? 0);
    return (/lite/.test(n) ? 1000 : 0) + (/latest/.test(n) ? 500 : 0) + v;
  };
  return usable.sort((a, b) => rank(b) - rank(a))[0] ?? null;
}
export function resolveModel(key, fetcher = fetch) {
  if (MODEL !== "auto") return Promise.resolve(MODEL);
  if (!resolved) {
    resolved = (async () => {
      const res = await fetcher(`${ENDPOINT}?pageSize=200`, { headers: { "x-goog-api-key": key } });
      if (!res.ok) throw new Error(`Gemini listed models with ${res.status}.`);
      const name = pickModel((await res.json())?.models);
      if (!name) throw new Error("No Gemini Flash model is available to this key.");
      return name;
    })();
    resolved.catch(() => (resolved = null));
  }
  return resolved;
}

/** Google's own reason for a refusal, without anything from the request. */
async function reasonOf(res) {
  try {
    const body = await res.json();
    return String(body?.error?.message ?? "").slice(0, 160);
  } catch {
    return "";
  }
}

/** Words that break the voice rules. A line with any of them is dropped; the rules engine's words stand. */
const BANNED = /[‐-―−]|\s-\s|\w-\w|\b(ai|a\.i\.|artificial|algorithm|model|data|analysis|products?|curated|effortless(ly)?|elevate[sd]?|must[ -]have|game[ -]changer)\b|!|(?<!style )\bdna\b/i;

export function cleanLine(text, max) {
  if (typeof text !== "string") return null;
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 12 || t.length > max || BANNED.test(t)) return null;
  return /[.?]$/.test(t) ? t : `${t}.`;
}

/** Keeps only lines for the looks asked about that pass the voice rules. */
export function cleanLooks(raw, asked) {
  const ids = new Set(asked.map((l) => String(l.outfitId)));
  const out = [];
  for (const l of Array.isArray(raw?.looks) ? raw.looks : []) {
    if (!l || !ids.has(String(l.outfitId)) || out.some((o) => o.outfitId === String(l.outfitId))) continue;
    const summary = cleanLine(l.summary, 140);
    const note = cleanLine(l.note, 180);
    if (summary && note) out.push({ outfitId: String(l.outfitId), summary, note });
  }
  return out;
}

export async function run(request, { signal, fetcher = fetch } = {}) {
  const key = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!key) return { status: "disabled", error: { code: "not_connected", message: "No Gemini key is set on the server.", retryable: false } };
  if (request?.service !== "styling_explanation") return { status: "disabled", error: { code: "not_connected", message: "Gemini answers styling explanations only.", retryable: false } };
  const payload = request.payload ?? {};
  // Belt and braces: nothing that looks like a picture ever leaves for a free tier.
  if (/data:image\/|blob:/.test(JSON.stringify(payload))) return { status: "failed", error: { code: "validation_error", message: "Photos are never sent to Gemini.", retryable: false } };
  const asked = Array.isArray(payload.looks) ? payload.looks.slice(0, 3) : [];
  if (!asked.length) return { status: "failed", error: { code: "validation_error", message: "No looks to describe.", retryable: false } };

  let model;
  try {
    model = await resolveModel(key, fetcher);
  } catch (e) {
    return { status: "failed", error: { code: "provider_error", message: String(e?.message ?? "Gemini models could not be listed."), retryable: false } };
  }
  const ask = (generationConfig) =>
    fetcher(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: VOICE }] },
        contents: [{ role: "user", parts: [{ text: promptFor(payload) }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.6, ...generationConfig },
      }),
    });
  // No thinking keeps it quick; a model that refuses that setting is asked again with its own default.
  let res = await ask({ maxOutputTokens: 700, thinkingConfig: { thinkingBudget: 0 } });
  if (res.status === 400) res = await ask({ maxOutputTokens: 4000 });
  if (res.status === 429) return { status: "failed", error: { code: "provider_error", message: "The free Gemini limit is reached for now.", retryable: false } };
  if (!res.ok) {
    // A retired model name: ask for the list again next time.
    if (res.status === 404) resetModel();
    const why = await reasonOf(res);
    return { status: "failed", error: { code: "provider_error", message: `Gemini answered ${res.status}${why ? `: ${why}` : "."}`, retryable: res.status >= 500 } };
  }
  let looks = [];
  try {
    const body = await res.json();
    const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    looks = cleanLooks(JSON.parse(text), asked);
  } catch {
    return { status: "failed", error: { code: "provider_error", message: "Gemini's answer could not be read.", retryable: true } };
  }
  if (!looks.length) return { status: "empty", metadata: { model } };
  const first = looks.find((l) => l.outfitId === String(payload.outfitId)) ?? looks[0];
  return {
    status: looks.length === asked.length ? "succeeded" : "partial",
    result: { outfitId: first.outfitId, summary: first.summary, factors: [], source: "model", looks },
    metadata: { model, looks: looks.length },
  };
}
