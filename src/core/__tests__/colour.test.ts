/** Reading colours on the device: the arithmetic behind the garment colour and the face reading. */
import { describe, expect, it } from "vitest";
import { castOf, faceReading, garmentColour, hue, nameColour, toLab, type Lab, type Rgb } from "../colour";

const grid = (subject: Rgb, background: Rgb, size = 40) => {
  const out: { lab: Lab; centre: boolean; border: boolean }[] = [];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const border = x < 3 || y < 3 || x >= size - 3 || y >= size - 3;
      const centre = x > size * 0.2 && x < size * 0.8 && y > size * 0.15 && y < size * 0.85;
      const inGarment = x > size * 0.25 && x < size * 0.75 && y > size * 0.2 && y < size * 0.8;
      if (border || centre) out.push({ lab: toLab(inGarment ? subject : background), centre, border });
    }
  return out;
};

describe("colour names", () => {
  it.each([
    [[30, 40, 72], "Navy"],
    [[245, 245, 240], "White"],
    [[22, 22, 24], "Black"],
    [[185, 140, 92], "Camel"],
    [[105, 32, 45], "Burgundy"],
    [[160, 190, 222], "Light blue"],
  ] as [Rgb, string][])("calls %j %s", (rgb, name) => expect(nameColour(toLab(rgb))).toBe(name));
});

describe("garment colour", () => {
  it("names the piece, not the background", () => {
    expect(garmentColour(grid([30, 40, 72], [236, 232, 225]))?.name).toBe("Navy");
    expect(garmentColour(grid([240, 240, 236], [40, 40, 42]))?.name).toBe("White");
  });
  it("says nothing when the piece does not stand out from the background", () => {
    expect(garmentColour(grid([236, 232, 225], [236, 232, 225]))).toBeNull();
  });
});

describe("face reading", () => {
  const pink = toLab([226, 178, 168]);
  const golden = toLab([214, 172, 128]);
  it("reads pinker skin as cool and more golden skin as warm", () => {
    expect(hue(pink)).toBeLessThan(hue(golden));
    expect(faceReading(pink, toLab([40, 30, 25])).undertone).toBe("cool");
    expect(faceReading(golden, toLab([40, 30, 25])).undertone).toBe("warm");
  });
  it("reads contrast from skin against the darkest feature", () => {
    expect(faceReading(pink, toLab([30, 24, 20])).contrast).toBe("high");
    expect(faceReading(pink, toLab([150, 120, 100])).contrast).toBe("medium");
    expect(faceReading(pink, toLab([200, 165, 150])).contrast).toBe("low");
  });
  it("spots a strong colour cast", () => {
    expect(castOf(toLab([128, 126, 122]))).toBe(false);
    expect(castOf(toLab([230, 140, 40]))).toBe(true);
  });
});
