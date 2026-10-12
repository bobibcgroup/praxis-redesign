/**
 * Suite 14: the hybrid catalogue in the browser. Its own app server reads a stand-in Shopify store
 * (e2e/fixtures/test-store.mjs), so the looks come out mixed: store pieces where they fit, Praxis
 * references for the rest, one picture per look from the mock visualization.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PHOTO_HOST, startTestStore } from "../fixtures/test-store.mjs";
import { heroOf, pieces, printSrc } from "./lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const APP_PORT = 4176;
const STORE_PORT = 4198;
const APP = `http://127.0.0.1:${APP_PORT}`;
const PHOTO = readFileSync(join(here, "..", "..", "public", "images", "dinner_sharper_01.jpg"));

/** Whether this run includes suite 14 (SUITE=14, an ONLY list naming its scenarios, or everything). */
function wanted() {
  if (process.env.ONLY) return process.env.ONLY.split(",").some((id) => id.startsWith("P5-14"));
  if (process.env.SUITE) return process.env.SUITE.split(",").map(Number).includes(14);
  return true;
}

export default async function (H) {
  if (!wanted()) return;
  const { scenario, check, button, history } = H;
  const store = await startTestStore(STORE_PORT);
  const app = spawn("node", ["server/index.mjs"], { cwd: join(here, "..", ".."), stdio: "ignore", env: { ...process.env, PORT: String(APP_PORT), RETAIL_SHOPIFY_STORE: `127.0.0.1:${STORE_PORT}`, GEMINI_API_KEY: "", AI_PROVIDER_OUTFIT_VISUALIZATION: "" } });
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`${APP}/api/ai`)).ok) break;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  const mode = (m) => fetch(`http://127.0.0.1:${STORE_PORT}/__mode`, { method: "POST", body: m });

  /** The results for Dinner, Restaurant, Night, Sharp, $300 to $900, in a tab that asked for the test store. */
  async function hybridResults(p, { stock = true } = {}) {
    // The store's photos: two answer with a picture, the rest are missing.
    // A missing photo answers with something that isn't a picture, as a broken store image would.
    await p.route(`${PHOTO_HOST}/**`, (r) => r.fulfill({ status: 200, contentType: "image/jpeg", body: /missing/.test(r.request().url()) ? "not a picture" : PHOTO }));
    const calls = [];
    p.on("request", (r) => {
      const u = r.url();
      if (u.startsWith(`${APP}/api/ai/`)) calls.push({ service: u.split("/api/ai/")[1], body: r.postData() ?? "" });
    });
    await p.goto(`${APP}/?mode=light${stock ? "&stock=live" : ""}`);
    await p.getByRole("radio", { name: "Dinner" }).first().click();
    for (const name of [/Restaurant/, /Night/, /Sharp/, /\$300 to/]) {
      await p.waitForTimeout(650);
      await p.getByRole("radio", { name }).first().click();
    }
    await p.waitForURL(/moment\/results/, { timeout: 20000 });
    await p.waitForTimeout(1500);
    return calls;
  }
  const look = (p, n) => p.locator(".a-thumb").filter({ visible: true }).nth(n);

  // Run first, while the store is down: the looks still come, as examples, and say why in the history.
  await scenario("P5-14e", "Store down: the looks still come, with example pieces, and nothing breaks", "desktop", async (p) => {
    await mode("down");
    await hybridResults(p);
    const h = (await history(p))[0];
    check(h?.response?.outfits?.length === 3, "three looks");
    check(h?.response?.fallback?.code === "store_unavailable", "the response says the store couldn't be read");
    check(!(await p.locator(".a-piece[data-reference]").count()), "no references stand in for a store that wasn't read");
    await mode("up");
  });

  for (const device of ["desktop", "phone"]) {
    await scenario("P5-14a", "Mixed looks: store pieces where they fit, references for the rest, one picture per look", device, async (p, shot) => {
      const calls = await hybridResults(p);
      const h = (await history(p))[0];
      const outfits = h.response.outfits;
      check(outfits.length === 3, "three looks");
      const sources = Object.fromEntries(outfits.map((o) => [o.outfitId, o.garments.map((g) => g.source).join(",")]));
      check(sources.dinner_sharper_01 === "retail,retail,reference,reference", `sharper: blazer and knit from the store, trousers and boots referenced (${sources.dinner_sharper_01})`);
      check(sources.dinner_safest_01 === "retail,retail,retail", `classic: all from the store (${sources.dinner_safest_01})`);
      check(sources.dinner_relaxed_01 === "reference,retail,retail,retail", `relaxed: olive overshirt refused for the blue one (${sources.dinner_relaxed_01})`);
      check(outfits.every((o) => o.visualization.status === "mock" && o.visualization.outfitId === o.outfitId && o.visualization.url === `/images/${o.outfitId}.jpg`), "each look's picture is the mock for its own outfit");
      check(outfits.every((o) => o.visualization.sourceGarmentIds.join() === o.garments.map((g) => g.garmentId).join()), "each picture names exactly its look's pieces");
      const retail = outfits.flatMap((o) => o.garments.filter((g) => g.source === "retail"));
      check(retail.every((g) => g.product.productId.startsWith("shopify_127.0.0.1") && g.product.priceStatus === "live" && g.product.availableSizes?.length), "store pieces keep the store's ids, live prices and sizes");
      check(outfits.flatMap((o) => o.garments.filter((g) => g.source === "reference")).every((g) => !("product" in g) && !/price|purchase/.test(JSON.stringify(g))), "references carry no price or link");

      // The page: the pick is the sharper look.
      const rows = await pieces(p);
      check(rows.map((r) => r.name).join("|") === "Wool Blazer in Charcoal|Merino Crew in Navy|Black tailored trousers|Black leather Chelsea boots", `the pieces in order (${rows.map((r) => r.name).join("|")})`);
      check(rows.filter((r) => r.pick).length === 2 && rows.filter((r) => r.price === "Reference").length === 2, "two to buy, two references without a price or a box");
      const text = await p.locator("body").innerText();
      check(/Available to shop, 2 pieces\s*\$496/i.test(text), "Available to shop: $496 for the two store pieces");
      check(/Styling references\s*2 pieces/i.test(text), "the references counted apart");
      check(/Only the store’s pieces can be bought here/.test(text), "says only the store's pieces can be bought");
      check(/Styling visualization\. Product details may vary\./.test(text), "the picture is marked as a styling visualization");
      const where = await p.evaluate(() => {
        const note = [...document.querySelectorAll(".a-print-note")].find((n) => n.getClientRects().length);
        const print = note?.closest(".a-frame-room, [data-bleed]")?.getBoundingClientRect();
        const box = note?.getBoundingClientRect();
        return box && print ? (box.top - print.top) / print.height : -1;
      });
      check(where > 0.5, "the note sits low on the print, clear of the face");
      check((await printSrc(p)) === "/images/dinner_sharper_01.jpg", "the print shows the look's picture");
      check((await button(p, /^Check out/).textContent()).includes("$496"), "Check out counts only the store pieces");

      // Only free, allowed calls: the store search once, no picture or paid service.
      check(calls.length === 1 && calls[0].service === "product_matching", `one call, the store search (${calls.map((c) => c.service).join(", ")})`);
      const sent = JSON.parse(calls[0]?.body || "{}");
      check(sent.payload?.garments?.every((g) => Object.keys(g).every((k) => ["garmentId", "slot", "layer", "name", "subcategory", "colour", "formality"].includes(k))), "the store search gets only the parts");
      check(!JSON.stringify(sent.payload ?? {}).includes(sent.anonymousSessionId ?? "@@"), "and nothing about the customer");
      await shot("mixed");
    });
  }

  await scenario("P5-14b", "Check out offers only the store pieces; references never enter it", "desktop", async (p, shot) => {
    await hybridResults(p);
    await button(p, /^Check out/).click();
    await p.waitForTimeout(600);
    const sheet = await p.getByRole("dialog").innerText();
    check(/Wool Blazer in Charcoal/.test(sheet) && /Merino Crew in Navy/.test(sheet), "the store pieces are there");
    check(!/Chelsea boots|tailored trousers/i.test(sheet), "the references are not");
    check(/My 2 reference pieces aren’t included; they aren’t for sale here\./.test(sheet), "and it says why");
    check((await p.getByRole("button", { name: /Buy at Test Tailors/ }).count()) === 2, "a Buy at the store button per piece");
    await shot("checkout");
  });

  await scenario("P5-14c", "Each store piece keeps its own product photo; a missing photo hides, never breaks", "desktop", async (p, shot) => {
    await hybridResults(p);
    const blazer = p.getByRole("button", { name: "See the photo of Wool Blazer in Charcoal" });
    check(await blazer.isVisible(), "the blazer's own photo is on its row");
    await blazer.click();
    await p.waitForTimeout(500);
    const dialog = p.getByRole("dialog");
    check(/Test Tailors’s own photo of this piece/.test(await dialog.innerText()), "opens the store's photo, said to be theirs");
    check(/^https:\/\/127\.0\.0\.1:4198\/products\/wool-blazer-in-charcoal$/.test((await dialog.getByRole("link", { name: /See it at Test Tailors/ }).getAttribute("href")) ?? ""), "with a link to the piece at the store");
    await shot("store-photo");
    await p.keyboard.press("Escape");
    await p.waitForTimeout(400);
    await look(p, 2).click();
    await p.waitForTimeout(900);
    const broken = await p.evaluate(() => [...document.querySelectorAll(".a-piece img")].filter((i) => i.complete && i.naturalWidth === 0 && i.offsetParent !== null).length);
    check(broken === 0, "no broken picture shows on the relaxed look (the sneaker's photo is missing)");
    check(!(await p.getByRole("button", { name: "See the photo of White Leather Sneaker" }).isVisible().catch(() => false)), "the sneaker shows no photo button");
    const ref = p.getByRole("button", { name: "See the reference for Light blue overshirt" });
    check(await ref.isVisible(), "the reference shows its part of the library photograph");
    await ref.click();
    await p.waitForTimeout(500);
    check(/My styling reference.*isn’t for sale here/.test(await p.getByRole("dialog").innerText()), "and says it isn't for sale");
  });

  await scenario("P5-14d", "Moving between mixed looks keeps each look's pieces, prices and picture; Save, Share and zoom work", "phone", async (p, shot) => {
    await p.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: APP });
    await hybridResults(p);
    await look(p, 1).click();
    await p.waitForTimeout(900);
    check(heroOf(p) === "dinner_safest_01", "the classic look");
    let rows = await pieces(p);
    check(rows.every((r) => r.pick) && rows.length === 3, "all three from the store, each with a box");
    check(!(await p.locator(".a-total-references").count()), "no references line when there are none");
    check((await printSrc(p)) === "/images/dinner_safest_01.jpg", "its own picture");
    await look(p, 0).click();
    await p.waitForTimeout(900);
    rows = await pieces(p);
    check(rows.filter((r) => r.price === "Reference").length === 2, "back on the sharper look, its two references");
    await p.locator(".a-enlarge").first().click();
    await p.waitForTimeout(700);
    check(await p.getByRole("dialog").isVisible(), "the picture opens large");
    await p.keyboard.press("Escape");
    await p.waitForTimeout(500);
    await button(p, /^Share$/).click();
    await p.waitForTimeout(500);
    check(await p.getByRole("dialog").isVisible(), "Share opens");
    await p.keyboard.press("Escape");
    await p.waitForTimeout(500);
    await button(p, /^Save/).click();
    await p.waitForTimeout(700);
    const saved = JSON.stringify(await H.lab(p));
    check(saved.includes("Black leather Chelsea boots") && saved.includes('"reference":true'), "Save keeps the look with its references marked");
    await shot("phone");
  });

  await scenario("P5-14f", "A visitor who didn't ask for the test store sees the example looks, unchanged", "desktop", async (p) => {
    const calls = await hybridResults(p, { stock: false });
    const h = (await history(p))[0];
    check(h.response.outfits.every((o) => o.garments.every((g) => g.source === "retail" && g.product.priceStatus === "example")), "example pieces only");
    check(h.response.outfits.every((o) => o.visualization.provider === "praxis-library" && o.visualization.status === "ready"), "the library photographs, as before");
    check(calls.length === 0, "no store search");
    check(!(await p.locator(".a-piece[data-reference]").count()), "no references");
  });

  app.kill();
  await new Promise((r) => store.close(r));
}
