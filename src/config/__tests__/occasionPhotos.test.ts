/**
 * The home's occasion photos. Run on its own with `npm run photos:check`. All five must be on disk at
 * both widths, 4:3 like the cards, with alt text, and credited.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OCCASION_PHOTOS } from "../occasionPhotos";

const PUBLIC = join(__dirname, "../../../public");

/** Width and height of a WebP file, from its header. */
function webpSize(path: string): { w: number; h: number } | null {
  const b = readFileSync(path);
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") return null;
  const kind = b.toString("ascii", 12, 16);
  if (kind === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (kind === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  if (kind === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

describe("occasion photos", () => {
  it("has all five photos at both widths, 4:3, described", () => {
    for (const [id, photo] of Object.entries(OCCASION_PHOTOS.photos)) {
      expect(photo.alt, `alt for ${id}`).toBeTruthy();
      for (const w of [480, 960]) {
        const file = join(PUBLIC, `${photo.base}-${w}.webp`);
        expect(existsSync(file), file).toBe(true);
        const size = webpSize(file);
        expect(size?.w, file).toBe(w);
        expect(size!.h / size!.w, `${file} is 4:3 like the cards`).toBeCloseTo(0.75, 2);
      }
    }
  });

  it("credits them", () => {
    expect(existsSync(join(PUBLIC, "images/home/CREDITS.md"))).toBe(true);
  });
});
