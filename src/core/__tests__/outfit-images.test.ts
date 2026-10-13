/**
 * The outfit picture pipeline end to end on the server, against a stand-in for Google's API
 * (e2e/fixtures/fake-gemini.mjs): the actual piece pictures reach the request, the checks catch a
 * picture that leaves a piece out or gets its colour wrong, the cache and budget hold, and a Google
 * project without billing is reported as such. No key, no network, no cost.
 */
import { mkdtempSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error plain JavaScript module
import { startFakeGemini, state as fake } from "../../../e2e/fixtures/fake-gemini.mjs";
// @ts-expect-error plain JavaScript module
import { buildImageRequest, piecePictures, resetBase, resetModels, run } from "../../../server/providers/gemini-image.mjs";
// @ts-expect-error plain JavaScript module
import { afterVisual, approval, beforeVisual, canonicalSpec, imageKey, ledger, photoHostAllowed, readImage, resetVisuals } from "../../../server/visuals.mjs";

const SHOP = "https://cdn.shopify.com/s/files/1/test";
const engine = { id: "gemini-image", version: "test+p1", billable: true, budgeted: true, maxCostPerRequestUsd: 0.408 };

/** Outfit A of the brief: store blazer, reference knit, store trousers, reference shoes. */
const outfitA = () => ({
  outfitId: "dinner_sharper_01",
  garmentIds: ["blazer", "knit", "trousers", "shoes"],
  spec: {
    garments: [
      { garmentId: "blazer", source: "shopify", slot: "top", layer: "outer", name: "The Telegraph Blazer", attributes: { subcategory: "blazer", colour: "navy", material: "wool" }, imageUrl: `${SHOP}/blazer.jpg`, retailerProductId: "p_blazer", retailerVariantId: "v_40R" },
      { garmentId: "knit", source: "reference", slot: "top", layer: "base", name: "anything the page says", referenceId: "ref_dinner_sharper_01_base" },
      { garmentId: "trousers", source: "shopify", slot: "bottom", name: "Telegraph Trouser", attributes: { subcategory: "trousers", colour: "grey" }, imageUrl: `${SHOP}/trousers.jpg`, retailerProductId: "p_trousers", retailerVariantId: "v_32" },
      { garmentId: "shoes", source: "reference", slot: "shoes", name: "x", referenceId: "ref_dinner_sharper_01_shoes" },
    ],
  },
});

/** Store photos stand in as flat swatches of each piece's colour, so the picture can be measured. */
const SWATCH: Record<string, string> = { blazer: "#1f2a44", trousers: "#7c7f84" };
const photos = vi.fn(async (url: string) => {
  const name = /\/(\w+)\.jpg$/.exec(url)?.[1] ?? "";
  const img = await sharp({ create: { width: 600, height: 800, channels: 3, background: SWATCH[name] ?? "#888888" } }).jpeg().toBuffer();
  return new Response(new Uint8Array(img), { status: 200, headers: { "content-type": "image/jpeg" } });
});
const fetcher = (async (url: string, init?: RequestInit) => (String(url).startsWith("https://cdn.shopify.com/") ? photos(String(url)) : fetch(url, init))) as typeof fetch;

let server: Server;
beforeAll(async () => {
  server = (await startFakeGemini(0)) as Server;
});
afterAll(() => server.close());
beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("GEMINI_API_BASE", `http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  vi.stubEnv("VISUALS_DIR", mkdtempSync(join(tmpdir(), "praxis-visuals-test-")));
  Object.assign(fake, { mode: "ok", calls: [], judged: 0, made: 0 });
  resetModels();
  resetBase();
  resetVisuals();
  photos.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("the spec the server will render", () => {
  it("keeps the store's own photos, replaces a reference by Praxis's record of it, and fixes the render", () => {
    const c = canonicalSpec(outfitA())!;
    expect(c.render).toEqual({ aspectRatio: "3:4", imageSize: "1K" });
    expect(c.garments[0]).toMatchObject({ source: "shopify", imageUrl: `${SHOP}/blazer.jpg`, retailerVariantId: "v_40R", attributes: { colour: "navy" } });
    expect(c.garments[1]).toMatchObject({ source: "reference", referenceId: "ref_dinner_sharper_01_base", name: "Navy fitted knit", layer: "base", attributes: { subcategory: "knit", colour: "navy" }, photo: { file: "/images/dinner_sharper_01.jpg" } });
  });

  it("accepts photos only from the store's image hosts, over https", () => {
    expect(photoHostAllowed(`${SHOP}/a.jpg`)).toBe(true);
    expect(photoHostAllowed("https://shop.myshopify.com/a.jpg")).toBe(true);
    expect(photoHostAllowed("http://cdn.shopify.com/a.jpg")).toBe(false);
    expect(photoHostAllowed("https://evil.example/a.jpg")).toBe(false);
    const a = outfitA();
    a.spec.garments[0].imageUrl = "https://evil.example/blazer.jpg";
    expect(canonicalSpec(a)!.garments[0].imageUrl).toBeUndefined();
  });

  it("never sends a photo of the customer's own piece, only its words", () => {
    const a = outfitA();
    a.spec.garments[0] = { garmentId: "own", source: "wardrobe", slot: "top", layer: "outer", name: "Your navy overshirt", imageUrl: `${SHOP}/own.jpg`, attributes: { colour: "navy" } } as never;
    expect(canonicalSpec(a)!.garments[0]).toEqual({ garmentId: "own", source: "wardrobe", slot: "top", layer: "outer", name: "Your navy overshirt", attributes: { colour: "navy" } });
  });

  it("refuses an unknown reference, a look without a top and trousers, and more than six pieces", () => {
    const bad = outfitA();
    bad.spec.garments[1].referenceId = "ref_nowhere_sharper_01_base";
    expect(canonicalSpec(bad)).toBeNull();
    expect(canonicalSpec({ ...outfitA(), spec: { garments: outfitA().spec.garments.filter((g) => g.slot !== "bottom") } })).toBeNull();
    expect(canonicalSpec({ ...outfitA(), spec: { garments: Array(7).fill(outfitA().spec.garments[0]) } })).toBeNull();
  });

  it("names each composition: another variant, photo, attribute or provider is another picture", () => {
    const key = imageKey(canonicalSpec(outfitA())!, engine);
    const changed = (f: (a: ReturnType<typeof outfitA>) => void) => {
      const a = outfitA();
      f(a);
      return imageKey(canonicalSpec(a)!, engine);
    };
    expect(imageKey(canonicalSpec(outfitA())!, engine)).toBe(key);
    expect(changed((a) => (a.spec.garments[0].retailerVariantId = "v_42R"))).not.toBe(key);
    expect(changed((a) => (a.spec.garments[0].imageUrl = `${SHOP}/blazer-v2.jpg`))).not.toBe(key);
    expect(changed((a) => (a.spec.garments[2].attributes = { subcategory: "trousers", colour: "beige" }))).not.toBe(key);
    expect(changed((a) => (a.spec.garments[3].referenceId = "ref_dinner_relaxed_01_shoes"))).not.toBe(key);
    expect(imageKey(canonicalSpec(outfitA())!, { ...engine, version: "other" })).not.toBe(key);
  });
});

describe("the request to the image model", () => {
  it("sends the model first, then each piece's own picture, named by number with its attributes", async () => {
    const pics = await piecePictures(canonicalSpec(outfitA())!, { fetcher });
    expect(pics.map((p: { from: string }) => p.from)).toEqual(["store photo", "reference photo", "store photo", "reference photo"]);
    expect(photos.mock.calls.map((c) => c[0])).toEqual([`${SHOP}/blazer.jpg`, `${SHOP}/trousers.jpg`]);
    const base = await sharp({ create: { width: 30, height: 40, channels: 3, background: "#c99a7c" } }).jpeg().toBuffer();
    const req = buildImageRequest(pics, base);
    const parts = req.contents[0].parts;
    expect(parts).toHaveLength(6);
    expect(parts[1].inlineData.data).toBe(base.toString("base64"));
    expect(parts[2].inlineData.data).toBe(pics[0].image!.toString("base64"));
    const text: string = parts[0].text;
    expect(text).toMatch(/Image 1 is the model/);
    expect(text).toMatch(/- outer layer, worn open over the base layer: The Telegraph Blazer \(navy wool blazer\)\. This is the piece in image 2/);
    expect(text).toMatch(/- base layer, worn under the outer layer: Navy fitted knit .*image 3/);
    expect(text).toMatch(/- trousers: Telegraph Trouser .*image 4/);
    expect(text).toMatch(/- shoes: .*image 5/);
    expect(text).toMatch(/top of his head to the soles of his shoes/);
    expect(req.generationConfig).toEqual({ responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "3:4", imageSize: "1K" } });
  });
});

describe("making the picture", () => {
  const go = (body = { requestId: "r1", anonymousSessionId: "anon_a", payload: outfitA() }) => {
    const before = beforeVisual(body, engine);
    expect(before.go).toBeTruthy();
    return { body, go: before.go! };
  };

  it("makes, checks and keeps a picture of exactly these pieces on the one model", async () => {
    const { body, go: g } = go();
    const out = await run(body, { visual: g, fetcher });
    expect(out.status).toBe("succeeded");
    expect(out.result).toMatchObject({ outfitId: "dinner_sharper_01", imageUrl: `/api/visuals/${g.key}.jpg`, generated: true, fidelity: "representative" });
    // The base model was made once in words (no file in the build), then the outfit: two pictures, one check.
    expect(fake.made).toBe(2);
    expect(fake.judged).toBe(1);
    const call = fake.calls[1];
    expect(call.images).toBe(5);
    expect(call.text).toMatch(/The Telegraph Blazer/);
    expect(call.text).toMatch(/Navy fitted knit/);
    expect(out.metadata.costUsd).toBeCloseTo(0.134 * 2 + 0.003, 4);
    const checks = out.result.checks as { check: string; ok: boolean; note?: string }[];
    expect(checks.every((c) => c.ok)).toBe(true);
    for (const c of ["shoes in frame", "head in frame", "same model", "layering", "the telegraph blazer: colour", "navy fitted knit: kind"]) expect(checks.map((x) => x.check)).toContain(c);
    const stored = readImage(g.key)!;
    expect((await sharp(stored).metadata()).width).toBe(768);

    // Kept: the same composition again is the cache, free; the same man is reused for the next look.
    afterVisual(body, engine, out, g);
    expect(beforeVisual(body, engine).answer?.metadata).toMatchObject({ cached: true, costUsd: 0 });
    const b = outfitA();
    b.spec.garments[2].retailerVariantId = "v_34";
    const second = go({ requestId: "r2", anonymousSessionId: "anon_a", payload: b });
    expect(second.go.key).not.toBe(g.key);
    await run(second.body, { visual: second.go, fetcher });
    expect(fake.made).toBe(3);
  });

  it("refuses a picture with the shoes left out, after asking once more with what was wrong", async () => {
    fake.mode = "missing_shoes";
    const { body, go: g } = go();
    const out = await run(body, { visual: g, fetcher });
    expect(out).toMatchObject({ status: "failed", error: { code: "validation_error", retryable: true } });
    expect(fake.made).toBe(3);
    expect(fake.calls[2].text).toMatch(/The last attempt got these wrong; fix them: shoes in frame/);
    expect(out.result.checks.filter((c: { ok: boolean }) => !c.ok).map((c: { check: string }) => c.check)).toEqual(expect.arrayContaining(["shoes in frame", expect.stringMatching(/: worn$/)]));
    expect(readImage(g.key)).toBeNull();
  });

  it("refuses a picture whose pieces are the wrong colour", async () => {
    fake.mode = "wrong_colour";
    const { body, go: g } = go();
    const out = await run(body, { visual: g, fetcher });
    expect(out.status).toBe("failed");
    expect(out.result.checks.find((c: { check: string }) => c.check === "the telegraph blazer: colour")).toMatchObject({ ok: false, note: expect.stringMatching(/wanted navy, measured red, seen red/) });
  });

  it("says plainly when the key's Google project has no billing for pictures", async () => {
    fake.mode = "billing";
    const { body, go: g } = go();
    const out = await run(body, { visual: g, fetcher });
    expect(out).toMatchObject({ status: "failed", error: { code: "billing_required", retryable: false } });
    expect(out.metadata.costUsd).toBe(0);
  });

  it("stays inside the approved budget, setting aside the most a request can cost", () => {
    vi.stubEnv("OUTFIT_IMAGE_BUDGET_USD", "1");
    expect(approval(engine)).toMatchObject({ approved: true, remainingUsd: 1 });
    const first = go();
    const second = go({ requestId: "r2", anonymousSessionId: "anon_b", payload: { ...outfitA(), outfitId: "work_safest_01" } });
    expect(approval(engine).approved).toBe(false);
    expect(beforeVisual({ requestId: "r3", anonymousSessionId: "anon_c", payload: { ...outfitA(), outfitId: "date_safest_01" } }, engine).answer?.error.code).toBe("budget_reached");
    afterVisual(first.body, engine, { status: "failed", metadata: { costUsd: 0.27 } }, first.go);
    afterVisual(second.body, engine, { status: "failed", metadata: { costUsd: 0.27 } }, second.go);
    expect(ledger.spentUsd).toBe(0.54);
    expect(approval(engine).approved).toBe(true);
  });
});
