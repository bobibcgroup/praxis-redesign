/**
 * The homepage film: a phone on a travertine table in warm window light. Its screen shows the real
 * app (captured by capture.mjs): the occasions, a light tap on Dinner, the build, the three dinner
 * looks. Then the three looks leave the screen as prints, rise along curved paths, gain their
 * shadows and settle as an editorial set above the table; the sharper one comes forward a little,
 * and all three go back into the screen. The camera closes in on Style DNA: Slim is chosen, then two
 * tastes, and the saved profile's colours lift off the screen as cloth swatches and settle back.
 * The screen returns to the occasions so the loop has no cut.
 *
 * Everything is a function of time: window.seek(t) draws the frame at t seconds, so render.mjs can
 * step through it frame by frame. Units are centimetres; the table is y = 0.
 *
 * ?layout=desktop (6:5) or ?layout=mobile (4:5). ?t=4.5 shows one frame for checking in a browser.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const params = new URLSearchParams(location.search);
const LAYOUT = params.get("layout") === "mobile" ? "mobile" : "desktop";
const SIZE = LAYOUT === "mobile" ? { w: 800, h: 1000 } : { w: 1200, h: 1000 };
const DURATION = 13.5;

/* ------------------------------------------------------------------ timing */

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const span = (t, a, b) => clamp((t - a) / (b - a));
const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const outQuint = (x) => 1 - Math.pow(1 - x, 5);
const inOutSine = (x) => -(Math.cos(Math.PI * x) - 1) / 2;
/** Eased progress between two times. */
const ease = (t, a, b, fn = inOut) => fn(span(t, a, b));

/** The beats, in seconds. Roughly four are the looks and four Style DNA. */
const T = {
  tap: 1.05, // Dinner is touched
  chosen: 1.12, // and marked
  toBuild: [1.55, 1.9],
  toResults: [3.0, 3.3],
  pullBack: [2.5, 5.0], // the camera leaves the screen for the room
  rise: [3.35, 5.15], // the prints leave the screen (staggered within)
  forward: [5.75, 6.35], // the sharper look comes forward
  back: [6.95, 7.45], // and settles back
  home: [7.4, 8.45], // the prints go back into the screen
  closeIn: [7.35, 9.0], // the camera returns to the screen
  toFit: [8.3, 8.65], // Style DNA: how do you like your clothes to fit?
  slim: 9.3, // Slim is touched
  slimChosen: 9.37,
  toTaste: [9.65, 9.95], // which of these feel most like you?
  taste: [10.25, 10.6], // Quiet luxury, then Classic tailored
  toProfile: [10.95, 11.25], // the saved Style DNA
  lift: [11.4, 12.05], // its colours lift off the screen
  settle: [12.4, 12.95], // and go back
  toHome: [13.05, 13.35], // the occasions again, where the loop began
};

/* ------------------------------------------------------------------ renderer */

const canvas = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.setSize(SIZE.w, SIZE.h, true);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#2a2017");
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.3;

const camera = new THREE.PerspectiveCamera(30, SIZE.w / SIZE.h, 1, 600);

/* ------------------------------------------------------------------ helpers */

const loader = new THREE.TextureLoader();
const load = (url) =>
  new Promise((resolve, reject) =>
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        resolve(tex);
      },
      undefined,
      reject,
    ),
  );
const image = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
const makeCanvas = (w, h) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")];
};
const canvasTexture = (c) => {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
};
/** A seeded random, so every render draws the same stone and plaster. */
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function roundedShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** A flat rounded rectangle lying face up, with 0..1 UVs (v = 1 at the far edge). */
function flatRounded(w, h, r) {
  const g = new THREE.ShapeGeometry(roundedShape(w, h, r), 24);
  const uv = g.attributes.uv;
  const pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  g.rotateX(-Math.PI / 2);
  return g;
}

/* ------------------------------------------------------------------ the room */

/** Draws at a small size and scales up: a cheap, even blur (canvas filters are very slow without a GPU). */
function soft(w, h, k, paint) {
  const [small, sctx2] = makeCanvas(Math.round(w / k), Math.round(h / k));
  sctx2.scale(1 / k, 1 / k);
  paint(sctx2);
  const [c, ctx] = makeCanvas(w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, 0, 0, w, h);
  return [c, ctx];
}

