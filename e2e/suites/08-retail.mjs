/** Suite 8: pieces, sizes, stock and Check out. No purchase can complete; a real retailer link opens only when one exists. */
import { dollars, named } from "./lib.mjs";

export default async function (H) {
  const { BASE, scenario, check, body, button, events, lab, toResults, A } = H;

  for (const device of ["desktop", "phone"]) {
    await scenario("P3-8a", "Check out: sizes, stock said plainly, the total in dollars, and no fake purchase", device, async (p, shot) => {
      const popups = [];
      p.on("popup", (w) => popups.push(w.url()));
      await toResults(p, A);
      await button(p, /^Check out/).click();
      await p.waitForTimeout(600);
      const sheet = p.getByRole("dialog", { name: "Check out" });
      const items = sheet.getByRole("listitem");
      const n = await items.count();
      const prices = await items.locator(".a-mono").allInnerTexts();
      const total = dollars(await sheet.locator(".a-mono.text-\\[17px\\]").innerText());
      check(n >= 3 && prices.every((x) => /^\$\d/.test(x)), `${n} pieces, each priced in dollars`);
      check(total === prices.reduce((s, x) => s + dollars(x), 0), `the total ($${total}) is the sum of the pieces`);
      const group = sheet.getByRole("group").first();
      const size = group.getByRole("button").nth(1);
      const label = (await size.innerText()).trim();
      await size.click();
      check((await size.getAttribute("aria-pressed")) === "true", `a size can be chosen (${label})`);
      check(named(await events(p), "size_selected").some((e) => e.properties.size === label), "the size is recorded");
      const t = await sheet.innerText();
      check(/Stock not confirmed/.test(t) && /Prices are examples/.test(t), "stock and prices are said to be unconfirmed examples");
      const buy = sheet.getByRole("button", { name: /Buying isn’t open yet/ });
      check((await buy.count()) === 1 && (await buy.isDisabled()) && /example pieces, so they can’t be bought yet/.test(t), "buying is off, and says why");
      check((await sheet.getByRole("button", { name: /^Purchase|^Buy at|^Pay/ }).count()) === 0 && popups.length === 0, "no purchase or retailer link is offered");
      check(named(await events(p), "checkout_initiated").some((e) => e.properties.total === total && e.properties.priceStatus === "example"), "Check out is recorded with its total and that prices are examples");
      check(!/Order placed|Thank you for your order|Purchase complete/i.test(await body(p)), "no order is ever said to be placed");
      await shot("checkout");
    });
  }

  await scenario("P3-8b", "When a retailer link exists, a size is needed first, then it opens the retailer's own page", "desktop", async (p, shot) => {
    await toResults(p, A);
    await button(p, /^Save/).click();
    await p.waitForTimeout(700);
    /* Fixture: the saved look's first piece as a real retailer would list it. */
    await p.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("praxis_lab_a"));
      const piece = s.looks[0].look.pieces.find((x) => !x.owned);
      Object.assign(piece, { purchase: { kind: "retailer_site", url: "https://retailer.example/products/e2e-piece" }, priceStatus: "live", availability: "in_stock", sizes: ["S", "M", "L"], sizeAvailability: { S: "in_stock", M: "out_of_stock", L: "in_stock" }, deliveryEstimate: "2 to 4 days" });
      localStorage.setItem("praxis_lab_a", JSON.stringify(s));
    });
    await p.context().route("https://retailer.example/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>Retailer</title>retailer page" }));
    const id = (await lab(p)).looks[0].id;
    await p.goto(`${BASE}/looks/${id}?mode=light`);
    await p.waitForTimeout(800);
    await button(p, /^Check out/).click();
    await p.waitForTimeout(600);
    const sheet = p.getByRole("dialog", { name: "Check out" });
    const buy = sheet.getByRole("button", { name: /^Buy at/ });
    check((await buy.count()) === 1 && (await buy.isDisabled()), "Buy at the retailer waits for a size");
    await sheet.getByRole("button", { name: "M", exact: true }).click();
    check(/Size M is sold out/.test(await sheet.innerText()) && (await buy.isDisabled()), "a sold-out size cannot be bought");
    await sheet.getByRole("button", { name: "L", exact: true }).click();
    check(/Size L in stock/.test(await sheet.innerText()) && !(await buy.isDisabled()), "an in-stock size can");
    await shot("retailer");
    const [popup] = await Promise.all([p.waitForEvent("popup"), buy.click()]);
    await popup.waitForLoadState().catch(() => {});
    check(popup.url() === "https://retailer.example/products/e2e-piece", "it opens the retailer's page, in a new tab");
    check(named(await events(p), "retailer_redirected").some((e) => e.properties.route === "retailer_site"), "the hand-off is recorded");
    check(!/Order placed|Purchase complete/i.test(await body(p)), "Praxis never says the order is placed");
    await popup.close();
  });

  await scenario("P3-8c", "An unsafe retailer link in stored data is never followed", "desktop", async (p) => {
    await toResults(p, A);
    await button(p, /^Save/).click();
    await p.waitForTimeout(700);
    await p.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("praxis_lab_a"));
      const piece = s.looks[0].look.pieces.find((x) => !x.owned);
      Object.assign(piece, { purchase: { kind: "retailer_site", url: "javascript:alert(1)" } });
      localStorage.setItem("praxis_lab_a", JSON.stringify(s));
    });
    const id = (await lab(p)).looks[0].id;
    await p.goto(`${BASE}/looks/${id}?mode=light`);
    await p.waitForTimeout(800);
    await button(p, /^Check out/).click();
    await p.waitForTimeout(600);
    check((await p.getByRole("dialog", { name: "Check out" }).getByRole("button", { name: /^Buy at/ }).count()) === 0, "no Buy button for a link that is not https");
  });
}
