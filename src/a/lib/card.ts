/**
 * The look as a 1080 x 1920 story card: the print on top, then the house mark, the eyebrow, the title,
 * the stylist's note and the address, on the ivory page. Drawn on a canvas so it can be shared as a file
 * (Instagram stories, WhatsApp, Messages) or saved.
 */
import type { Look } from "../../shared/catalog";

const W = 1080;
const H = 1920;
const INK = "#1e1d1a";
const MUTED = "#6b665c";
const IVORY = "#f1ede1";
const RULE = "#dcd5c6";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Draws text with letter spacing (canvas letterSpacing is not everywhere yet). */
function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  const chars = [...text];
  const width = chars.reduce((w, c) => w + ctx.measureText(c).width, 0) + spacing * (chars.length - 1);
  let cx = x - width / 2;
  for (const c of chars) {
    ctx.fillText(c, cx, y);
    cx += ctx.measureText(c).width + spacing;
  }
}

/** Wraps a line into the given width, centred, and returns the y under the last line. */
function wrapped(ctx: CanvasRenderingContext2D, text: string, y: number, maxWidth: number, lineHeight: number): number {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, W / 2, y);
      line = word;
      y += lineHeight;
    } else {
      line = next;
    }
  }
  if (line) ctx.fillText(line, W / 2, y);
  return y + lineHeight;
}

export async function renderLookCard(look: Look, eyebrow: string, address: string): Promise<Blob> {
  await Promise.all([
    document.fonts.load('400 96px "Playfair Display"'),
    document.fonts.load('italic 400 44px "Playfair Display"'),
    document.fonts.load('500 28px "Geist"'),
  ]).catch(() => undefined);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");

  ctx.fillStyle = IVORY;
  ctx.fillRect(0, 0, W, H);

  // The print: 3:4 across the top, cropped from the top so the face always shows.
  const img = await loadImage(look.image);
  const boxH = 1240;
  const scale = Math.max(W / img.width, boxH / img.height);
  const sw = W / scale;
  const sh = boxH / scale;
  ctx.drawImage(img, (img.width - sw) / 2, 0, sw, sh, 0, 0, W, boxH);

  // Melt the bottom of the print into the page.
  const fade = ctx.createLinearGradient(0, boxH - 220, 0, boxH);
  fade.addColorStop(0, "rgba(241,237,225,0)");
  fade.addColorStop(1, IVORY);
  ctx.fillStyle = fade;
  ctx.fillRect(0, boxH - 220, W, 220);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = INK;
  ctx.font = '400 40px "Playfair Display", Georgia, serif';
  spaced(ctx, "PRAXIS", W / 2, 1330, 18);

  ctx.textAlign = "left";
  ctx.fillStyle = MUTED;
  ctx.font = '500 26px "Geist", system-ui, sans-serif';
  spaced(ctx, eyebrow.toUpperCase(), W / 2, 1420, 5);

  ctx.textAlign = "center";
  ctx.fillStyle = INK;
  ctx.font = '400 96px "Playfair Display", Georgia, serif';
  let y = wrapped(ctx, look.title, 1530, 920, 104);

  ctx.font = 'italic 400 42px "Playfair Display", Georgia, serif';
  ctx.fillStyle = INK;
  y = wrapped(ctx, look.why, y + 10, 860, 58);

  ctx.strokeStyle = RULE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 60, 1800);
  ctx.lineTo(W / 2 + 60, 1800);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = MUTED;
  ctx.font = '500 24px "Geist", system-ui, sans-serif';
  spaced(ctx, `STYLED BY PRAXIS  ·  ${address.toUpperCase()}`, W / 2, 1860, 4);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No image"))), "image/png"));
}