/** Travertine: warm cream with soft horizontal veins and pores, a little lighter where the window falls. */
function travertine() {
  const [c, ctx] = soft(2048, 2048, 4, (ctx) => {
    ctx.fillStyle = "#dcc7a8";
    ctx.fillRect(0, 0, 2048, 2048);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = rand() > 0.5 ? `rgba(240,226,204,${rand() * 0.35})` : `rgba(170,140,104,${rand() * 0.18})`;
      ctx.beginPath();
      ctx.ellipse(rand() * 2048, rand() * 2048, 200 + rand() * 500, 80 + rand() * 200, rand() * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 70; i++) {
      const y = rand() * 2048;
      const h = 2 + rand() * 14;
      ctx.fillStyle = rand() > 0.5 ? `rgba(250,240,224,${0.04 + rand() * 0.08})` : `rgba(150,118,84,${0.03 + rand() * 0.06})`;
      ctx.beginPath();
      ctx.moveTo(-50, y);
      let x = -50;
      let yy = y;
      while (x < 2100) {
        x += 60 + rand() * 120;
        yy += (rand() - 0.5) * 34;
        ctx.lineTo(x, yy);
      }
      ctx.lineTo(2100, yy + h);
      ctx.lineTo(-50, y + h);
      ctx.fill();
    }
  });
  for (let i = 0; i < 1400; i++) {
    const w = 1 + rand() * 5;
    ctx.fillStyle = `rgba(140,108,74,${0.05 + rand() * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(rand() * 2048, rand() * 2048, w, w * (0.3 + rand() * 0.3), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.6, 1.6);
  return tex;
}

/** Limewashed plaster with the soft shadow of an arched window on it, already out of focus. */
function plaster() {
  const [c] = soft(1600, 1000, 16, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 1600, 0);
    g.addColorStop(0, "#c9ad8a");
    g.addColorStop(0.55, "#dcc4a3");
    g.addColorStop(1, "#cdb08c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1600, 1000);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = rand() > 0.5 ? `rgba(255,240,215,${rand() * 0.12})` : `rgba(120,88,58,${rand() * 0.08})`;
      ctx.beginPath();
      ctx.ellipse(rand() * 1600, rand() * 1000, 40 + rand() * 160, 30 + rand() * 120, rand() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // The window's light: an arch with mullions, falling across the wall from the left.
    ctx.save();
    ctx.translate(560, 120);
    ctx.transform(1, 0, -0.35, 1, 0, 0);
    ctx.fillStyle = "rgba(255,236,204,0.5)";
    ctx.beginPath();
    ctx.moveTo(0, 820);
    ctx.lineTo(0, 210);
    ctx.arc(210, 210, 210, Math.PI, 0);
    ctx.lineTo(420, 820);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(170,132,96,0.55)";
    ctx.fillRect(196, 0, 28, 820);
    ctx.fillRect(0, 420, 420, 26);
    ctx.restore();
  });
  return canvasTexture(c);
}

/** The light through the window, as the key light's projection: panes, mullions and soft edges. */
function windowGobo() {
  const [c] = soft(512, 512, 8, (ctx) => {
    ctx.fillStyle = "#4a4a4a";
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = "#fff";
    const pane = (x, y, w, h) => ctx.fillRect(x, y, w, h);
    pane(40, 20, 210, 225);
    pane(262, 20, 210, 225);
    pane(40, 257, 210, 235);
    pane(262, 257, 210, 235);
  });
  return canvasTexture(c);
}

/** A soft shadow: a blurred rounded rectangle, dark in the middle. */
function softShadow() {
  const [c] = soft(256, 512, 16, (ctx) => {
    ctx.fillStyle = "rgba(0,0,0,1)";
    roundedRect(ctx, 48, 48, 160, 416, 30);
    ctx.fill();
  });
  return new THREE.CanvasTexture(c);
}

/* ------------------------------------------------------------------ the phone */

// iPhone proportions, in centimetres: 71.6 x 147.6 x 7.8 mm, a 6.1 inch screen.
const PHONE = { w: 7.16, l: 14.76, t: 0.78, r: 1.08, edge: 0.13 };
const SCREEN = { w: 6.6, l: 6.6 * (844 / 390), r: 0.86 };
const SCREEN_PX = { w: 1170, h: 2532, pt: 3 };

function phoneBody() {
  const { w, l, t, r, edge } = PHONE;
  const geo = new THREE.ExtrudeGeometry(roundedShape(w - edge * 2, l - edge * 2, r - edge), {
    depth: t - edge * 2,
    bevelEnabled: true,
    bevelThickness: edge,
    bevelSize: edge,
    bevelSegments: 8,
    curveSegments: 48,
  });
  geo.translate(0, 0, -(t - edge * 2) / 2);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

const titanium = new THREE.MeshPhysicalMaterial({
  color: "#cdbca6",
  metalness: 1,
  roughness: 0.3,
  clearcoat: 0.4,
  clearcoatRoughness: 0.2,
  envMapIntensity: 1.25,
});
const glassBlack = new THREE.MeshPhysicalMaterial({ color: "#050403", roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.9 });

/* ------------------------------------------------------------------ the screen */

const [screenCanvas, sctx] = makeCanvas(SCREEN_PX.w, SCREEN_PX.h);
let screenTex;
const shots = {};
let layoutInfo;
let screenKey = "";

function statusBar(ctx) {
  const pt = SCREEN_PX.pt;
  ctx.fillStyle = "#efe2cc";
  ctx.fillRect(0, 0, SCREEN_PX.w, 47 * pt);
  ctx.fillStyle = "#1e1914";
  ctx.font = `600 ${17 * pt}px Geist`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText("9:41", 64 * pt, 24 * pt);
  // signal
  for (let i = 0; i < 4; i++) {
    roundedRect(ctx, (293 + i * 5.2) * pt, (28.5 - 3.2 - i * 2.2) * pt, 3.2 * pt, (3.2 + i * 2.2) * pt, 0.8 * pt);
    ctx.fill();
  }
  // wifi
  ctx.save();
  ctx.translate(325.5 * pt, 29.5 * pt);
  ctx.lineCap = "round";
  ctx.strokeStyle = "#1e1914";
  for (const [rr, lw] of [
    [10.5, 2.4],
    [6.4, 2.4],
  ]) {
    ctx.lineWidth = lw * pt;
    ctx.beginPath();
    ctx.arc(0, 0, rr * pt, Math.PI * 1.25, Math.PI * 1.75);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, -1.2 * pt, 1.8 * pt, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // battery
  ctx.strokeStyle = "rgba(30,25,20,0.45)";
  ctx.lineWidth = 1 * pt;
  roundedRect(ctx, 342 * pt, 18.5 * pt, 25 * pt, 12 * pt, 3.6 * pt);
  ctx.stroke();
  roundedRect(ctx, 344 * pt, 20.5 * pt, 19 * pt, 8 * pt, 2 * pt);
  ctx.fill();
  ctx.fillStyle = "rgba(30,25,20,0.45)";
  roundedRect(ctx, 368 * pt, 22.5 * pt, 1.6 * pt, 4 * pt, 0.8 * pt);
  ctx.fill();
  // the island
  ctx.fillStyle = "#000";
  roundedRect(ctx, (195 - 63) * pt, 11 * pt, 126 * pt, 37 * pt, 18.5 * pt);
  ctx.fill();
}

function drawPage(img, alpha = 1) {
  if (!img || alpha <= 0) return;
  sctx.globalAlpha = alpha;
  sctx.drawImage(img, 0, 47 * SCREEN_PX.pt, SCREEN_PX.w, (844 - 47) * SCREEN_PX.pt);
  sctx.globalAlpha = 1;
}

/** The build's working line moves along its track, as it does in the app. */
function buildLine(t, alpha) {
  if (alpha <= 0) return;
  const pt = SCREEN_PX.pt;
  const y = (47 + 266) * pt;
  const x0 = 150 * pt;
  const x1 = 240 * pt;
  sctx.globalAlpha = alpha;
  sctx.fillStyle = "rgb(212,191,159)";
  sctx.fillRect(x0, y, x1 - x0, 2 * pt);
  const seg = 24 * pt;
  const p = ((t - T.toBuild[0]) / 0.9) % 1;
  const x = lerp(x0 - seg, x1, inOutSine(p));
  sctx.save();
  sctx.beginPath();
  sctx.rect(x0, y, x1 - x0, 2 * pt);
  sctx.clip();
  sctx.fillStyle = "rgb(44,37,29)";
  sctx.fillRect(x, y, seg, 2 * pt);
  sctx.restore();
  sctx.globalAlpha = 1;
}

/** A light touch: the place under the finger brightens softly and lets go. No finger is drawn. */
function touch(t, at, b) {
  const k = span(t, at - 0.04, at + 0.34);
  if (k <= 0 || k >= 1) return;
  const pt = SCREEN_PX.pt;
  const cx = (b.x + b.width * 0.48) * pt;
  const cy = (47 + b.y + b.height * 0.55) * pt;
  const rr = lerp(20, 34, outQuint(k)) * pt;
  const a = 0.16 * Math.sin(Math.PI * Math.min(1, k * 1.4));
  const g = sctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
  g.addColorStop(0, `rgba(255,248,236,${a * 1.6})`);
  g.addColorStop(1, "rgba(255,248,236,0)");
  sctx.fillStyle = g;
  sctx.beginPath();
  sctx.arc(cx, cy, rr, 0, Math.PI * 2);
  sctx.fill();
}

/** The screen at time t: one or two of the captured pages, crossfading, and any touch in progress. */
function screenLayers(t) {
  const fade = (from, to, [a, b]) => {
    const k = span(t, a, b);
    return k <= 0 ? [[from, 1]] : k >= 1 ? [[to, 1]] : [[from, 1], [to, inOut(k)]];
  };
  const L = layoutInfo;
  if (t < T.toBuild[0]) return { layers: [[t < T.chosen ? "home" : "chosen", 1]], touch: [T.tap, L.dinner] };
  if (t < T.toResults[0]) return { layers: fade("chosen", "build", T.toBuild), build: span(t, ...T.toBuild) };
  if (t < T.toFit[0]) return { layers: fade("build", "results", T.toResults), build: 1 - span(t, ...T.toResults) };
  if (t < T.toTaste[0]) return { layers: t < T.toFit[1] ? fade("results", "fit", T.toFit) : [[t < T.slimChosen ? "fit" : "fitSlim", 1]], touch: [T.slim, L.slim] };
  if (t < T.toProfile[0]) {
    const [a, b] = T.taste;
    const page = t < a + 0.07 ? "taste" : t < b + 0.07 ? "taste1" : "taste2";
    const prev = { taste: "fitSlim", taste1: "taste", taste2: "taste1" }[page];
    const since = page === "taste" ? T.toTaste : page === "taste1" ? [a + 0.07, a + 0.27] : [b + 0.07, b + 0.27];
    return { layers: fade(prev, page, since), touch: t < b - 0.1 ? [a, L.tastes[0]] : [b, L.tastes[1]] };
  }
  if (t < T.toHome[0]) return { layers: fade("taste2", "profile", T.toProfile) };
  return { layers: fade("profile", "home", T.toHome) };
}

function drawScreen(t) {
  const s = screenLayers(t);
  const touching = s.touch && t > s.touch[0] - 0.05 && t < s.touch[0] + 0.35;
  const key = [s.layers.map(([n, a]) => `${n}:${a.toFixed(3)}`).join(","), s.build ? t.toFixed(3) : "", touching ? t.toFixed(3) : ""].join("|");
  if (key === screenKey) return;
  screenKey = key;

  sctx.fillStyle = "#efe2cc";
  sctx.fillRect(0, 0, SCREEN_PX.w, SCREEN_PX.h);
  for (const [name, alpha] of s.layers) drawPage(shots[name], alpha);
  if (s.build) buildLine(t, inOut(s.build));
  if (touching) touch(t, ...s.touch);
  statusBar(sctx);
  // The home indicator.
  sctx.fillStyle = "rgba(20,16,12,0.85)";
  roundedRect(sctx, (195 - 67) * SCREEN_PX.pt, 831 * SCREEN_PX.pt, 134 * SCREEN_PX.pt, 5 * SCREEN_PX.pt, 2.5 * SCREEN_PX.pt);
  sctx.fill();
  screenTex.needsUpdate = true;
}

/** Where a point on the app's page (in points) sits on the phone, in the phone's own space. */
function screenPoint(x, y) {
  return new THREE.Vector3((x / 390 - 0.5) * SCREEN.w, PHONE.t / 2 + 0.012, (y / 844 - 0.5) * SCREEN.l);
}

/* ------------------------------------------------------------------ the prints */

// Left to right on the table: classic, sharper, relaxed. `thumb` is their place on the results screen.
const LOOKS = [
  { id: "classic", label: "Classic", title: "Polished Casual", photo: "/images/dinner_safest_01.jpg", thumb: 1 },
  { id: "sharper", label: "Sharper", title: "Elevated Dinner", photo: "/images/dinner_sharper_01.jpg", thumb: 0, pick: true },
  { id: "relaxed", label: "Relaxed", title: "Relaxed Clean", photo: "/images/dinner_relaxed_01.jpg", thumb: 2 },
];
const CARD = { w: 8.2, h: 8.2 * (1300 / 900), d: 0.05 };

async function cardTexture(look) {
  const img = await image(look.photo);
  const [c, ctx] = makeCanvas(900, 1300);
  ctx.fillStyle = "#f6eee1";
  ctx.fillRect(0, 0, 900, 1300);
  // The photo, cropped to a portrait from the square studio shot.
  const ph = { x: 40, y: 40, w: 820, h: 1093 };
  const s = img.height / ph.h;
  const sw = ph.w * s;
  ctx.drawImage(img, (img.width - sw) / 2, 0, sw, img.height, ph.x, ph.y, ph.w, ph.h);
  ctx.fillStyle = "#6f5f4c";
  ctx.font = "500 26px Geist";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  if ("letterSpacing" in ctx) ctx.letterSpacing = "5px";
  ctx.fillText(look.label.toUpperCase(), 44, 1196);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  ctx.fillStyle = "#25211c";
  ctx.font = "italic 400 44px 'Playfair Display'";
  ctx.fillText(look.title, 42, 1258);
  if (look.pick) {
    ctx.fillStyle = "#6f5f4c";
    ctx.font = "500 22px Geist";
    ctx.textAlign = "right";
    if ("letterSpacing" in ctx) ctx.letterSpacing = "4px";
    ctx.fillText("MY PICK", 858, 1196);
  }
  return canvasTexture(c);
}

/* ------------------------------------------------------------------ the swatches */

// The profile's colours, as squares of woven cloth: each lifts from its swatch on the screen, grows
// and hangs in a soft arc over the phone, then goes back. Sizes in centimetres, in the phone's space.
const SWATCH = { size: 1.75, d: 0.05 };
const swatches = [];

/** A plain weave in the given colour: fine warp and weft lines and a little unevenness. */
function weave(css) {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 4) {
    ctx.fillStyle = `rgba(255,255,255,${0.035 + rand() * 0.03})`;
    ctx.fillRect(0, i, 256, 1.6);
    ctx.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.04})`;
    ctx.fillRect(i + 2, 0, 1.4, 256);
  }
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = rand() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
    ctx.fillRect(rand() * 256, rand() * 256, 1 + rand() * 6, 1);
  }
  return canvasTexture(c);
}

