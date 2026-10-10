/**
 * Zoom and pan for one photo inside a fixed room, with no library. Zooming stays inside the room
 * (the page itself is never zoomed). Scale runs from 1 to MAX; a zoomed photo can be dragged but
 * always covers the room, so it can never be pulled out of view. At scale 1 a one-finger drag is a
 * swipe instead: sideways moves between the looks, downwards closes.
 *
 * Gestures: wheel or trackpad pinch (zooms toward the pointer), two-finger pinch (zooms around the
 * fingers), drag to pan, double tap or double click to jump between 1x and 2.5x at that point. A pinch
 * that ends near 1x settles at 1x, and the finger left on the glass does nothing until it lifts.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export const MAX_ZOOM = 3;
export const STEP = 1.5;
const DOUBLE = 2.5;
const TAP_SLOP = 8;
const DOUBLE_MS = 300;
const SWIPE = 60;
const CLOSE = 110;

export interface View {
  s: number;
  x: number;
  y: number;
}

interface Size {
  w: number;
  h: number;
}

interface Options {
  /** The photo's width over its height, once it has loaded. */
  ratio: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

const ONE: View = { s: 1, x: 0, y: 0 };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The photo's size at scale 1: as tall as the room, unless the room is so narrow that the middle of
 * the photo (where the look stands) would be cut; the plain backdrop at the sides may crop.
 */
export function baseSize(room: Size, ratio: number): Size {
  if (!room.w || !room.h) return { w: 0, h: 0 };
  const h = Math.min(room.h, room.w / (0.62 * ratio));
  return { w: h * ratio, h };
}

