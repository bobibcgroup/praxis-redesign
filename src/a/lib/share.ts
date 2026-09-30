/** Share the current look: the native sheet when there is one, else a quiet copy. */
export type ShareOutcome = "shared" | "copied" | "failed";

export async function shareLook(title: string, url: string): Promise<ShareOutcome> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch {
      // The user closed the sheet or the platform refused; fall through to copy.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}