/* ------------------------------------------------------------------ build */

const world = new THREE.Group();
scene.add(world);
const phone = new THREE.Group();
const cards = [];
let gobo;
let key;

async function build() {
  layoutInfo = await (await fetch("/scene/screens/layout.json")).json();
  const names = { home: "home", chosen: "home-dinner", build: "build", results: "results", fit: "dna-fit", fitSlim: "dna-fit-slim", taste: "dna-taste", taste1: "dna-taste-1", taste2: "dna-taste-2", profile: "dna-profile" };
  await Promise.all(Object.entries(names).map(async ([k, n]) => (shots[k] = await image(`/scene/screens/${n}.png`))));
  await document.fonts.ready;

  // The table.
  const table = new THREE.Mesh(new THREE.PlaneGeometry(260, 200), new THREE.MeshStandardMaterial({ map: travertine(), roughness: 0.62, metalness: 0 }));
  table.rotation.x = -Math.PI / 2;
  table.position.z = -40;
  table.receiveShadow = true;
  world.add(table);

  // The wall behind, far enough to fall out of focus.
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(300, 190), new THREE.MeshStandardMaterial({ map: plaster(), roughness: 0.95 }));
  wall.position.set(0, 80, -75);
  wall.receiveShadow = true;
  world.add(wall);

  // Tailoring cloth, the houndstooth from the Style DNA photograph, lying in soft folds at the back left.
  const clothTex = await load("/images/home/dna-960.webp");
  clothTex.repeat.set(0.62, 0.5);
  clothTex.offset.set(0.36, 0.45);
  const clothGeo = new THREE.PlaneGeometry(30, 18, 60, 36);
  const cp = clothGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i);
    const y = cp.getY(i);
    cp.setZ(i, 0.35 * Math.sin(x * 0.42 + y * 0.12) + 0.22 * Math.sin(y * 0.6 - x * 0.15) + 0.75);
  }
  clothGeo.computeVertexNormals();
  const cloth = new THREE.Mesh(clothGeo, new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.92, side: THREE.DoubleSide }));
  cloth.rotation.x = -Math.PI / 2;
  cloth.rotation.z = 0.32;
  cloth.position.set(-27, 0, -22);
  cloth.receiveShadow = true;
  cloth.castShadow = true;
  world.add(cloth);

  // The phone.
  const body = new THREE.Mesh(phoneBody(), titanium);
  body.castShadow = true;
  body.receiveShadow = true;
  phone.add(body);
  const front = new THREE.Mesh(flatRounded(PHONE.w - PHONE.edge * 2 + 0.04, PHONE.l - PHONE.edge * 2 + 0.04, PHONE.r - PHONE.edge), glassBlack);
  front.position.y = PHONE.t / 2 + 0.002;
  phone.add(front);
  screenTex = canvasTexture(screenCanvas);
  const screenMat = new THREE.MeshPhysicalMaterial({
    color: "#000",
    emissive: "#fff",
    emissiveMap: screenTex,
    emissiveIntensity: 0.94,
    roughness: 0.05,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 0.45,
  });
  const screenMesh = new THREE.Mesh(flatRounded(SCREEN.w, SCREEN.l, SCREEN.r), screenMat);
  screenMesh.position.y = PHONE.t / 2 + 0.004;
  phone.add(screenMesh);
  // Side buttons: action and volume on the left, the side button on the right.
  const button = (len, x, z) => {
    const b = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.32, len, 3, 0.045), titanium);
    b.position.set(x, 0, z);
    b.castShadow = true;
    phone.add(b);
  };
  button(0.62, -PHONE.w / 2 - 0.02, -4.55);
  button(1.15, -PHONE.w / 2 - 0.02, -3.1);
  button(1.15, -PHONE.w / 2 - 0.02, -1.6);
  button(1.7, PHONE.w / 2 + 0.02, -2.6);
  // Its contact shadow, softer and wider than the lamp's.
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(PHONE.w * 1.5, PHONE.l * 1.28), new THREE.MeshBasicMaterial({ map: softShadow(), transparent: true, opacity: 0.55, depthWrite: false, color: "#2b1a0c" }));
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = -PHONE.t / 2 + 0.02;
  phone.add(contact);
  phone.position.set(0, PHONE.t / 2, 0);
  phone.rotation.y = 0.2;
  world.add(phone);

  // The prints.
  for (const look of LOOKS) {
    const tex = await cardTexture(look);
    const paper = new THREE.MeshStandardMaterial({ color: "#efe5d5", roughness: 0.8 });
    const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, transparent: true });
    const mats = [paper, paper, paper, paper, faceMat, paper].map((m) => (m === paper ? m.clone() : m));
    for (const m of mats) m.transparent = true;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(CARD.w, CARD.h, CARD.d), mats);
    mesh.castShadow = true;
    mesh.visible = false;
    world.add(mesh);
    cards.push({ look, mesh, mats });
  }

  // The swatches, in the phone's own space so they follow it.
  for (const sw of layoutInfo.swatches) {
    const mat = new THREE.MeshStandardMaterial({ map: weave(sw.hex), roughness: 0.9, transparent: true });
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(SWATCH.size, SWATCH.d, SWATCH.size, 2, 0.02), mat);
    mesh.castShadow = true;
    mesh.visible = false;
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(SWATCH.size * 1.9, SWATCH.size * 1.9), new THREE.MeshBasicMaterial({ map: softShadow(), transparent: true, depthWrite: false, color: "#1d140b" }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.visible = false;
    phone.add(mesh, shadow);
    swatches.push({ sw, mesh, mat, shadow });
  }

  // Light: a low warm sun through the window at the left (it carries the window's pattern), a soft
  // fill from the room, and a little bounce from the stone.
  gobo = windowGobo();
  key = new THREE.SpotLight("#ffdcb0", 3.4, 0, 0.5, 0.75, 0);
  key.position.set(-45, 110, 45);
  key.target.position.set(4, 0, -8);
  key.map = gobo;
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 40;
  key.shadow.camera.far = 260;
  key.shadow.radius = 9;
  key.shadow.blurSamples = 16;
  key.shadow.bias = -0.0004;
  world.add(key, key.target);
  world.add(new THREE.HemisphereLight("#ffeedd", "#8a6440", 0.42));
  const fill = new THREE.DirectionalLight("#ffe9cf", 0.25);
  fill.position.set(40, 60, 60);
  world.add(fill);
}

