/** Suite 10: the seven screen sizes from the Phase 3 brief, each across the main states of the app. */
import { heroOf, noSideways } from "./lib.mjs";

const VIEWPORTS = {
  "375x812": { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  "390x844": { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  "430x932": { viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  "768x1024": { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  "1024x768": { viewport: { width: 1024, height: 768 }, hasTouch: true, deviceScaleFactor: 2 },
  "1440x900": { viewport: { width: 1440, height: 900 } },
  "1920x1080": { viewport: { width: 1920, height: 1080 } },
};

/** Layout problems on the page as it stands. */
function audit(p) {
  return p.evaluate(() => {
    const vw = innerWidth;
    const vh = innerHeight;
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0 && !el.closest("[aria-hidden=true], .sr-only, [inert]");
    };
    const name = (el) => (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().replace(/\s+/g, " ").slice(0, 32);
    // With a dialog open, only its own controls count: the page behind it is meant to be covered.
    const dialog = [...document.querySelectorAll("[role=dialog]")].filter(visible).pop();
    const scope = dialog ?? document;
    const controls = [...scope.querySelectorAll("button, a[href], [role=radio], input:not([type=hidden]):not(.sr-only), [role=checkbox]")].filter(visible);
    const offscreen = controls.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.left < -1 || r.right > vw + 1;
    });
    // Covered: a control whose centre belongs to something else (not itself, a child or a parent label),
    // even once it is scrolled to the middle of the screen. Content passing under a sticky bar is fine.
    const hidden = (el) => {
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > vh || r.left < 0 || r.right > vw) return false;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit && !el.contains(hit) && !hit.contains(el) && !hit.closest("label")?.contains(el);
    };
    const covered = controls.filter(hidden).filter((el) => {
      el.scrollIntoView({ block: "center", inline: "nearest" });
      return hidden(el);
    });
    scrollTo(0, 0);
    const small = controls.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.height < 43.5 && r.width < 43.5;
    });
    const texts = [...scope.querySelectorAll("h1, h2, h3, p, li, span, label, button, a")].filter((el) => visible(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    const clipped = texts.filter((el) => {
      const s = getComputedStyle(el);
      const hides = /hidden|clip/.test(s.overflowX) || /hidden|clip/.test(s.overflow);
      return hides && s.textOverflow !== "ellipsis" && el.scrollWidth > el.clientWidth + 2;
    });
    const outside = texts.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.right > vw + 1 || r.left < -1;
    });
    // Small capitals (the house labels) are set at 11px by design; everything else is 12px or more.
    const tiny = texts.filter((el) => {
      const s = getComputedStyle(el);
      return parseFloat(s.fontSize) < (s.textTransform === "uppercase" ? 11 : 12);
    });
    const dialogs = [...document.querySelectorAll("[role=dialog]")].filter(visible).length;
    return {
      sideways: document.documentElement.scrollWidth > vw + 1,
      offscreen: offscreen.map(name),
      covered: covered.map(name),
      small: small.map(name),
      clipped: clipped.map(name),
      outside: outside.map(name),
      tiny: tiny.map(name),
      dialogs,
    };
  });
}

export default async function (H) {
  const { BASE, scenario, check, button, toResults, A, history } = H;

  for (const [size, viewport] of Object.entries(VIEWPORTS)) {
    const touch = viewport.viewport.width <= 768;
    await scenario("P3-10", `Every main screen at ${size}: no sideways scroll, nothing clipped, covered or too small`, size, async (p, shot) => {
      const look = async (label) => {
        await p.waitForTimeout(700);
        const a = await audit(p);
        const list = (xs) => (xs.length ? xs.slice(0, 4).join(", ") : "none");
        check(!a.sideways, `${label}: no sideways scroll`);
        check(a.offscreen.length === 0 && a.outside.length === 0, `${label}: everything inside the screen (${list([...a.offscreen, ...a.outside])})`);
        check(a.clipped.length === 0, `${label}: no clipped text (${list(a.clipped)})`);
        check(a.covered.length === 0, `${label}: no control hidden under another (${list(a.covered)})`);
        check(a.small.length === 0, `${label}: controls at least 44px (${list(a.small)})`);
        check(a.tiny.length === 0, `${label}: text at least 12px (${list(a.tiny)})`);
        check(a.dialogs <= 1, `${label}: at most one dialog open (${a.dialogs})`);
        await shot(label);
      };
      await p.goto(`${BASE}/?mode=light`);
      await p.waitForTimeout(800);
      await look("home");
      await p.goto(`${BASE}/moment/venue?mode=light&occasion=DINNER`);
      await look("question");
      await toResults(p, A);
      await look("results");
      const first = heroOf(p);
      if (touch) {
        const print = p.locator("[aria-label^='View ']").first();
        const box = await print.boundingBox();
        const y = box.y + box.height / 2;
        await p.mouse.move(box.x + box.width * 0.8, y);
        await p.mouse.down();
        for (let i = 1; i <= 8; i++) await p.mouse.move(box.x + box.width * (0.8 - i * 0.07), y);
        await p.mouse.up();
      } else {
        await button(p, "Next look").click();
      }
      await p.waitForTimeout(700);
      const ids = (await history(p))[0].response.outfits.map((o) => o.outfitId);
      check(heroOf(p) !== first && ids.includes(heroOf(p)), `${touch ? "a swipe" : "the Next arrow"} moves to another look`);
      await p.locator("[aria-label^='View ']").first().click();
      await p.waitForTimeout(700);
      const img = await p.getByRole("dialog").locator("img").first().boundingBox();
      const centre = img.x + img.width / 2;
      check(Math.abs(centre - viewport.viewport.width / 2) <= 2 && img.height <= viewport.viewport.height + 1, `the viewer's photo is centred and fits the height (${Math.round(img.width)}x${Math.round(img.height)}; a photo wider than the screen crops evenly, by design)`);
      await look("viewer");
      await button(p, "Close").click();
      await p.waitForTimeout(400);
      await button(p, /^Check out/).click();
      await look("check-out");
      await p.keyboard.press("Escape");
      await button(p, /^Share/).click();
      await look("share");
      await p.keyboard.press("Escape");
      await button(p, /^Restyle/).click();
      await look("restyle");
      await p.keyboard.press("Escape");
      await p.waitForTimeout(300);
      await button(p, /See it on me/).click();
      await p.waitForURL(/moment\/tryon/);
      await look("try-on");
      await p.goto(`${BASE}/dna/face?mode=light`);
      await look("style-dna");
      await p.goto(`${BASE}/data?mode=light`);
      await look("your-data");
      if (touch) {
        await p.goto(`${BASE}/?mode=light`);
        await p.getByRole("button", { name: "Menu" }).click();
        await look("menu");
      }
      check(await noSideways(p), "still no sideways scroll at the end");
    }, { viewport, premium: true });
  }
}
