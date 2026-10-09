/**
 * Contextual chrome only: a back arrow, the progress spine, a quiet
 * "New moment" link once the journey has begun, and the monogram that opens
 * the overlay menu. No persistent navigation.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Menu as MenuIcon, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { FRESH, useJourney } from "../lib/journeyContext";
import { useScrollLock } from "../lib/scrollLock";
import { TextButton } from "./controls";

export interface SpineStep {
  label: string;
  /** Route under the mount to return to. Null when not yet reachable. */
  to: string | null;
  state: "done" | "current" | "todo";
}

interface TopBarProps {
  spine?: SpineStep[];
  /** Where the arrow goes. "back" uses history. */
  back?: string | "back" | null;
  /** Kept for callers; the wordmark now sits centred on every screen. */
  wordmark?: boolean;
}

export function TopBar({ spine, back = null }: TopBarProps) {
  const { href, user, openGate } = useJourney();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);

  return (
    <header className="relative z-10 flex h-14 items-center justify-between pl-2 pr-2 lg:h-20 lg:pl-10 lg:pr-8">
      <div className="flex min-w-0 items-center gap-1">
        {back && (
          <button
            type="button"
            aria-label="Back"
            onClick={() => (back === "back" ? navigate(-1) : navigate(back))}
            className="flex h-11 w-11 shrink-0 items-center justify-center text-[var(--text)] transition-colors duration-200 hover:text-[var(--muted)] lg:-ml-3"
          >
            <ArrowLeft size={20} strokeWidth={1.5} />
          </button>
        )}
        <Link to={href("", FRESH)} aria-label="Praxis, home" className="a-wordmark absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--text)] lg:static lg:mr-8 lg:translate-x-0 lg:translate-y-0">
          Praxis
        </Link>
        {spine && <Spine steps={spine} />}
      </div>

      <div className="flex items-center">
        {user ? (
          <button type="button" onClick={() => setMenu(true)} aria-label={`${user.name}, open menu`} className="a-desktop mr-1 items-center justify-center" style={{ width: 44, height: 44 }}>
            <span className="a-avatar" aria-hidden="true">
              {user.name.charAt(0)}
            </span>
          </button>
        ) : (
          <button type="button" onClick={() => openGate("signin")} className="a-control a-tertiary a-desktop a-signin">
            Sign in
          </button>
        )}
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={menu}
          onClick={() => setMenu(true)}
          className="flex h-11 w-11 shrink-0 items-center justify-center text-[var(--text)] transition-colors duration-300 hover:text-[var(--muted)]"
        >
          <MenuIcon size={22} strokeWidth={1.25} />
        </button>
      </div>

      <Menu open={menu} onClose={() => setMenu(false)} />
    </header>
  );
}

function Spine({ steps }: { steps: SpineStep[] }) {
  return (
    <nav aria-label="Progress" className="a-spine a-desktop">
      <ol className="flex items-center gap-3 sm:gap-5">
        {steps.map((s) => {
          /* Where he is reads at once: the current step in ink with a hairline under it, the rest quiet. */
          const color = s.state === "current" ? "a-spine-current text-[var(--text)]" : s.state === "done" ? "text-[var(--muted)]" : "text-[var(--muted)] opacity-60";
          return (
            <li key={s.label} aria-current={s.state === "current" ? "step" : undefined}>
              {s.to && s.state === "done" ? (
                <Link to={s.to} className={`inline-flex min-h-[44px] items-center ${color} transition-colors duration-200 hover:text-[var(--text)]`}>
                  {s.label}
                </Link>
              ) : (
                <span className={`inline-flex min-h-[44px] items-center ${color}`}>{s.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Menu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { href, store, reduced, user, signOut, openGate } = useJourney();
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const items = [
    { label: "New moment", to: href("", FRESH) },
    { label: "Looks", to: href("looks", { hero: null }) },
    { label: store.dna ? "Style DNA" : "Build my Style DNA", to: store.dna ? href("dna", { hero: null }) : href("", { ...FRESH, gate: "dna" }) },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.45, ease: "easeInOut" }}
          className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]"
        >
          <div className="flex h-14 items-center justify-end pr-2 lg:pr-6">
            <button type="button" aria-label="Close menu" onClick={onClose} autoFocus className="flex h-11 w-11 items-center justify-center text-[var(--text)] transition-colors duration-200 hover:text-[var(--muted)]">
              <X size={22} strokeWidth={1.5} />
            </button>
          </div>
          <nav className="flex flex-1 flex-col justify-center px-5 pb-14 lg:px-12" aria-label="Sections">
            <ul className="flex flex-col gap-2">
              {items.map((item, i) => (
                <motion.li key={item.label} initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.5, delay: reduced ? 0 : 0.08 * i, ease: "easeOut" }}>
                  <Link to={item.to} onClick={onClose} className="a-display inline-block py-2 text-[var(--text)] transition-colors duration-200 hover:text-[var(--accent)]">
                    {item.label}
                  </Link>
                </motion.li>
              ))}
            </ul>
            <div className="mt-10 flex items-center gap-3 border-t border-[var(--rule)] pt-6">
              {user ? (
                <>
                  <span className="a-avatar" aria-hidden="true">
                    {user.name.charAt(0)}
                  </span>
                  <span className="text-[15px] leading-5">
                    {user.name}
                    <span className="ml-2 text-[13px] text-[var(--muted)]">{user.plus ? "Plus" : user.email}</span>
                  </span>
                  <TextButton onClick={signOut} className="ml-auto">
                    Sign out
                  </TextButton>
                </>
              ) : (
                <TextButton
                  onClick={() => {
                    onClose();
                    openGate("signin");
                  }}
                  className="-ml-2"
                >
                  Sign in
                </TextButton>
              )}
            </div>
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