/* ------------------------------------------------------------------ choreography */

// Two camera positions: close over the screen, and back in the room with the prints.
const CAMS = {
  desktop: {
    close: { pos: [3.2, 34, 12], look: [0.6, 0, -0.6], fov: 30 },
    room: { pos: [5, 31, 54], look: [1.5, 5.6, -4.5], fov: 30 },
  },
  mobile: {
    close: { pos: [2.6, 38, 12], look: [0.6, 0, -0.4], fov: 30 },
    room: { pos: [3, 36, 60], look: [1, 7.5, -4.5], fov: 32 },
  },
}[LAYOUT];

// Where the prints settle: an arc above and behind the phone, the pick in the middle and a touch higher.
const REST = {
  desktop: [
    { pos: [-11.2, 9.4, -5.5], yaw: 0.3, roll: 0.03 },
    { pos: [1.6, 11.4, -8.5], yaw: 0.02, roll: -0.01 },
    { pos: [14.2, 9, -4.5], yaw: -0.32, roll: -0.03 },
  ],
  mobile: [
    { pos: [-8.6, 12.4, -6], yaw: 0.32, roll: 0.03 },
    { pos: [1.2, 15.6, -9.5], yaw: 0.02, roll: -0.01 },
    { pos: [11.2, 11.8, -5], yaw: -0.34, roll: -0.03 },
  ],
}[LAYOUT];

