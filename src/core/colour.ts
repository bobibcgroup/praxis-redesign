/**
 * Colour arithmetic for reading photos on the device: sRGB to CIELAB, the main colour of a garment
 * against its background, its everyday name, and a face's undertone and contrast from skin and
 * feature samples. Pure functions, so they are tested without a browser.
 *
 * These are readings, not measurements: light changes them, and the customer can always correct them.
 */

export type Lab = [number, number, number];
export type Rgb = [number, number, number];

const lin = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);

export function toLab([r, g, b]: Rgb): Lab {
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export const deltaE = (a: Lab, b: Lab) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const chroma = (l: Lab) => Math.hypot(l[1], l[2]);
/** Hue angle in degrees, 0 to 360. */
export const hue = (l: Lab) => ((Math.atan2(l[2], l[1]) * 180) / Math.PI + 360) % 360;

export function median(values: number[]): number {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function medianLab(samples: Lab[]): Lab {
  return [median(samples.map((s) => s[0])), median(samples.map((s) => s[1])), median(samples.map((s) => s[2]))];
}

/** The colours a man's wardrobe is described in, as a customer would say them. */
export const NAMED: { name: string; rgb: Rgb }[] = [
  { name: "White", rgb: [242, 241, 236] },
  { name: "Ivory", rgb: [236, 228, 208] },
  { name: "Light grey", rgb: [190, 190, 188] },
  { name: "Grey", rgb: [128, 128, 128] },
  { name: "Charcoal", rgb: [62, 64, 68] },
  { name: "Black", rgb: [24, 24, 26] },
  { name: "Navy", rgb: [32, 42, 74] },
  { name: "Blue", rgb: [52, 92, 160] },
  { name: "Light blue", rgb: [158, 188, 220] },
  { name: "Teal", rgb: [40, 110, 112] },
  { name: "Green", rgb: [56, 110, 64] },
  { name: "Olive", rgb: [104, 104, 58] },
  { name: "Khaki", rgb: [178, 164, 120] },
  { name: "Beige", rgb: [212, 194, 162] },
  { name: "Camel", rgb: [186, 140, 90] },
  { name: "Tan", rgb: [164, 116, 72] },
  { name: "Brown", rgb: [98, 66, 44] },
  { name: "Burgundy", rgb: [108, 30, 44] },
  { name: "Red", rgb: [186, 40, 44] },
  { name: "Pink", rgb: [226, 160, 172] },
  { name: "Orange", rgb: [220, 120, 46] },
  { name: "Yellow", rgb: [226, 196, 72] },
  { name: "Purple", rgb: [96, 64, 130] },
];
const NAMED_LAB = NAMED.map((n) => ({ name: n.name, lab: toLab(n.rgb) }));

export function nameColour(lab: Lab): string {
  let best = NAMED_LAB[0];
  for (const n of NAMED_LAB) if (deltaE(lab, n.lab) < deltaE(lab, best.lab)) best = n;
  return best.name;
}

/**
 * The garment's colour: pixels from the middle of the photo that differ from its border (the
 * background), grouped, and the largest group named. Null when nothing stands out from the background.
 */
export function garmentColour(pixels: { lab: Lab; centre: boolean; border: boolean }[]): { name: string; lab: Lab; share: number } | null {
  const border = pixels.filter((p) => p.border).map((p) => p.lab);
  if (!border.length) return null;
  const background = medianLab(border);
  const subject = pixels.filter((p) => p.centre && deltaE(p.lab, background) > 14).map((p) => p.lab);
  const centre = pixels.filter((p) => p.centre).length;
  if (subject.length < Math.max(24, centre * 0.15)) return null;
  // A few rounds of k-means with three groups, started from spread-out samples.
  const k = 3;
  let centres: Lab[] = [0, 0.5, 0.99].map((q) => subject[Math.floor(q * (subject.length - 1))]);
  let groups: Lab[][] = [];
  for (let round = 0; round < 8; round++) {
    groups = centres.map(() => []);
    for (const p of subject) {
      let best = 0;
      for (let i = 1; i < k; i++) if (deltaE(p, centres[i]) < deltaE(p, centres[best])) best = i;
      groups[best].push(p);
    }
    centres = groups.map((g, i) => (g.length ? medianLab(g) : centres[i]));
  }
  const biggest = groups.reduce((a, g, i) => (g.length > groups[a].length ? i : a), 0);
  return { name: nameColour(centres[biggest]), lab: centres[biggest], share: groups[biggest].length / subject.length };
}

/**
 * Undertone from the skin's hue: pinker skin reads cool, more golden skin reads warm. Close calls are
 * neutral. Contrast from how far the skin's lightness is from the darkest of hair, brows and eyes.
 */
export function faceReading(skin: Lab, features: Lab): { undertone: "cool" | "warm" | "neutral"; contrast: "high" | "medium" | "low" } {
  const h = hue(skin);
  // Most skin sits between about 40 and 65 degrees; the middle band is called neutral rather than guessed.
  const undertone = h < 47 ? "cool" : h > 57 ? "warm" : "neutral";
  const gap = skin[0] - features[0];
  const contrast = gap > 40 ? "high" : gap > 22 ? "medium" : "low";
  return { undertone, contrast };
}

/** A strong colour cast over the whole photo (a warm lamp, a blue screen) makes the skin's hue unreliable. */
export function castOf(average: Lab): boolean {
  return chroma(average) > 28;
}
