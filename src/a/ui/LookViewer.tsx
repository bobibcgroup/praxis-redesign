/**
 * A look opened large, on every screen, to study the fit, the proportions, the colours and the shoes.
 * The photo fills the room on the page's ivory. Zoom with the small controls, the wheel or trackpad, a
 * pinch, or a double tap; drag to look around. Only the photo zooms, never the page. At its normal
 * size a sideways swipe (or the arrows, or the arrow keys) moves between the three looks, stopping at
 * the first and the last, and a swipe down closes it. The page follows the look you land on, so
 * closing returns to the same look with its pieces and total.
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import type { Look } from "../../shared/catalog";
import { ROLE_LABEL } from "../lib/looks";
import { useScrollLock } from "../lib/scrollLock";
import { MAX_ZOOM, STEP, useZoomPan } from "../lib/zoomPan";

interface Props {
  open: boolean;
  looks: Look[];
  activeId: string;
  /** Moves the page to another look; dir is +1 for the next one, -1 for the previous. */
  onPick: (id: string, dir: number) => void;
  onClose: () => void;
  reduced: boolean;
}

const HINT_KEY = "praxis_lab_a_viewer_hint";

export function LookViewer({ open, looks, activeId, onPick, onClose, reduced }: Props) {
  const index = Math.max(0, looks.findIndex((l) => l.id === activeId));
  const look = looks[index];
  /* Whatever opened the viewer gets focus back once it has closed. Read before the viewer mounts,
     since its close button takes focus as it appears. */
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current) opener.current = document.activeElement as HTMLElement | null;
  wasOpen.current = open;
  return (
    <AnimatePresence onExitComplete={() => opener.current?.focus?.({ preventScroll: true })}>
      {open && look ? <Viewer key="viewer" looks={looks} index={index} onPick={onPick} onClose={onClose} reduced={reduced} /> : null}
    </AnimatePresence>
  );
}