const v3 = (a) => new THREE.Vector3(...a);
const tmpM = new THREE.Matrix4();
const flatQ = new THREE.Quaternion();

function cameraAt(t) {
  const out = ease(t, ...T.pullBack);
  const back = ease(t, ...T.closeIn, inOutSine);
  const k = out * (1 - back);
  const { close, room } = CAMS;
  const pos = v3(close.pos).lerp(v3(room.pos), k);
  const look = v3(close.look).lerp(v3(room.look), k);
  // A slow drift that comes back to where it started at the end of the loop.
  const drift = Math.sin((t / DURATION) * Math.PI * 2);
  pos.x += drift * 1.4 * k + Math.sin((t / DURATION) * Math.PI * 2) * 0.25;
  pos.y += Math.sin((t / DURATION) * Math.PI * 4) * 0.25 * k;
  camera.position.copy(pos);
  camera.fov = lerp(close.fov, room.fov, k);
  camera.updateProjectionMatrix();
  camera.lookAt(look);
}

/** A print's pose at rest: upright, turned to face the room camera, then given its own yaw and roll. */
function restPose(i) {
  const r = REST[i];
  const pos = v3(r.pos);
  const m = tmpM.lookAt(v3(CAMS.room.pos), pos, new THREE.Vector3(0, 1, 0));
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r.yaw, r.roll)));
  return { pos, q, scale: 1 };
}

