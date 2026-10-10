/*
 * The Praxis home demo as a timeline. Everything on screen is a pure function of the time t
 * (seconds), so render.mjs can step through it frame by frame and the result is the same every
 * time. Open scene.html?layout=desktop (or mobile) in a browser and call seek(t), or add &play
 * to watch it run.
 *
 * The story, 8.5 s, looping:
 *   0.0  the occasions, as on the home page; Dinner is tapped
 *   1.0  the Dinner photograph opens to fill the frame
 *   1.6  the build: "I'm putting your looks together." with the real stage names
 *   2.9  the three dinner looks develop out of the build's ghost prints
 *   5.3  the Sharper look is tapped and opens as the results page does: the print, the
 *        stylist's note, the pieces, the three looks as thumbnails
 *   7.0  back to the three looks, held
 *   8.0  the occasions return over it, which is frame one again
 *
 * Copy, looks, pieces and stage names are the app's own (src/lib/outfitLibrary.ts,
 * src/shared/catalog.ts, src/shared/guided.ts). No vendors or prices are shown.
 */
(function () {
  const params = new URLSearchParams(location.search);
  const MOBILE = params.get("layout") === "mobile";
  const DURATION = 8.5;

  // ---------- content ----------
  const OCCASIONS = [
    { name: "Dinner", photo: "/images/home/dinner-960.webp" },
    { name: "Work", photo: "/images/home/work-960.webp" },
    { name: "Date", photo: "/images/home/date-960.webp" },
    { name: "Wedding", photo: "/images/home/wedding-960.webp" },
    { name: "Party", photo: "/images/home/party-960.webp" },
  ];
  const LOOKS = [
    { label: "Classic", title: "Polished Casual", image: "/images/dinner_safest_01.jpg" },
    { label: "Sharper", title: "Elevated Dinner", image: "/images/dinner_sharper_01.jpg" },
    { label: "Relaxed", title: "Relaxed Clean", image: "/images/dinner_relaxed_01.jpg" },
  ];
  const PICK = 1;
  const NOTE = "A blazer over a fitted knit looks intentional, and the boots finish it.";
  const PIECES = ["Blazer over a fitted knit", "Tailored trousers", "Chelsea boots"];
  const STAGES = ["Finding the right pieces", "Putting three looks together"];

  // ---------- layout (CSS px; rendered at 2x) ----------
  const L = MOBILE ? mobileLayout() : desktopLayout();

  function desktopLayout() {
    const W = 540, H = 585, P = 28;
    const inner = W - 2 * P;
    const cw3 = (inner - 20) / 3, cw2 = (inner - 10) / 2, ch = 196;
    const gridTop = 104;
    const cards = [0, 1, 2].map((i) => ({ x: P + i * (cw3 + 10), y: gridTop, w: cw3, h: ch }))
      .concat([0, 1].map((i) => ({ x: P + i * (cw2 + 10), y: gridTop + ch + 10, w: cw2, h: ch })));
    const pw = (inner - 20) / 3;
    const prints = [0, 1, 2].map((i) => ({ x: P + i * (pw + 10), y: 154, w: pw, h: 318 }));
    const colX = 284, colW = W - P - colX;
    const tw = 64, tg = (colW - 3 * tw) / 2;
    const thumbs = [0, 1, 2].map((i) => ({ x: colX + i * (tw + tg), y: 410, w: tw, h: 88 }));
    return {
      W, H, P, cards, prints, thumbs,
      occLabel: { y: 72, size: 11 },
      cardName: 22, cardPad: 16,
      eyebrow: { y: 50, size: 11 },
      headline: { y: 70, size: 28, lh: 36 },
      progress: { y: 118, w: inner },
      stage: { y: 128, size: 12 },
      printLabel: { gap: 14, size: 11, title: 17 },
      hero: { x: P, y: 50, w: 232, h: 482 },
      col: { x: colX, w: colW, eyebrow: 58, title: 78, titleSize: 28, note: 124, noteSize: 15, noteLh: 22, rows: 214, rowH: 44, rowSize: 15, box: 16 },
      thumbLabel: { size: 10 },
      touch: 44,
    };
  }

  function mobileLayout() {
    const W = 360, H = 450, P = 16;
    const inner = W - 2 * P;
    const cw = (inner - 8) / 2, ch = 112;
    const gridTop = 64;
    const cards = [
      { x: P, y: gridTop, w: cw, h: ch },
      { x: P + cw + 8, y: gridTop, w: cw, h: ch },
      { x: P, y: gridTop + ch + 8, w: cw, h: ch },
      { x: P + cw + 8, y: gridTop + ch + 8, w: cw, h: ch },
      { x: P, y: gridTop + 2 * (ch + 8), w: inner, h: 100 },
    ];
    const pw = (inner - 16) / 3;
    const prints = [0, 1, 2].map((i) => ({ x: P + i * (pw + 8), y: 116, w: pw, h: 246 }));
    const heroW = 156;
    const tw = 46, tg = (heroW - 3 * tw) / 2;
    const thumbs = [0, 1, 2].map((i) => ({ x: P + i * (tw + tg), y: 334, w: tw, h: 62 }));
    const colX = P + heroW + 14, colW = W - P - colX;
    return {
      W, H, P, cards, prints, thumbs,
      occLabel: { y: 36, size: 10 },
      cardName: 18, cardPad: 12,
      eyebrow: { y: 30, size: 10 },
      headline: { y: 46, size: 21, lh: 28 },
      progress: { y: 86, w: inner },
      stage: { y: 94, size: 11 },
      printLabel: { gap: 10, size: 10, title: 14 },
      hero: { x: P, y: 28, w: heroW, h: 292 },
      col: { x: colX, w: colW, eyebrow: 32, title: 50, titleSize: 22, note: 112, noteSize: 13, noteLh: 19, rows: 208, rowH: 38, rowSize: 12, box: 14 },
      thumbLabel: { size: 8 },
      touch: 38,
    };
  }

  // ---------- easing and time helpers ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const span = (t, a, b) => clamp((t - a) / (b - a));
  const inOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const out = (p) => 1 - Math.pow(1 - p, 3);
  const outQuint = (p) => 1 - Math.pow(1 - p, 5);
  const lerp = (a, b, p) => a + (b - a) * p;
  const lerpRect = (r1, r2, p) => ({ x: lerp(r1.x, r2.x, p), y: lerp(r1.y, r2.y, p), w: lerp(r1.w, r2.w, p), h: lerp(r1.h, r2.h, p) });
  /** 0 before a, rises to 1 over [a, a+d], holds, falls to 0 over [b-d2, b]. */
  const window_ = (t, a, d, b, d2) => Math.min(out(span(t, a, a + d)), 1 - inOut(span(t, b - d2, b)));

  // ---------- DOM ----------
  const stage = document.getElementById("stage");
  stage.style.width = L.W + "px";
  stage.style.height = L.H + "px";

  function el(tag, cls, parent = stage, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    parent.appendChild(e);
    return e;
  }
  function place(e, r) {
    e.style.left = r.x + "px";
    e.style.top = r.y + "px";
    e.style.width = r.w + "px";
    e.style.height = r.h + "px";
  }
  function text(e, { x, y, size, lh, w, color, italic }) {
    e.style.left = x + "px";
    e.style.top = y + "px";
    e.style.fontSize = size + "px";
    e.style.lineHeight = (lh || Math.round(size * 1.45)) + "px";
    if (w) e.style.width = w + "px";
    if (color) e.style.color = color;
    if (italic) e.style.fontStyle = "italic";
  }
  const ARROW = (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;
  const CHECK = (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;

  function makeCard(o, parent) {
    const c = el("div", "abs photo", parent);
    const img = el("img", "", c);
    img.src = o.photo;
    el("div", "card-shade", c);
    const dim = el("div", "card-dim", c);
    const name = el("span", "card-name serif", c, o.name);
    name.style.left = L.cardPad + "px";
    name.style.bottom = L.cardPad - 2 + "px";
    name.style.fontSize = L.cardName + "px";
    name.style.lineHeight = L.cardName + 4 + "px";
    const arrow = el("span", "card-arrow", c, ARROW(16));
    arrow.style.right = L.cardPad + "px";
    arrow.style.bottom = L.cardPad + "px";
    arrow.style.height = "16px";
    return { c, img, dim, name, arrow };
  }

  // Layer order, back to front: header copy, prints and their labels, the results column,
  // thumbnails, then the occasions (with their own background) on top, then touches.
  const header = {
    buildEyebrow: el("div", "abs label"),
    buildLine: el("div", "abs serif", stage, "I’m putting your looks together."),
    track: el("div", "abs"),
    fill: el("div", "abs"),
    stages: STAGES.map((s) => el("div", "abs", stage, s)),
    resultEyebrow: el("div", "abs label", stage, "My picks for dinner"),
    resultLine: el("div", "abs serif", stage, "Three looks for dinner."),
  };
  header.buildEyebrow.textContent = "Dinner";
  for (const e of [header.buildEyebrow, header.resultEyebrow]) text(e, { x: L.P, y: L.eyebrow.y, size: L.eyebrow.size, lh: 16, color: "#6b665c" });
  for (const e of [header.buildLine, header.resultLine]) text(e, { x: L.P, y: L.headline.y, size: L.headline.size, lh: L.headline.lh });
  place(header.track, { x: L.P, y: L.progress.y, w: L.progress.w, h: 1 });
  header.track.style.background = "#dcd5c6";
  place(header.fill, { x: L.P, y: L.progress.y, w: L.progress.w, h: 1 });
  header.fill.style.background = "#1e1d1a";
  header.fill.style.transformOrigin = "left center";
  for (const e of header.stages) text(e, { x: L.P, y: L.stage.y, size: L.stage.size, color: "#6b665c" });

  const prints = LOOKS.map((look) => {
    const c = el("div", "abs print");
    const img = el("img", "", c);
    img.src = look.image;
    const label = el("div", "abs label", stage, look.label);
    const title = el("div", "abs serif", stage, look.title);
    return { c, img, label, title };
  });

  const col = {
    eyebrow: el("div", "abs label", stage, "My pick for dinner"),
    title: el("div", "abs serif", stage, LOOKS[PICK].title),
    note: el("div", "abs serif", stage, NOTE),
    rows: PIECES.map((p) => {
      const r = el("div", "abs row");
      const b = el("span", "box", r, CHECK(L.col.box - 4));
      b.style.width = b.style.height = L.col.box + "px";
      const n = el("span", "serif", r, p);
      n.style.marginLeft = (MOBILE ? 10 : 14) + "px";
      n.style.fontSize = L.col.rowSize + "px";
      n.style.whiteSpace = "nowrap";
      return r;
    }),
  };
  text(col.eyebrow, { x: L.col.x, y: L.col.eyebrow, size: L.eyebrow.size, lh: 16, color: "#6b665c" });
  text(col.title, { x: L.col.x, y: L.col.title, size: L.col.titleSize, lh: Math.round(L.col.titleSize * 1.22), w: L.col.w });
  text(col.note, { x: L.col.x, y: L.col.note, size: L.col.noteSize, lh: L.col.noteLh, w: L.col.w, italic: true });
  col.rows.forEach((r, i) => place(r, { x: L.col.x, y: L.col.rows + i * L.col.rowH, w: L.col.w, h: L.col.rowH }));

  const thumbs = LOOKS.map((look, i) => {
    const c = el("div", "abs print");
    const img = el("img", "", c);
    img.src = look.image;
    place(c, L.thumbs[i]);
    const label = el("div", "abs label", stage, look.label);
    const r = L.thumbs[i];
    text(label, { x: r.x - 20, y: r.y + r.h + 6, size: L.thumbLabel.size, lh: 14, w: r.w + 40, color: i === PICK ? "#1e1d1a" : "#6b665c" });
    label.style.textAlign = "center";
    if (MOBILE) label.style.letterSpacing = "0.1em";
    return { c, label };
  });
  const underline = el("div", "abs");
  {
    const r = L.thumbs[PICK];
    place(underline, { x: r.x, y: r.y + r.h + 26, w: r.w, h: 2 });
    underline.style.background = "#1e1d1a";
    underline.style.transformOrigin = "center";
  }

  const occ = {
    bg: el("div", "abs"),
    label: el("div", "abs label", stage, "Where are you going?"),
    cards: OCCASIONS.map((o) => makeCard(o, stage)),
  };
  occ.bg.style.background = "#e8e3d6";
  place(occ.bg, { x: 0, y: 0, w: L.W, h: L.H });
  text(occ.label, { x: L.P, y: L.occLabel.y, size: L.occLabel.size, lh: 16, color: "#6b665c" });
  OCCASIONS.forEach((_, i) => place(occ.cards[i].c, L.cards[i]));
  const ring = el("div", "abs");
  ring.style.borderRadius = "3px";
  ring.style.boxShadow = "0 0 0 2px #e8e3d6, 0 0 0 3px #1e1d1a";

  const touch1 = el("div", "abs touch");
  const touch2 = el("div", "abs touch");

  // ---------- the timeline ----------
  const full = { x: 0, y: 0, w: L.W, h: L.H };
  const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

  function seek(t) {
    t = ((t % DURATION) + DURATION) % DURATION;

    // Occasions: present at the start, gone once Dinner opens, back over the last half second.
    const back = inOut(span(t, 8.12, 8.5));
    const occOn = t < 1.0 ? 1 : t >= 8.0 ? back : 1 - inOut(span(t, 1.0, 1.35));
    const veil = inOut(span(t, 8.0, 8.3));
    const push = t < 8.0 ? 1 + 0.035 * inOut(span(t, 0, 1.0)) : 1;
    const pushOrigin = center(L.cards[0]);
    occ.bg.style.opacity = t < 1.6 ? 1 - inOut(span(t, 1.5, 1.95)) : t >= 8.0 ? veil : 0;
    occ.label.style.opacity = occOn;
    const origin = `${pushOrigin.x}px ${pushOrigin.y}px`;
    for (let i = 1; i < 5; i++) {
      const c = occ.cards[i];
      c.c.style.opacity = occOn;
      c.c.style.transformOrigin = `${pushOrigin.x - L.cards[i].x}px ${pushOrigin.y - L.cards[i].y}px`;
      c.c.style.transform = `scale(${push})`;
    }
    occ.label.style.transformOrigin = `${pushOrigin.x - L.P}px ${pushOrigin.y - L.occLabel.y}px`;
    occ.label.style.transform = `scale(${push})`;

    // Dinner: tapped at 0.55, selected, then opens to fill the frame.
    const d = occ.cards[0];
    const sel = t < 8.0 ? out(span(t, 0.6, 0.85)) : 0;
    const open = t < 8.0 ? inOut(span(t, 1.0, 1.55)) : 0;
    const base = { ...L.cards[0] };
    const pushed = {
      x: pushOrigin.x - (base.w * push) / 2,
      y: pushOrigin.y - (base.h * push) / 2,
      w: base.w * push,
      h: base.h * push,
    };
    const r = lerpRect(pushed, full, open);
    place(d.c, r);
    d.c.style.borderRadius = lerp(2, 0, open) + "px";
    d.img.style.transform = `scale(${1 + 0.05 * sel - 0.05 * sel * open + 0.04 * inOut(span(t, 1.2, 2.0))})`;
    d.dim.style.opacity = 0.2 * sel * (1 - open) + 0.32 * open;
    d.name.style.opacity = 1 - out(span(t, 1.0, 1.25));
    d.arrow.style.opacity = 1 - out(span(t, 1.0, 1.25));
    d.arrow.style.transform = `translateX(${4 * sel}px)`;
    d.c.style.opacity = t < 1.5 ? 1 : t >= 8.0 ? back : 1 - inOut(span(t, 1.5, 1.95));
    place(ring, pushed);
    ring.style.opacity = sel * (1 - out(span(t, 1.0, 1.15)));

    touchAt(touch1, center(pushed), t, 0.5);

    // The build: the stylist's line, the progress hairline, the real stage names.
    const buildOn = window_(t, 1.75, 0.4, 2.95, 0.2);
    header.buildEyebrow.style.opacity = buildOn;
    header.buildLine.style.opacity = buildOn;
    header.buildLine.style.transform = `translateY(${8 * (1 - out(span(t, 1.75, 2.25)))}px)`;
    header.track.style.opacity = buildOn;
    header.fill.style.opacity = buildOn;
    header.fill.style.transform = `scaleX(${inOut(span(t, 1.85, 2.85))})`;
    header.stages[0].style.opacity = window_(t, 1.9, 0.2, 2.42, 0.12);
    header.stages[1].style.opacity = Math.min(window_(t, 2.42, 0.2, 2.95, 0.2), 1);

    // The results header, while the three looks are on screen.
    const resultOn = Math.min(out(span(t, 3.0, 3.35)), 1 - out(span(t, 5.35, 5.55))) || out(span(t, 7.3, 7.7));
    header.resultEyebrow.style.opacity = resultOn;
    header.resultLine.style.opacity = resultOn;
    header.resultLine.style.transform = `translateY(${t < 5 ? 8 * (1 - out(span(t, 3.0, 3.45))) : 0}px)`;

    // The prints: ghosts during the build, then they develop one after another.
    const drift = 1 + 0.012 * inOut(span(t, 3.7, 5.3));
    const go = inOut(span(t, 5.45, 6.1));
    const ret = inOut(span(t, 7.0, 7.6));
    const moved = go * (1 - ret);
    prints.forEach((p, i) => {
      const ghost = out(span(t, 2.0 + i * 0.08, 2.5 + i * 0.08));
      const aside = i === PICK ? 1 : 1 - Math.min(out(span(t, 5.4, 5.7)), 1 - inOut(span(t, 7.2, 7.6)));
      const dev = out(span(t, 2.9 + i * 0.16, 3.7 + i * 0.16));
      const target = i === PICK ? L.hero : L.thumbs[i];
      const rr = i === PICK ? lerpRect(L.prints[i], target, moved) : L.prints[i];
      place(p.c, rr);
      p.c.style.opacity = Math.max(0.42 * ghost, dev) * aside;
      p.c.style.filter = dev < 1 ? `blur(${14 * (1 - dev)}px)` : "none";
      const g = center(L.prints[1]);
      const scale = (moved > 0 ? 1 : drift) * (i === PICK ? 1 : lerp(1, 0.96, 1 - aside));
      p.c.style.transformOrigin = `${g.x - rr.x}px ${g.y - rr.y}px`;
      p.c.style.transform = `scale(${scale}) translateY(${10 * (1 - dev)}px)`;
      p.img.style.transform = `scale(${1.08 - 0.08 * dev + (i === PICK ? 0.0 : 0)})`;
      p.img.style.objectPosition = `center ${lerp(42, 40, moved)}%`;
      const lab = Math.min(out(span(t, 3.3 + i * 0.16, 3.8 + i * 0.16)), 1 - out(span(t, 5.4, 5.55))) || out(span(t, 7.45 + i * 0.06, 7.8 + i * 0.06));
      const lr = L.prints[i];
      text(p.label, { x: lr.x, y: lr.y + lr.h + L.printLabel.gap, size: L.printLabel.size, lh: 16, color: "#6b665c" });
      text(p.title, { x: lr.x, y: lr.y + lr.h + L.printLabel.gap + 18, size: L.printLabel.title, lh: L.printLabel.title + 6 });
      p.label.style.opacity = lab;
      p.title.style.opacity = lab;
      const ty = 6 * (1 - out(span(t, 3.3 + i * 0.16, 3.8 + i * 0.16)));
      p.label.style.transform = p.title.style.transform = `translate(${(drift - 1) * (lr.x + lr.w / 2 - g.x)}px, ${ty + (drift - 1) * (lr.y + lr.h - g.y)}px)`;
    });
    touchAt(touch2, center(L.prints[PICK]), t, 5.25);

    // The results page for the chosen look: the note, the pieces, the three as thumbnails.
    const colIn = (delay) => Math.min(out(span(t, 5.85 + delay, 6.3 + delay)), 1 - out(span(t, 6.9, 7.1)));
    const colY = (delay) => 8 * (1 - out(span(t, 5.85 + delay, 6.3 + delay)));
    [col.eyebrow, col.title, col.note].forEach((e, i) => {
      e.style.opacity = colIn(i * 0.08);
      e.style.transform = `translateY(${colY(i * 0.08)}px)`;
    });
    col.rows.forEach((e, i) => {
      e.style.opacity = colIn(0.3 + i * 0.1);
      e.style.transform = `translateY(${colY(0.3 + i * 0.1)}px)`;
    });
    thumbs.forEach((th, i) => {
      th.c.style.opacity = Math.min(out(span(t, 5.9 + i * 0.06, 6.25 + i * 0.06)), 1 - out(span(t, 6.9, 7.05)));
      th.c.style.transform = `translateY(${6 * (1 - out(span(t, 5.9 + i * 0.06, 6.3 + i * 0.06)))}px)`;
      th.label.style.opacity = Math.min(out(span(t, 6.0, 6.3)), 1 - out(span(t, 6.9, 7.05)));
    });
    underline.style.opacity = Math.min(out(span(t, 6.05, 6.35)), 1 - out(span(t, 6.9, 7.05)));
    underline.style.transform = `scaleX(${out(span(t, 6.05, 6.4))})`;
  }

  function touchAt(e, c, t, at) {
    const p = span(t, at, at + 0.5);
    const s = L.touch;
    place(e, { x: c.x - s / 2, y: c.y - s / 2, w: s, h: s });
    const visible = t >= at && t <= at + 0.5;
    e.style.opacity = visible ? Math.min(out(span(t, at, at + 0.08)), 1 - span(t, at + 0.18, at + 0.5)) : 0;
    e.style.transform = `scale(${0.7 + 0.5 * out(p)})`;
  }

  window.DURATION = DURATION;
  window.seek = seek;
  window.size = { w: L.W, h: L.H };
  seek(0);

  if (params.has("play")) {
    const start = performance.now();
    const loop = (now) => {
      seek((now - start) / 1000);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
})();