function Viewer({ looks, index, onPick, onClose, reduced }: { looks: Look[]; index: number; onPick: Props["onPick"]; onClose: () => void; reduced: boolean }) {
  const look = looks[index];
  const canPrev = index > 0;
  const canNext = index < looks.length - 1;
  const [dir, setDir] = useState(0);
  const [ratio, setRatio] = useState(1);
  const dialogRef = useRef<HTMLDivElement>(null);
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const zoomInRef = useRef<HTMLButtonElement>(null);
  useScrollLock(true);

  const go = (d: number) => {
    const next = looks[index + d];
    if (!next) return;
    setDir(d);
    // In the same render as the move, so the next look never appears at the old zoom.
    zoom.reset();
    onPick(next.id, d);
  };

  const zoom = useZoomPan({ ratio, canPrev, canNext, onPrev: () => go(-1), onNext: () => go(1), onClose });
  const { reset } = zoom;

  // A new look always opens at its normal size.
  useEffect(() => {
    reset();
  }, [look.id, reset]);

  /* At the first or last look its chevron goes away; if it had focus, the other one takes it. */
  useEffect(() => {
    if (!dialogRef.current?.contains(document.activeElement)) (nextRef.current ?? prevRef.current)?.focus({ preventScroll: true });
  }, [index]);

  /* The hint shows the first time only; after that the gestures are known. */
  const [hint] = useState(() => {
    try {
      return window.localStorage.getItem(HINT_KEY) === null;
    } catch {
      return true;
    }
  });
  const [touch] = useState(() => window.matchMedia?.("(pointer: coarse)").matches ?? false);
  useEffect(() => {
    try {
      window.localStorage.setItem(HINT_KEY, "1");
    } catch {
      // Storage blocked: the hint simply shows again next time.
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") onClose();
      // Zoomed, the arrows move around the photo; at normal size, left and right change the look.
      else if (zoom.zoomed && (e.key === "ArrowLeft" || e.key === "ArrowRight")) zoom.panBy(e.key === "ArrowRight" ? 0.15 : -0.15, 0);
      else if (zoom.zoomed && (e.key === "ArrowUp" || e.key === "ArrowDown")) zoom.panBy(0, e.key === "ArrowDown" ? 0.15 : -0.15);
      else if (e.key === "ArrowRight" && canNext) go(1);
      else if (e.key === "ArrowLeft" && canPrev) go(-1);
      else if (e.key === "+" || e.key === "=") zoom.zoomBy(STEP);
      else if (e.key === "-" || e.key === "_") zoom.zoomBy(1 / STEP);
      else if (e.key === "0") reset();
      else if (e.key === "Tab") {
        // Keep focus inside the viewer while it is open.
        const items = dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
        if (!items || items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (!dialogRef.current?.contains(document.activeElement)) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
        return;
      } else return;
      e.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const { view, swipe, base, eased } = zoom;
  const shift = reduced ? 0 : 40 * dir;
  const transform = `translate3d(${view.x + swipe.x}px, ${view.y + swipe.y}px, 0) scale(${view.s})`;
  const pull = swipe.y > 0 ? Math.max(0.4, 1 - swipe.y / 400) : 1;

  return (
    <motion.div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${look.title}, larger`}
      className="a-viewer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.3, ease: "easeOut" }}
    >
      <div className="a-viewer-bar">
        <span className="a-label">
          {ROLE_LABEL[look.role]} · {index + 1} of {looks.length}
        </span>
        <button type="button" onClick={onClose} aria-label="Close" autoFocus className="a-viewer-btn">
          <X size={22} strokeWidth={1.5} />
        </button>
      </div>

      <div className="a-viewer-room">
        <div
          ref={zoom.roomRef}
          className="a-viewer-stage"
          data-zoomed={zoom.zoomed ? "" : undefined}
          style={{ opacity: pull }}
          {...zoom.handlers}
        >
          <AnimatePresence initial={false} custom={shift}>
            <motion.div
              key={look.id}
              className="a-viewer-slide"
              custom={shift}
              variants={{ leave: (s: number) => ({ opacity: 0, x: -s }) }}
              initial={{ opacity: 0, x: shift }}
              animate={{ opacity: 1, x: 0 }}
              exit="leave"
              transition={{ duration: reduced ? 0 : 0.3, ease: [0.22, 0.61, 0.36, 1] }}
            >
              <img
                src={look.image}
                alt={look.title}
                draggable={false}
                decoding="async"
                className="a-viewer-img a-transition"
                data-live={eased && !reduced ? undefined : ""}
                onLoad={(e) => {
                  const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                  if (w && h) setRatio(w / h);
                }}
                style={{ width: base.w, height: base.h, marginLeft: -base.w / 2, marginTop: -base.h / 2, transform }}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {canPrev ? (
          <button ref={prevRef} type="button" className="a-viewer-btn a-viewer-side" data-side="prev" onClick={() => go(-1)} aria-label={`Previous look, ${ROLE_LABEL[looks[index - 1].role].toLowerCase()}`}>
            <ChevronLeft size={24} strokeWidth={1.25} />
          </button>
        ) : null}
        {canNext ? (
          <button ref={nextRef} type="button" className="a-viewer-btn a-viewer-side" data-side="next" onClick={() => go(1)} aria-label={`Next look, ${ROLE_LABEL[looks[index + 1].role].toLowerCase()}`}>
            <ChevronRight size={24} strokeWidth={1.25} />
          </button>
        ) : null}

        <div className="a-viewer-zoom" role="group" aria-label="Zoom">
          {zoom.zoomed ? (
            <button
              type="button"
              className="a-viewer-reset"
              onClick={() => {
                reset();
                zoomInRef.current?.focus();
              }}
            >
              Reset
            </button>
          ) : null}
          <button type="button" className="a-viewer-btn" onClick={() => zoom.zoomBy(1 / STEP)} aria-disabled={!zoom.zoomed} aria-label="Zoom out">
            <Minus size={18} strokeWidth={1.5} />
          </button>
          <button ref={zoomInRef} type="button" className="a-viewer-btn" onClick={() => zoom.zoomBy(STEP)} aria-disabled={view.s >= MAX_ZOOM} aria-label="Zoom in">
            <Plus size={18} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="a-viewer-foot">
        <p className="a-viewer-title">{look.title}</p>
        <div className="a-viewer-dots" aria-hidden="true">
          {looks.map((l) => (
            <span key={l.id} data-on={l.id === look.id ? "" : undefined} />
          ))}
        </div>
        {hint ? (
          <p className="text-[13px] leading-5 text-[var(--muted)]">
            {touch ? "Pinch or double tap to look closer. Swipe for the other looks." : "Scroll, double click or press + to look closer, then drag or use the arrow keys to move around."}
          </p>
        ) : null}
      </div>
    </motion.div>
  );
}