export function useZoomPan({ ratio, canPrev, canNext, onPrev, onNext, onClose }: Options) {
  const roomRef = useRef<HTMLDivElement | null>(null);
  const [room, setRoom] = useState<Size>({ w: 0, h: 0 });
  const [view, setViewState] = useState<View>(ONE);
  /** Whether the photo eases to its new place (buttons, double tap, snaps) or follows a gesture live. */
  const [eased, setEased] = useState(true);
  /** At scale 1, how far a swipe has carried the photo. */
  const [swipe, setSwipe] = useState({ x: 0, y: 0 });

  const viewRef = useRef(view);
  viewRef.current = view;
  const base = baseSize(room, ratio);
  const baseRef = useRef(base);
  baseRef.current = base;
  const roomSizeRef = useRef(room);
  roomSizeRef.current = room;

  const fit = useCallback((v: View): View => {
    const s = clamp(v.s, 1, MAX_ZOOM);
    if (s <= 1.001) return ONE;
    const b = baseRef.current;
    const r = roomSizeRef.current;
    const mx = Math.max(0, (b.w * s - r.w) / 2);
    const my = Math.max(0, (b.h * s - r.h) / 2);
    return { s, x: clamp(v.x, -mx, mx), y: clamp(v.y, -my, my) };
  }, []);

  const setView = useCallback(
    (v: View, ease: boolean) => {
      const next = fit(v);
      // Read by the next pointer event, which can arrive before React renders this one.
      viewRef.current = next;
      setEased(ease);
      setViewState(next);
    },
    [fit],
  );

  /** Zooms to scale s keeping the point p (relative to the room's centre) where it is. */
  const zoomAt = useCallback(
    (s: number, px = 0, py = 0, ease = true) => {
      const v = viewRef.current;
      const next = clamp(s, 1, MAX_ZOOM);
      const k = next / v.s;
      setView({ s: next, x: px - (px - v.x) * k, y: py - (py - v.y) * k }, ease);
    },
    [setView],
  );

  const reset = useCallback(() => {
    viewRef.current = ONE;
    setEased(true);
    setViewState(ONE);
    setSwipe({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const el = roomRef.current;
    if (!el) return;
    const measure = () => setRoom({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep the photo inside the room when the room or the photo changes size.
  useEffect(() => {
    setViewState((v) => fit(v));
  }, [room.w, room.h, ratio, fit]);

  /** A point on the screen, relative to the room's centre. */
  const local = (x: number, y: number) => {
    const r = roomRef.current?.getBoundingClientRect();
    return r ? { x: x - (r.left + r.width / 2), y: y - (r.top + r.height / 2) } : { x: 0, y: 0 };
  };

  // Wheel and trackpad pinch (Chrome and Firefox send a pinch as a wheel with ctrlKey).
  useEffect(() => {
    const el = roomRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      const factor = Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015));
      const p = local(e.clientX, e.clientY);
      zoomAt(viewRef.current.s * factor, p.x, p.y, false);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // Safari's own trackpad pinch.
  useEffect(() => {
    const el = roomRef.current;
    if (!el) return;
    let start = 1;
    const begin = (e: Event) => {
      e.preventDefault();
      start = viewRef.current.s;
    };
    const change = (e: Event) => {
      e.preventDefault();
      const g = e as Event & { scale: number; clientX: number; clientY: number };
      const p = local(g.clientX, g.clientY);
      zoomAt(start * g.scale, p.x, p.y, false);
    };
    el.addEventListener("gesturestart", begin);
    el.addEventListener("gesturechange", change);
    return () => {
      el.removeEventListener("gesturestart", begin);
      el.removeEventListener("gesturechange", change);
    };
  }, [zoomAt]);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; cx: number; cy: number; v: View } | null>(null);
  const pan = useRef<{ x: number; y: number; t: number; v: View; moved: boolean } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);

  const startPan = (x: number, y: number, t: number) => {
    pan.current = { x, y, t, v: viewRef.current, moved: false };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const mid = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: mid.x, cy: mid.y, v: viewRef.current };
      pan.current = null;
      setSwipe({ x: 0, y: 0 });
    } else if (pointers.current.size === 1) {
      startPan(e.clientX, e.clientY, e.timeStamp);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = pinch.current;
    if (p && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const mid = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      const s = clamp((p.v.s * Math.hypot(a.x - b.x, a.y - b.y)) / p.d, 1, MAX_ZOOM);
      // The point that was under the fingers stays under them as they move and spread.
      const cx = (p.cx - p.v.x) / p.v.s;
      const cy = (p.cy - p.v.y) / p.v.s;
      setView({ s, x: mid.x - cx * s, y: mid.y - cy * s }, false);
      return;
    }
    const d = pan.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < TAP_SLOP) return;
    d.moved = true;
    if (d.v.s > 1) {
      setView({ s: d.v.s, x: d.v.x + dx, y: d.v.y + dy }, false);
      return;
    }
    // At scale 1: a swipe. Sideways follows the finger (held back at the ends), downwards pulls to close.
    setEased(false);
    if (Math.abs(dx) >= Math.abs(dy)) {
      const atEnd = (dx > 0 && !canPrev) || (dx < 0 && !canNext);
      setSwipe({ x: atEnd ? dx * 0.15 : dx, y: 0 });
    } else {
      setSwipe({ x: 0, y: Math.max(0, dy) });
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    if (pinch.current) {
      if (pointers.current.size < 2) {
        pinch.current = null;
        if (viewRef.current.s < 1.05) {
          // Back to about normal size: settle there. The finger still down is ignored until it lifts,
          // so it cannot swipe to another look, pull the viewer closed or zoom the photo back in.
          reset();
          return;
        }
        // Still zoomed: carry on panning with the finger that is still down, from where it is now.
        const rest = [...pointers.current.values()][0];
        if (rest) {
          startPan(rest.x, rest.y, e.timeStamp);
          if (pan.current) pan.current.moved = true;
        }
      }
      return;
    }
    const d = pan.current;
    pan.current = null;
    if (!d || pointers.current.size > 0) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;

    if (!d.moved) {
      // A tap. Two in quick succession at about the same place: zoom in there, or back out.
      const last = lastTap.current;
      if (last && e.timeStamp - last.t < DOUBLE_MS && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 32) {
        lastTap.current = null;
        if (viewRef.current.s > 1) reset();
        else {
          const p = local(e.clientX, e.clientY);
          zoomAt(DOUBLE, p.x, p.y, true);
        }
      } else {
        lastTap.current = { t: e.timeStamp, x: e.clientX, y: e.clientY };
      }
      return;
    }
    if (d.v.s > 1) {
      setEased(true);
      return;
    }
    const sideways = Math.abs(dx) >= Math.abs(dy);
    const fast = Math.abs(sideways ? dx : dy) / Math.max(1, e.timeStamp - d.t) > 0.5;
    setEased(true);
    setSwipe({ x: 0, y: 0 });
    if (sideways && (dx <= -SWIPE || (dx < -24 && fast)) && canNext) onNext();
    else if (sideways && (dx >= SWIPE || (dx > 24 && fast)) && canPrev) onPrev();
    else if (!sideways && (dy >= CLOSE || (dy > 40 && fast))) onClose();
  };

  const onPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    pinch.current = null;
    pan.current = null;
    setEased(true);
    setSwipe({ x: 0, y: 0 });
  };

  return {
    roomRef,
    base,
    view,
    swipe,
    eased,
    zoomed: view.s > 1,
    zoomAt,
    zoomBy: (k: number) => zoomAt(viewRef.current.s * k),
    /** Moves a zoomed photo by a share of the room; positive shows more of the right or the bottom. */
    panBy: (fx: number, fy: number) => {
      const v = viewRef.current;
      if (v.s <= 1) return;
      const r = roomSizeRef.current;
      setView({ s: v.s, x: v.x - fx * r.w, y: v.y - fy * r.h }, true);
    },
    reset,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
