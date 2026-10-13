/**
 * A stand-in for Google's Gemini API, for tests only: the image provider (server/providers/gemini-image.mjs)
 * talks to it through GEMINI_API_BASE, so the whole picture pipeline runs without a key or any cost.
 *
 * - GET  /models                      a Pro image model and a Flash model
 * - POST /models/<image>:generateContent   a 768 x 1024 "photograph": a head, and each piece's own
 *   picture laid where it is worn (outer layer open over the base, trousers, shoes), on a beige wall.
 *   It records every request, so tests can see exactly which pictures and words were sent.
 * - POST /models/<flash>:generateContent   the checker: reads the outfit from its prompt and says what
 *   it sees, with boxes where the pieces were laid.
 * - POST /__mode  {"mode": "ok" | "missing_shoes" | "wrong_colour" | "billing" | "fail_once"} and GET /__log.
 */
import { createServer } from "node:http";
import sharp from "sharp";

const W = 768, H = 1024;
const BOX = { head: [40, 420, 150, 580], outer: [160, 300, 470, 700], base: [160, 430, 470, 570], top: [160, 330, 470, 670], bottom: [470, 360, 880, 640], shoes: [880, 340, 950, 660] };
const COLOURS = { black: "#1d1d1f", white: "#f4f2ee", grey: "#7c7f84", navy: "#1f2a44", blue: "#6f8fbf", beige: "#d8c6a5", brown: "#6b4430", green: "#5b6b3a", burgundy: "#5e1f2a" };

export const state = { mode: "ok", calls: [], judged: 0, made: 0 };

function regionOf(line) {
  if (/^- outer layer/.test(line)) return "outer";
  if (/^- base layer/.test(line)) return "base";
  if (/^- top/.test(line)) return "top";
  if (/^- trousers/.test(line)) return "bottom";
  if (/^- shoes/.test(line)) return "shoes";
  return null;
}

async function picture(parts) {
  const text = parts[0]?.text ?? "";
  const images = parts.filter((p) => p.inlineData).map((p) => Buffer.from(p.inlineData.data, "base64"));
  const layers = [];
  const lines = text.split("\n").filter((l) => l.startsWith("- "));
  const wear = { outer: 0, base: 1, top: 1, bottom: 2, shoes: 3 };
  const pieces = lines.map((l) => ({ l, region: regionOf(l), n: Number(/image (\d+)/.exec(l)?.[1] ?? 0) })).filter((p) => p.region && !(state.mode === "missing_shoes" && p.region === "shoes"));
  pieces.sort((a, b) => wear[a.region] - wear[b.region]);
  for (const p of pieces) {
    const [y0, x0, y1, x1] = BOX[p.region].map((v, i) => Math.round((v / 1000) * (i % 2 ? W : H)));
    const w = x1 - x0, h = y1 - y0;
    let tile;
    const colourWord = /\((\w+)\s/.exec(p.l)?.[1];
    if (state.mode === "wrong_colour") tile = await sharp({ create: { width: w, height: h, channels: 3, background: "#c43b2c" } }).png().toBuffer();
    else if (p.n && images[p.n - 1]) tile = await sharp(images[p.n - 1]).resize(w, h, { fit: "cover" }).png().toBuffer();
    else tile = await sharp({ create: { width: w, height: h, channels: 3, background: COLOURS[colourWord] ?? "#888888" } }).png().toBuffer();
    layers.push({ input: tile, left: x0, top: y0 });
  }
  const [hy0, hx0, hy1, hx1] = BOX.head;
  const head = await sharp({ create: { width: Math.round(((hx1 - hx0) / 1000) * W), height: Math.round(((hy1 - hy0) / 1000) * H), channels: 3, background: "#c99a7c" } }).png().toBuffer();
  layers.unshift({ input: head, left: Math.round((hx0 / 1000) * W), top: Math.round((hy0 / 1000) * H) });
  return sharp({ create: { width: W, height: H, channels: 3, background: "#e6d6bd" } }).composite(layers).jpeg({ quality: 85 }).toBuffer();
}

function judge(text) {
  const garments = text
    .split("\n")
    .filter((l) => l.startsWith("- id "))
    .map((l) => {
      const id = /- id ([^:]+):/.exec(l)[1];
      const colour = /colour (\w+)/.exec(l)?.[1] ?? "grey";
      const kind = /kind ([\w-]+)/.exec(l)?.[1] ?? "shirt";
      const layer = /worn as the (\w+) layer/.exec(l)?.[1];
      const region = layer ?? (/trousers|chinos|jeans/.test(kind) ? "bottom" : /shoe|boot|loafer|sneaker|oxford/.test(kind) ? "shoes" : "top");
      const missing = state.mode === "missing_shoes" && region === "shoes";
      return { id, worn: !missing, kind: kind.replace(/-/g, " "), colour: state.mode === "wrong_colour" ? "red" : colour, box: BOX[region] };
    });
  const shoes = state.mode !== "missing_shoes";
  return { oneManFullLength: true, headInFrame: true, shoesInFrame: shoes, sameManAsReference: true, plausibleAnatomy: true, severeDefects: [], extraClothing: [], garments };
}

const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

export function handler(req, res) {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", async () => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/__mode" && req.method === "POST") {
      state.mode = JSON.parse(raw || "{}").mode ?? "ok";
      return json(res, 200, { mode: state.mode });
    }
    if (url.pathname === "/__log") return json(res, 200, { made: state.made, judged: state.judged, calls: state.calls.slice(-20) });
    if (url.pathname === "/models") return json(res, 200, { models: [{ name: "models/gemini-3-pro-image-preview", supportedGenerationMethods: ["generateContent"] }, { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] }] });
    const m = /^\/models\/([^:]+):generateContent$/.exec(url.pathname);
    if (!m) return json(res, 404, { error: { message: "not found" } });
    if (state.mode === "billing") return json(res, 429, { error: { message: "Quota exceeded for metric generate_content_free_tier_requests, limit: 0", status: "RESOURCE_EXHAUSTED" } });
    const body = JSON.parse(raw);
    const parts = body.contents?.[0]?.parts ?? [];
    if (/image/.test(m[1])) {
      state.made += 1;
      state.calls.push({ model: m[1], text: parts[0]?.text ?? "", images: parts.filter((p) => p.inlineData).length, config: body.generationConfig });
      if (state.mode === "fail_once") {
        state.mode = "ok";
        return json(res, 503, { error: { message: "busy" } });
      }
      const img = await picture(parts);
      return json(res, 200, { candidates: [{ content: { parts: [{ text: "Here it is." }, { inlineData: { mimeType: "image/jpeg", data: img.toString("base64") } }] }, finishReason: "STOP" }] });
    }
    state.judged += 1;
    return json(res, 200, { candidates: [{ content: { parts: [{ text: JSON.stringify(judge(parts[0]?.text ?? "")) }] } }] });
  });
}

export function startFakeGemini(port = 4197) {
  const server = createServer(handler);
  return new Promise((done) => server.listen(port, "127.0.0.1", () => done(server)));
}
