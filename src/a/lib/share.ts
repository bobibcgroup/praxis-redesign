/** Sharing a look: as a story image, as a link to ask a friend, or a quiet copy. */
export type ShareOutcome = "shared" | "copied" | "saved" | "cancelled" | "failed";

function canShareFiles(file: File): boolean {
  return typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
}

/** How a shared link left the app. Kept on the link so the visitor sees the shared view and analytics can count it. */
export type ShareChannel = "story" | "friend" | "link";

/** Params a shared link carries; a fresh journey drops them. */
export const SHARE_PARAMS = ["via", "utm_source", "utm_medium", "utm_campaign"] as const;

/** The current looks as a link for someone else: no open gate or completion state, tagged with the channel. */
export function sharedUrl(channel: ShareChannel, href = window.location.href): string {
  const url = new URL(href);
  url.searchParams.delete("gate");
  url.searchParams.delete("done");
  url.searchParams.set("via", channel);
  url.searchParams.set("utm_source", "praxis");
  url.searchParams.set("utm_medium", channel === "story" ? "story" : "referral");
  url.searchParams.set("utm_campaign", "shared_look");
  return url.toString();
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The image to the phone's share sheet (Instagram, WhatsApp, Messages); on a computer it saves instead. */
export async function shareImage(blob: Blob, name: string, text: string, url: string): Promise<ShareOutcome> {
  const file = new File([blob], name, { type: "image/png" });
  if (canShareFiles(file)) {
    try {
      await navigator.share({ files: [file], text: `${text} ${url}` });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    }
  }
  download(blob, name);
  return "saved";
}

/** A link with a question: the native sheet on a phone, WhatsApp on a computer. */
export async function askFriend(text: string, url: string): Promise<ShareOutcome> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ text, url });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener");
  return "shared";
}

export async function copyLink(url: string): Promise<ShareOutcome> {
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

/** Kept for callers that only need a link. */
export async function shareLook(title: string, url: string): Promise<ShareOutcome> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch {
      // Closed or refused; fall through to copy.
    }
  }
  return copyLink(url);
}
