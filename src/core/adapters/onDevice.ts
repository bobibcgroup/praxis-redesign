/**
 * Free photo reading that runs in the customer's browser: nothing is sent anywhere.
 *
 * - Garment colour: the main colour of a wardrobe photo, named the way a customer would say it.
 *   The type of piece stays the customer's choice.
 * - Face colours: MediaPipe's face landmarker (Apache 2.0, served from this site: /mediapipe and
 *   /models) finds the face; the skin of the cheeks and forehead gives the undertone, and the brows,
 *   eyes and hair against the skin give the contrast. Loaded only when a customer asks for their
 *   colours from their own photo.
 *
 * Readings, not measurements: light changes them, and the Style DNA lets the customer correct them.
 * The sample portrait and test mode keep the fixed example (vision.ts), so it is never mistaken for a reading.
 */
import { castOf, faceReading, garmentColour, medianLab, toLab, type Lab } from "../colour";
import type { ColourAnalysis, ColourAnalysisAdapter, GarmentAnalysis, GarmentRecognitionAdapter, ImageInput } from "../vision";

/** Only the customer's own photo, held in this tab, is read. */
export const isOwnPhoto = (ref: string) => ref.startsWith("data:image/") || ref.startsWith("blob:");

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("unreadable"));
    img.src = src;
  });
}

function pixelsOf(img: HTMLImageElement, max: number): { data: Uint8ClampedArray; width: number; height: number } {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(img, 0, 0, width, height);
  return { data: ctx.getImageData(0, 0, width, height).data, width, height };
}

export const onDeviceGarment: GarmentRecognitionAdapter = {
  id: "on-device-colour",
  version: "1.0.0",
  billable: false,
  async recognise(image: ImageInput): Promise<GarmentAnalysis> {
    try {
      const { data, width, height } = pixelsOf(await loadImage(image.ref), 96);
      const pixels = [];
      const edge = Math.max(2, Math.round(Math.min(width, height) * 0.06));
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4;
          if (data[i + 3] < 200) continue;
          const border = x < edge || y < edge || x >= width - edge || y >= height - edge;
          const centre = x > width * 0.2 && x < width * 0.8 && y > height * 0.15 && y < height * 0.85;
          if (border || centre) pixels.push({ lab: toLab([data[i], data[i + 1], data[i + 2]]), border, centre });
        }
      }
      const found = garmentColour(pixels);
      return found ? { status: "completed", colour: { value: found.name, source: "model", adapter: "on-device-colour" } } : { status: "completed" };
    } catch {
      return { status: "failed" };
    }
  },
};

/* --------------------------------------------------------------- face */

type Landmarker = { detect(img: HTMLImageElement): { faceLandmarks: { x: number; y: number }[][] } };
let landmarker: Promise<Landmarker> | null = null;

/**
 * MediaPipe's wasm writes its start-up notes ("INFO: Created TensorFlow Lite XNNPACK delegate") to
 * console.error, where they read as faults in error monitoring. They are dropped while it works.
 */
async function quietly<T>(work: () => Promise<T> | T): Promise<T> {
  const error = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && /^(INFO:|[IW]\d{4} )/.test(args[0])) return;
    error(...args);
  };
  try {
    return await work();
  } finally {
    console.error = error;
  }
}

function faceLandmarker(): Promise<Landmarker> {
  if (!landmarker) {
    landmarker = quietly(async () => {
      const vision = await import("@mediapipe/tasks-vision");
      const files = await vision.FilesetResolver.forVisionTasks("/mediapipe");
      return vision.FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: "/models/face_landmarker.task", delegate: "CPU" },
        runningMode: "IMAGE",
        numFaces: 1,
      });
    });
    landmarker.catch(() => (landmarker = null));
  }
  return landmarker;
}

// Points of the 478-point face mesh.
const CHEEKS = [50, 101, 118, 280, 330, 347];
const FOREHEAD = [151, 9, 108, 337];
const BROWS = [105, 66, 107, 334, 296, 336];
const IRISES = [468, 473];

export const onDeviceFace: ColourAnalysisAdapter = {
  id: "on-device-face",
  version: "1.0.0",
  billable: false,
  async analyse(image: ImageInput): Promise<ColourAnalysis> {
    let img: HTMLImageElement;
    try {
      img = await loadImage(image.ref);
    } catch {
      return { status: "unreadable", problem: "unreadable" };
    }
    let points: { x: number; y: number }[] | undefined;
    try {
      const found = await faceLandmarker();
      points = (await quietly(() => found.detect(img))).faceLandmarks[0];
    } catch {
      return { status: "failed" };
    }
    if (!points || points.length < 478) return { status: "unreadable", problem: "no_face" };

    const { data, width, height } = pixelsOf(img, 640);
    const at = (x: number, y: number): Lab | null => {
      const px = Math.round(x * width);
      const py = Math.round(y * height);
      if (px < 0 || py < 0 || px >= width || py >= height) return null;
      const i = (py * width + px) * 4;
      return toLab([data[i], data[i + 1], data[i + 2]]);
    };
    const faceW = Math.abs(points[454].x - points[234].x);
    const r = Math.max(2 / width, faceW * 0.025);
    const around = (x: number, y: number, out: Lab[]) => {
      for (let dy = -r; dy <= r; dy += r / 2) for (let dx = -r; dx <= r; dx += r / 2) {
        const lab = at(x + dx, y + dy);
        if (lab) out.push(lab);
      }
      return out;
    };
    const patch = (ids: number[]) => ids.reduce((out, id) => around(points![id].x, points![id].y, out), [] as Lab[]);
    // Skin without shine or deep shadow.
    const skinSamples = patch([...CHEEKS, ...FOREHEAD]).filter((l) => l[0] > 25 && l[0] < 92);
    if (skinSamples.length < 20) return { status: "unreadable", problem: "no_face" };
    const skin = medianLab(skinSamples);
    if (skin[0] < 22) return { status: "unreadable", problem: "too_dark" };

    // The darkest of brows, eyes and hair (hair: above the forehead, when it is in the photo).
    const top = points[10];
    const chin = points[152];
    const hairY = top.y - Math.abs(chin.y - top.y) * 0.12;
    const hair = hairY > 0 ? around(top.x, hairY, []) : [];
    const features = [medianLab(patch(BROWS)), medianLab(patch(IRISES)), ...(hair.length ? [medianLab(hair)] : [])].reduce((a, b) => (b[0] < a[0] ? b : a));

    // A strong cast over the whole photo makes the skin's hue unreliable: ask for daylight.
    const whole: Lab[] = [];
    for (let i = 0; i < data.length; i += 4 * 37) whole.push(toLab([data[i], data[i + 1], data[i + 2]]));
    if (castOf(medianLab(whole))) return { status: "unreadable", problem: "colour_cast" };

    const reading = faceReading(skin, features);
    return {
      status: "completed",
      undertone: { value: reading.undertone, source: "model", adapter: "on-device-face" },
      contrast: { value: reading.contrast, source: "model", adapter: "on-device-face" },
    };
  },
};
