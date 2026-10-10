/**
 * The living print. Images crossfade inside it; the night veil, the camera
 * preview and the try-on wipe are layers; whatever sits under it (progress
 * line, thumbnails, caption) is part of the same block so the print sizes
 * itself around them and never outgrows the column.
 */
import type { CSSProperties, KeyboardEventHandler, ReactNode, RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";

export interface FrameProps {
  image: string | null;
  alt: string;
  /** Muted slices shown while the print is empty. */
  preview?: readonly { image: string }[];
  night?: boolean;
  /** Sunrise or sunset: a low warm light over the print. */
  golden?: "SUNRISE" | "SUNSET" | null;
  liveRef?: RefObject<HTMLVideoElement>;
  live?: boolean;
  overlay?: ReactNode;
  reduced: boolean;
  /** Rows under the print: progress line, thumbnails, caption. */
  below?: ReactNode;
  /** Height reserved under the print, in px, so the print never pushes them out. */
  belowHeight?: number;
  /** On desktop, run the print full bleed and hide what sits under it (the overlay carries it instead). */
  bleedDesktop?: boolean;
  /** A result page: the print keeps its hard lookbook edge instead of fading into the page. */
  book?: boolean;
  /** Beside the print on a phone or tablet instead of under it (the three looks on the results). */
  aside?: ReactNode;
  /**
   * Moving between looks: the new photo glides in from the side it came from (dir) over a short
   * crossfade, and mid-swipe the photo follows the finger (drag, in px).
   */
  swap?: { dir: number; drag: number };
  /** Names the print and its looks as one group, for keys that move between them. */
  label?: string;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
}

const FADE = { duration: 0.7, ease: "easeInOut" as const };
const SWAP = { duration: 0.3, ease: [0.22, 0.61, 0.36, 1] as const };
const SWAP_SHIFT = 32;

export function Frame({ image, alt, preview, night = false, golden = null, liveRef, live = false, overlay, reduced, below, belowHeight = 0, bleedDesktop = false, book = false, aside, swap, label, onKeyDown }: FrameProps) {
  const fade = reduced ? { duration: 0 } : FADE;
  const style = { "--below": `${belowHeight}px` } as CSSProperties;
  const framed = Boolean(below || aside);
  const shift = reduced ? 0 : SWAP_SHIFT * (swap?.dir ?? 0);

  return (
    <div
      className="a-frame-room"
      data-bleed={framed ? (bleedDesktop ? "desktop" : undefined) : "always"}
      data-book={book ? "" : undefined}
      data-aside={aside ? "" : undefined}
      role={label ? "group" : undefined}
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      <div className="a-print" style={style}>
        <div className="a-frame">
          <div className="relative h-full w-full overflow-hidden bg-[var(--surface)]">
            <AnimatePresence initial={false} custom={shift}>
              {preview && !image && !live && (
                <motion.div
                  key="preview"
                  aria-hidden
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={fade}
                  className="absolute inset-0 grid grid-cols-5 gap-1 bg-[var(--bg)]"
                >
                  {preview.map((slice) => (
                    <img key={slice.image} src={slice.image} alt="" className="h-full w-full object-cover object-top opacity-55" draggable={false} />
                  ))}
                </motion.div>
              )}
              {image && !live && swap ? (
                <motion.img
                  key={image}
                  src={image}
                  alt={alt}
                  custom={shift}
                  /* Leaves from where the swipe let go, onward the same way, on its own timing. */
                  variants={{ leave: (s: number, now: { x?: string | number }) => ({ opacity: 0, x: Number(now.x ?? 0) - s, transition: reduced ? { duration: 0 } : SWAP }) }}
                  initial={{ opacity: 0, x: shift }}
                  animate={{ opacity: 1, x: swap.drag }}
                  exit="leave"
                  transition={reduced ? { duration: 0 } : swap.drag !== 0 ? { x: { duration: 0 }, opacity: SWAP } : SWAP}
                  className="absolute inset-0 h-full w-full object-cover object-top"
                  draggable={false}
                />
              ) : image && !live ? (
                <motion.img
                  key={image}
                  src={image}
                  alt={alt}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={fade}
                  className="absolute inset-0 h-full w-full object-cover object-top"
                  draggable={false}
                />
              ) : null}
            </AnimatePresence>

            {!image && !preview && !live ? (
              <div aria-hidden className="absolute inset-0 grid place-items-center">
                <div className="a-guide" />
              </div>
            ) : null}

            {liveRef && (
              <video
                ref={liveRef}
                playsInline
                muted
                autoPlay
                aria-label="Camera preview"
                className={`absolute inset-0 h-full w-full object-cover ${live ? "opacity-100" : "opacity-0"}`}
                style={{ transform: "scaleX(-1)" }}
              />
            )}

            <motion.div aria-hidden initial={false} animate={{ opacity: night ? 0.38 : 0 }} transition={fade} className="pointer-events-none absolute inset-0 bg-[#0b0d10]" />
            <motion.div
              aria-hidden
              initial={false}
              animate={{ opacity: golden === "SUNSET" ? 0.5 : golden === "SUNRISE" ? 0.4 : 0 }}
              transition={fade}
              className="pointer-events-none absolute inset-0 mix-blend-soft-light"
              style={{ background: golden === "SUNRISE" ? "linear-gradient(180deg, #ffd9a8 0%, #f6b98a 55%, #c98a6a 100%)" : "linear-gradient(180deg, #f2a65a 0%, #d9714a 60%, #7a3b2e 100%)" }}
            />

            {overlay}
          </div>
        </div>
        {below}
      </div>
      {aside ? <div className="a-aside">{aside}</div> : null}
    </div>
  );
}

/** One continuous 2 px line under the print while a build runs. */
export function ProgressLine({ progress, label, reduced }: { progress: number; label: string; reduced: boolean }) {
  return (
    <div className="a-line" role="img" aria-label={label}>
      <motion.div initial={false} animate={{ scaleX: progress }} transition={{ duration: reduced ? 0 : 0.2, ease: "linear" }} />
    </div>
  );
}

export function FrameCaption({ children }: { children: ReactNode }) {
  return <p className="-mx-10 mt-2 whitespace-nowrap text-center text-[13px] leading-5 text-[var(--muted)] lg:mx-0">{children}</p>;
}

/* Heights reserved under the print, on the 8 px grid. */
export const BELOW = { none: 0, caption: 32, line: 24, thumbs: 144, thumbsLine: 176, thumbsCaption: 192 } as const;
