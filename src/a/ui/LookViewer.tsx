/**
 * Phone only: a look opened full screen. Swipe left or right to move between the three looks,
 * swipe down (or tap close) to go back to the page. The page follows the look you land on.
 */
import { useEffect } from "react";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { X } from "lucide-react";
import type { Look } from "../../shared/catalog";
import { ROLE_LABEL } from "../lib/looks";
import { useScrollLock } from "../lib/scrollLock";

interface Props {
  open: boolean;
  looks: Look[];
  activeId: string;
  onPick: (id: string) => void;
  onClose: () => void;
  onShare?: () => void;
  reduced: boolean;
}

export function LookViewer({ open, looks, activeId, onPick, onClose, onShare, reduced }: Props) {
  const index = Math.max(0, looks.findIndex((l) => l.id === activeId));
  const look = looks[index];
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < looks.length - 1) onPick(looks[index + 1].id);
      if (e.key === "ArrowLeft" && index > 0) onPick(looks[index - 1].id);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, index, looks, onPick, onClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { x, y } = info.offset;
    if (y > 120 && Math.abs(y) > Math.abs(x)) return onClose();
    if (x < -60 && index < looks.length - 1) onPick(looks[index + 1].id);
    else if (x > 60 && index > 0) onPick(looks[index - 1].id);
  };

  return (
    <AnimatePresence>
      {open && look ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={`${look.title}, full screen`}
          className="a-viewer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.35, ease: "easeOut" }}
        >
          <div className="a-viewer-bar">
            <span className="a-label">
              {ROLE_LABEL[look.role]} · {index + 1} of {looks.length}
            </span>
            <button type="button" onClick={onClose} aria-label="Close" autoFocus className="flex h-11 w-11 items-center justify-center">
              <X size={22} strokeWidth={1.5} />
            </button>
          </div>

          <motion.div
            className="a-viewer-stage"
            drag
            dragDirectionLock
            dragSnapToOrigin
            dragElastic={0.6}
            onDragEnd={onDragEnd}
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.img
                key={look.id}
                src={look.image}
                alt={look.title}
                draggable={false}
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.4, ease: "easeOut" }}
              />
            </AnimatePresence>
          </motion.div>

          <div className="a-viewer-foot">
            <p className="font-[family-name:var(--font-display)] text-[24px] leading-8">{look.title}</p>
            <div className="a-viewer-dots" aria-hidden="true">
              {looks.map((l) => (
                <span key={l.id} data-on={l.id === look.id ? "" : undefined} />
              ))}
            </div>
            <p className="text-[13px] leading-5 text-[var(--muted)]">Swipe for the other looks. Swipe down to close.</p>
            {onShare ? (
              <button type="button" onClick={onShare} className="a-control a-secondary mt-1">
                Share this look
              </button>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
