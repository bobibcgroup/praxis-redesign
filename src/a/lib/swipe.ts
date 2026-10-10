/**
 * A sideways swipe on the results print moves between the looks; a tap opens it large. The print
 * carries `touch-action: pan-y pinch-zoom`, so an upward or downward move stays with the page (the
 * browser takes it and cancels ours) and the page can still be zoomed. Mid-swipe the photo follows
 * the finger at reduced travel, and holds back at the first and last look, where there is nothing more.
 */
import { useCallback, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from "react";

/** Travel before a move counts as a swipe rather than a tap. */
const SLOP = 10;
/** Travel that commits a swipe, or a shorter quick flick. */
const COMMIT = 56;
const FLICK_MIN = 24;
const FLICK_SPEED = 0.45; // px per ms
/** How much of the finger's travel the photo follows; less at an end. */
const FOLLOW = 0.4;
const RESIST = 0.12;

interface Options {
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onTap: () => void;
}

export function useSwipe({ canPrev, canNext, onPrev, onNext, onTap }: Options) {
  const start = useRef<{ x: number; y: number; t: number; id: number } | null>(null);
  const swiping = useRef(false);
  const swallowClick = useRef(false);
  const [drag, setDrag] = useState(0);

  const reset = useCallback(() => {
    start.current = null;
    swiping.current = false;
    setDrag(0);
  }, []);

  const handlers = useMemo(
    () => ({
      onPointerDown(e: PointerEvent<HTMLElement>) {
        swallowClick.current = false;
        if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) {
          reset();
          return;
        }
        start.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId };
        swiping.current = false;
      },
      onPointerMove(e: PointerEvent<HTMLElement>) {
        const s = start.current;
        if (!s || e.pointerId !== s.id) return;
        // A mouse press released off the print never reached onPointerUp: no button held is a hover, not a swipe.
        if (e.pointerType === "mouse" && e.buttons === 0) {
          reset();
          return;
        }
        const dx = e.clientX - s.x;
        const dy = e.clientY - s.y;
        if (!swiping.current) {
          if (Math.abs(dx) > SLOP && Math.abs(dx) > Math.abs(dy) * 1.2) {
            swiping.current = true;
            e.currentTarget.setPointerCapture?.(e.pointerId);
          } else if (Math.abs(dy) > SLOP) {
            // Up or down: the page's scroll, not ours. A mouse never scrolls the page, so its release is no tap either.
            start.current = null;
            swallowClick.current = e.pointerType === "mouse";
            return;
          } else return;
        }
        const atEnd = (dx > 0 && !canPrev) || (dx < 0 && !canNext);
        setDrag(dx * (atEnd ? RESIST : FOLLOW));
      },
      onPointerUp(e: PointerEvent<HTMLElement>) {
        const s = start.current;
        const wasSwipe = swiping.current;
        reset();
        if (!s || !wasSwipe || e.pointerId !== s.id) return;
        swallowClick.current = true;
        const dx = e.clientX - s.x;
        const fast = Math.abs(dx) >= FLICK_MIN && Math.abs(dx) / Math.max(1, e.timeStamp - s.t) > FLICK_SPEED;
        if ((dx <= -COMMIT || (dx < 0 && fast)) && canNext) onNext();
        else if ((dx >= COMMIT || (dx > 0 && fast)) && canPrev) onPrev();
      },
      onPointerCancel() {
        reset();
      },
      onClick(e: MouseEvent<HTMLElement>) {
        // Swallow only the click a drag itself leaves behind. A keyboard or assistive-technology
        // activation (detail 0) always opens, and the flag never outlives the gesture.
        const swallow = swallowClick.current;
        swallowClick.current = false;
        if (swallow && e.detail !== 0) {
          e.preventDefault();
          return;
        }
        onTap();
      },
    }),
    [canPrev, canNext, onPrev, onNext, onTap, reset],
  );

  return { handlers, drag };
}
