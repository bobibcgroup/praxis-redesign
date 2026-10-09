/** A sheet: from the right on desktop, from the bottom on mobile. Sharp corners, one scrim, Escape closes. */
import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { useScrollLock } from "../lib/scrollLock";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  /** Pinned under the scrolling body, for the sheet's one action. */
  footer?: ReactNode;
}

export function Sheet({ open, onClose, label, children, footer }: SheetProps) {
  useScrollLock(open);
  const reduced = useReducedMotion() ?? false;
  const panelRef = useRef<HTMLDivElement>(null);
  const returnRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnRef.current = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>("button, a, [tabindex]");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      returnRef.current?.focus?.();
    };
  }, [open, onClose]);

  const isDesktop = typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
  const hidden = reduced ? { opacity: 0 } : isDesktop ? { x: 48, opacity: 0 } : { y: 48, opacity: 0 };
  const shown = { x: 0, y: 0, opacity: 1 };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-end lg:items-stretch">
          <motion.button
            type="button"
            aria-label="Close"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 cursor-default bg-[var(--scrim)]"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={hidden}
            animate={shown}
            exit={hidden}
            transition={{ duration: reduced ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex max-h-[85dvh] w-full flex-col bg-[var(--bg)] lg:h-full lg:max-h-none lg:w-[440px]"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--rule)] pl-5 pr-2 lg:pl-8">
              <h2 className="a-sheet-title">{label}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-11 w-11 items-center justify-center text-[var(--text)] transition-colors duration-200 hover:text-[var(--muted)]"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 lg:px-8 lg:py-6">{children}</div>
            {footer ? <div className="shrink-0 border-t border-[var(--rule)] px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 lg:px-8 lg:pb-8">{footer}</div> : null}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