/** A print's pose on the screen: lying in the thumbnail it came from, the size of that thumbnail. */
function screenPose(i) {
  const th = layoutInfo.thumbs[LOOKS[i].thumb];
  const local = screenPoint(th.x + th.w / 2, 47 + th.y + th.h / 2 - 6);
  phone.updateMatrixWorld();
  const pos = local.applyMatrix4(phone.matrixWorld);
  flatQ.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, phone.rotation.y, 0)).multiply(flatQ);
  const scale = ((th.w / 390) * SCREEN.w) / CARD.w;
  return { pos, q, scale };
}

function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return p0
    .clone()
    .multiplyScalar(u * u * u)
    .add(p1.clone().multiplyScalar(3 * u * u * t))
    .add(p2.clone().multiplyScalar(3 * u * t * t))
    .add(p3.clone().multiplyScalar(t * t * t));
}

function placeCards(t) {
  const [r0, r1] = T.rise;
  const [h0, h1] = T.home;
  cards.forEach((card, i) => {
    const order = [1, 0, 2][i]; // the pick leaves first, then classic, then relaxed
    const stagger = 0.16;
    const riseLen = r1 - r0 - stagger * 2;
    const up = span(t, r0 + order * stagger, r0 + order * stagger + riseLen);
    const homeLen = h1 - h0 - stagger * 2;
    const down = span(t, h0 + (2 - order) * stagger * 0.6, h0 + (2 - order) * stagger * 0.6 + homeLen);
    const out = up > 0 && down < 1;
    card.mesh.visible = out;
    if (!out) return;

    const a = screenPose(i);
    const b = restPose(i);
    // Rising: quick off the screen, slow into place. Going home: the same path, gently.
    const k = down > 0 ? 1 - inOut(down) : outQuint(up) * 0.15 + inOut(up) * 0.85;
    // The path climbs out of the screen first, then swings out to its place.
    const p1 = a.pos.clone().add(new THREE.Vector3(0, 9, 2));
    const p2 = b.pos.clone().add(new THREE.Vector3((b.pos.x - a.pos.x) * -0.15, -2.5, 7));
    const pos = bezier(a.pos, p1, p2, b.pos, k);
    const q = a.q.clone().slerp(b.q, inOut(clamp(k * 1.15)));
    let scale = Math.exp(lerp(Math.log(a.scale), Math.log(b.scale), outQuint(clamp(k * 1.3)) * 0.4 + clamp(k * 1.3) * 0.6));

    // Settled: breathing a little. The sharper look comes forward, the other two give way.
    const settled = clamp((t - (r1 - 0.2)) / 0.4) * (1 - span(t, h0, h0 + 0.3));
    pos.y += Math.sin(t * 1.3 + i * 2.1) * 0.12 * settled;
    const fwd = ease(t, ...T.forward) * (1 - ease(t, ...T.back));
    const toCam = v3(CAMS.room.pos).sub(pos).normalize();
    let shade = 1;
    if (LOOKS[i].pick) {
      pos.addScaledVector(toCam, 5.5 * fwd);
      pos.y += 0.6 * fwd;
      scale *= 1 + 0.04 * fwd;
      q.slerp(new THREE.Quaternion().setFromRotationMatrix(tmpM.lookAt(camera.position, pos, new THREE.Vector3(0, 1, 0))), 0.35 * fwd);
    } else {
      pos.addScaledVector(toCam, -2.2 * fwd);
      pos.x += (i === 0 ? -1.1 : 1.1) * fwd;
      shade = 1 - 0.14 * fwd;
    }
    card.mesh.position.copy(pos);
    card.mesh.quaternion.copy(q);
    card.mesh.scale.setScalar(scale);
    // The print appears as it leaves the thumbnail, and fades back into it.
    const appear = Math.min(clamp(up / 0.12), clamp((1 - down) / 0.1));
    for (const m of card.mats) {
      m.opacity = appear;
      m.color.setScalar(shade);
      m.depthWrite = appear > 0.99;
    }
    card.mesh.castShadow = appear > 0.3;
  });
}

