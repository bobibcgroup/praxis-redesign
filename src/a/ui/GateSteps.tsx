/** The two gate steps: sign in, then Praxis Plus. Both are previews; nothing leaves the browser. */
import { useState } from "react";
import { Apple, Check, Lock } from "lucide-react";
import { Field, PrimaryButton, QuietButton } from "./controls";

const SIGNIN_MS = 900;
const PAY_MS = 1200;

type Way = "apple" | "google" | "email";

interface SignInProps {
  onSignedIn: (email?: string) => void;
}

export function SignInStep({ onSignedIn }: SignInProps) {
  const [busy, setBusy] = useState<Way | null>(null);
  const [email, setEmail] = useState("");

  const start = (way: Way) => {
    if (busy) return;
    setBusy(way);
    window.setTimeout(() => onSignedIn(way === "email" ? email.trim() || undefined : undefined), SIGNIN_MS);
  };

  const label = (way: Way, text: string) => (busy === way ? "Signing you in" : text);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="a-display">Sign in to keep this</h2>
        <p className="mt-4 leading-6">Your looks, DNA and purchases are saved to you.</p>
      </div>
      <div className="flex flex-col gap-2">
        <button type="button" className="a-control a-ink w-full" onClick={() => start("apple")} disabled={busy !== null} aria-busy={busy === "apple"}>
          {busy === "apple" ? null : <Apple size={16} strokeWidth={1.5} aria-hidden="true" className="mr-2" />}
          {label("apple", "Continue with Apple")}
        </button>
        <button type="button" className="a-control w-full justify-center" onClick={() => start("google")} disabled={busy !== null} aria-busy={busy === "google"}>
          {label("google", "Continue with Google")}
        </button>
      </div>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          start("email");
        }}
      >
        <Field id="gate-email" label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" inputMode="email" autoComplete="email" />
        <QuietButton type="submit" className="w-full" disabled={busy !== null} aria-busy={busy === "email"}>
          {label("email", "Continue with email")}
        </QuietButton>
      </form>
    </div>
  );
}

const BENEFITS = ["See every look on you", "Your Style DNA, saved", "Two taps to dressed, every time"];

function groups(v: string): string {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
}

function expiry(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d;
}

interface PlusProps {
  onPaid: () => void;
}

/** The parts of the Plus step that must always be visible: benefits, price, Apple Pay. */
export function PlusTop({ busy, onApplePay }: { busy: "apple" | "card" | null; onApplePay: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="a-display">Praxis Plus</h2>
        <p className="mt-4 text-[13px] leading-5 text-[var(--muted)]">What you get</p>
        <ul className="mt-2 flex flex-col gap-2">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-center gap-2 text-[15px] leading-6">
              <Check size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-[var(--accent)]" />
              {b}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="flex items-baseline gap-2">
          <span className="a-display a-display-md">$9</span>
          <span className="text-[15px] text-[var(--muted)]">a month</span>
        </p>
        <p className="mt-1 text-[13px] leading-5 text-[var(--muted)]">Cancel any time. Placeholder price.</p>
      </div>
      <button type="button" className="a-control a-applepay w-full" onClick={onApplePay} disabled={busy !== null} aria-busy={busy === "apple"}>
        {busy === "apple" ? (
          "Confirming with Apple Pay"
        ) : (
          <>
            <Apple size={18} strokeWidth={1.5} aria-hidden="true" />
            Pay
          </>
        )}
      </button>
    </div>
  );
}

/** The card form under Apple Pay; this part may scroll on a short phone. */
export function PlusCard({ busy, onPay }: { busy: "apple" | "card" | null; onPay: () => boolean }) {
  const [card, setCard] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (busy) return;
    if (!card.trim() || !exp.trim() || !cvc.trim()) {
      setError("Fill in the card number, expiry and CVC.");
      return;
    }
    setError(null);
    onPay();
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <p className="flex items-center gap-3 text-[13px] leading-5 text-[var(--muted)]">
        <span className="h-px flex-1 bg-[var(--rule)]" aria-hidden="true" />
        or pay with card
        <span className="h-px flex-1 bg-[var(--rule)]" aria-hidden="true" />
      </p>
      <Field id="gate-card" label="Card number" value={card} onChange={(v) => setCard(groups(v))} placeholder="4242 4242 4242 4242" inputMode="numeric" autoComplete="cc-number" />
      <div className="flex gap-3">
        <Field id="gate-exp" label="Expiry" value={exp} onChange={(v) => setExp(expiry(v))} placeholder="MM / YY" inputMode="numeric" autoComplete="cc-exp" />
        <Field id="gate-cvc" label="CVC" value={cvc} onChange={(v) => setCvc(v.replace(/\D/g, "").slice(0, 4))} placeholder="123" inputMode="numeric" autoComplete="cc-csc" />
      </div>
      {error ? (
        <p role="alert" className="text-[13px] leading-5 text-[var(--error)]">
          {error}
        </p>
      ) : null}
      <PrimaryButton type="submit" className="w-full" disabled={busy !== null} aria-busy={busy === "card"}>
        {busy === "card" ? "Processing" : "Pay $9"}
      </PrimaryButton>
      <p className="flex items-center gap-1.5 text-[12px] leading-4 text-[var(--muted)]">
        <Lock size={12} strokeWidth={1.5} aria-hidden="true" />
        Secured by Stripe. This is a preview; no charge is made.
      </p>
    </form>
  );
}

/** Owns the paying state for both routes so the header and the card share it. */
export function usePlusPayment({ onPaid }: PlusProps) {
  const [busy, setBusy] = useState<"apple" | "card" | null>(null);
  const pay = (route: "apple" | "card") => {
    if (busy) return false;
    setBusy(route);
    window.setTimeout(onPaid, PAY_MS);
    return true;
  };
  return { busy, applePay: () => pay("apple"), cardPay: () => pay("card") };
}
