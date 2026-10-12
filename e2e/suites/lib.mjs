/** Small helpers shared by the suites. Not a suite itself (suites are the numbered files). */

/** The newest styling request and response on the device. */
export const latest = async (H, p) => (await H.history(p))[0];

/** The look in the address, or the first one. */
export const heroOf = (p) => new URL(p.url()).searchParams.get("hero");

/** A dollar amount in text, such as "$1,240". */
export const dollars = (t) => Number(String(t).replace(/[^0-9.]/g, ""));

/** Waits for the try-on page to reach a step. */
export const toStep = (p, name, timeout = 8000) =>
  p.waitForFunction((n) => document.querySelector("[data-tryon-step]")?.getAttribute("data-tryon-step") === n, name, { timeout });

/** Nothing scrolls sideways. */
export const noSideways = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/** The visible pieces of the look in front: name and price text. */
export const pieces = (p) =>
  p.locator(".a-piece").filter({ visible: true }).evaluateAll((els) => els.map((e) => ({ name: e.querySelector(".name")?.textContent?.trim(), price: e.querySelector(".a-mono")?.textContent?.trim(), pick: e.classList.contains("a-pick") })));

/** The photo of the look in front. */
export const printSrc = (p) => p.locator(".a-canvas img").filter({ visible: true }).first().getAttribute("src");

/** Uploads a file through the next file chooser, after a click. */
export async function upload(p, click, file) {
  const chooser = p.waitForEvent("filechooser", { timeout: 5000 });
  await click();
  await (await chooser).setFiles(file);
}

/** A file that is not a picture. */
export const textFile = { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not a photo") };
/** A file that says it is a JPEG but is not. */
export const brokenJpeg = { name: "broken.jpg", mimeType: "image/jpeg", buffer: Buffer.from("this is not really a jpeg file at all") };

/** Events of one name. */
export const named = (ev, n) => ev.filter((e) => e.eventName === n);