/** The swatches: off the screen, up into an arc over the phone, a slow turn, and back into place. */
function placeSwatches(t) {
  const n = swatches.length;
  swatches.forEach((s, i) => {
    const stagger = 0.07;
    const up = span(t, T.lift[0] + i * stagger, T.lift[1] - (n - 1 - i) * stagger);
    const down = span(t, T.settle[0] + (n - 1 - i) * stagger * 0.6, T.settle[1] - i * stagger * 0.6);
    const out = up > 0 && down < 1;
    s.mesh.visible = s.shadow.visible = out;
    if (!out) return;
    const k = down > 0 ? 1 - inOut(down) : outQuint(up) * 0.2 + inOut(up) * 0.8;
    const sw = s.sw;
    const from = screenPoint(sw.x + sw.w / 2, 47 + sw.y + sw.h / 2);
    // An arc across the screen, the middle colour highest, a little towards the camera.
    const u = i / (n - 1) - 0.5;
    const to = new THREE.Vector3(u * 8.6, 4.6 - Math.abs(u) * 1.8, -2.4 + Math.abs(u) * 1.4);
    const p1 = from.clone().add(new THREE.Vector3(0, 2.2, 0));
    const p2 = to.clone().add(new THREE.Vector3(-u * 0.8, -0.6, 1.4));
    const pos = bezier(from, p1, p2, to, k);
    const settled = clamp((t - T.lift[1] + 0.1) / 0.35) * (1 - span(t, T.settle[0], T.settle[0] + 0.25));
    pos.y += Math.sin(t * 1.6 + i * 1.3) * 0.08 * settled;
    s.mesh.position.copy(pos);
    // Flat on the screen at first; in the air, tipped towards the camera and turned a little each.
    s.mesh.rotation.set(0.35 * k + Math.sin(t * 1.1 + i) * 0.04 * settled, u * -0.5 * k, u * 0.18 * k);
    s.mesh.scale.setScalar(lerp(sw.w / 390 * SCREEN.w / SWATCH.size, 1, outQuint(k)));
    const appear = Math.min(clamp(up / 0.1), clamp((1 - down) / 0.08));
    s.mat.opacity = appear;
    s.mat.depthWrite = appear > 0.99;
    // A soft shadow on the glass, wider and fainter the higher it hangs, pushed away from the window.
    const h = pos.y - PHONE.t / 2;
    s.shadow.position.set(pos.x + h * 0.35, PHONE.t / 2 + 0.014, pos.z - h * 0.3);
    s.shadow.scale.setScalar(lerp(0.4, 1.3, clamp(h / 4.6)) * s.mesh.scale.x);
    s.shadow.material.opacity = appear * lerp(0.45, 0.2, clamp(h / 4.6));
  });
}

function draw(t) {
  t = ((t % DURATION) + DURATION) % DURATION;
  drawScreen(t);
  cameraAt(t);
  placeCards(t);
  placeSwatches(t);
  renderer.render(scene, camera);
}

await build();
window.size = SIZE;
window.DURATION = DURATION;
window.seek = (t) => draw(t);
window.ready = true;
const only = params.get("t");
draw(only ? Number(only) : 0);
