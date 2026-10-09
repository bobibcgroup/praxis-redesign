/**
 * The gate: sign in, then Praxis Plus, shown in place over the stage. It
 * skips any step already satisfied, traps focus, closes on Escape and
 * returns focus. On success it closes and performs the gated action.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FRESH, useJourney } from "../lib/journeyContext";
import { stepsFor, type GateKind, type GateStep } from "../lib/user";
import { useScrollLock } from "../lib/scrollLock";
import { TextButton } from "./controls";
import { PlusCard, PlusTop, SignInStep, usePlusPayment } from "./GateSteps";

const STEP_LABEL: Record<GateStep, string> = { signin: "Sign in", plus: "Praxis Plus" };
const SUCCESS_MS = 900;
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export function Gate() {
  const { gate, closeGate } = useJourney();
  useScrollLock(gate !== null);
  return (
    <AnimatePresence>
      {gate ? <GateDialog key={gate} kind={gate} onClose={closeGate} /> : null}
    </AnimatePresence>
  );
}

function GateDialog({ kind, onClose }: { kind: GateKind; onClose: () => void }) {
  const { user, signIn, grantPlus, gateActions, go, reduced } = useJourney();
  /* Frozen at open: the list must not shrink under the index once a step is satisfied. */
  const [steps] = useState<GateStep[]>(() => stepsFor(kind, user));
  const [index, setIndex] = useState(0);
  const [success, setSuccess] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnRef = useRef<HTMLElement | null>(null);
  const finished = useRef(false);

  const perform = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    const registered = gateActions.current[kind];
    onClose();
    window.setTimeout(() => {
      if (registered) registered();
      else if (kind === "tryon") go("moment/tryon");
      else if (kind === "dna") go("dna/face", { ...FRESH, face: null });
    }, 0);
  }, [gateActions, kind, onClose, go]);

  /* Nothing left to satisfy: close and act. */
  useEffect(() => {
    if (steps.length === 0 && !success) perform();
  }, [steps.length, success, perform]);

  useEffect(() => {
    returnRef.current = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      returnRef.current?.focus?.();
    };
  }, [onClose]);

  const advance = useCallback(() => {
    if (index + 1 < steps.length) setIndex(index + 1);
    else perform();
  }, [index, steps.length, perform]);

  const step = steps[index] ?? null;

  const payment = usePlusPayment({
    onPaid: () => {
      grantPlus();
      setSuccess(true);
      window.setTimeout(perform, SUCCESS_MS);
    },
  });

  const hidden = reduced ? { opacity: 0 } : { opacity: 0, y: 24 };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:p-8">
      <motion.button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduced ? 0 : 0.2 }}
        className="absolute inset-0 cursor-default bg-[var(--scrim)]"
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={success ? "You’re in" : step ? STEP_LABEL[step] : "Continue"}
        initial={hidden}
        animate={{ opacity: 1, y: 0 }}
        exit={hidden}
        transition={{ duration: reduced ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
        className="a-gate relative"
      >
        <div className="flex h-14 shrink-0 items-center justify-between pl-5 pr-2 lg:pl-8 lg:pr-4">
          <span className="a-mono text-[13px] text-[var(--muted)]" aria-live="polite">
            {success || !step ? "" : `${index + 1} of ${steps.length}, ${STEP_LABEL[step]}`}
          </span>
          <TextButton onClick={onClose} className="text-[13px]">
            Close
          </TextButton>
        </div>
        <div className="mx-auto mb-2 h-1 w-9 shrink-0 rounded-full bg-[var(--rule)] lg:hidden" aria-hidden="true" />

        {success ? (
          <div className="px-5 pb-8 pt-2 lg:px-8 lg:pb-10" aria-live="polite">
            <h2 className="a-display">You’re in.</h2>
            <p className="mt-4 leading-6">Plus is on your account.</p>
          </div>
        ) : step === "signin" ? (
          <div className="a-gate-scroll px-5 pb-6 pt-2 lg:px-8 lg:pb-8">
            <SignInStep
              onSignedIn={(email) => {
                signIn(email);
                advance();
              }}
            />
          </div>
        ) : step === "plus" ? (
          <>
            <div className="shrink-0 px-5 pb-4 pt-2 lg:px-8">
              <PlusTop busy={payment.busy} onApplePay={payment.applePay} />
            </div>
            <div className="a-gate-scroll px-5 pb-6 pt-2 lg:px-8 lg:pb-8">
              <PlusCard busy={payment.busy} onPay={payment.cardPay} />
            </div>
          </>
        ) : null}
      </motion.div>
    </div>
  );
}
