/**
 * Contextual chrome only: a back arrow, the progress spine, a quiet
 * "New moment" link once the journey has begun, and the monogram that opens
 * the overlay menu. No persistent navigation.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { FRESH, useJourney } from "../lib/journeyContext";
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
  wordmark?: boolean;
}

export function TopBar({ spine, back = null, wordmark = false }: TopBarProps) {
  const { href, begun, user, openGate } = useJourney();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);

  return (
    <header className="relative z-10 flex h-14 items-center justify-between pl-2 pr-2 lg:pl-8 lg:pr-6">
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
        {wordmark && (
          <Link to={href("", FRESH)} className="a-display ml-3 text-[24px] leading-none text-[var(--text)] lg:ml-0 lg:text-[24px]">
            Praxis
          </Link>
        )}
        {spine && <Spine steps={spine} />}
      </div>

      <div className="flex items-center">
        {begun ? (
          <Link to={href("", FRESH)} className="a-control a-tertiary a-desktop text-[13px]">
            New moment
          </Link>
        ) : null}
        {user ? (
          <button type="button" onClick={() => setMenu(true)} aria-label={`${user.name}, open menu`} className="a-desktop mr-1 items-center justify-center" style={{ width: 44, height: 44 }}>
            <span className="a-avatar" aria-hidden="true">
              {user.name.charAt(0)}
            </span>
          </button>
        ) : (
          <button type="button" onClick={() => openGate("signin")} className="a-control a-tertiary a-desktop text-[13px]">
            Sign in
          </button>
        )}
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={menu}
          onClick={() => setMenu(true)}
          className="a-display flex h-11 w-11 shrink-0 items-center justify-center text-[26px] leading-none text-[var(--text)] transition-colors duration-200 hover:text-[var(--accent)] lg:text-[26px]"
        >
          P
        </button>
      </div>

      <Menu open={menu} onClose={() => setMenu(false)} />
    </header>
  );
}

function Spine({ steps }: { steps: SpineStep[] }) {
  return (
    <nav aria-label="Progress" className="a-spine ml-1 lg:ml-2">
      <ol className="flex items-center gap-3 sm:gap-5">
        {steps.map((s) => {
          const color = s.state === "done" ? "text-[var(--accent)]" : s.state === "current" ? "text-[var(--text)]" : "text-[var(--muted)]";
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
    { label: store.dna ? "You" : "Build your DNA", to: store.dna ? href("dna", { hero: null }) : href("", { ...FRESH, gate: "dna" }) },
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
          transition={{ duration: reduced ? 0 : 0.2 }}
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
                <motion.li key={item.label} initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: reduced ? 0 : 0.05 * i, ease: "easeOut" }}>
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
