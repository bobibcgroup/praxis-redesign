/**
 * The gate steps: the introduction to a Premium feature, sign in, then Premium. Value first, then
 * the commitment. Sign-in and payment are previews; nothing leaves the browser and no charge is made.
 */
import { useState } from "react";
import { Apple, Check, Lock } from "lucide-react";
import { premiumAmount, premiumPrice, PREMIUM } from "../../core/config";
import type { SignInMethod } from "../lib/journeyContext";
import { isEmail } from "../lib/user";
import { Field, PrimaryButton, QuietButton, TextButton } from "./controls";

const SIGNIN_MS = 900;
const PAY_MS = 1200;

/* ------------------------------------------------------------- introductions */

export type PremiumFeature = "style_dna" | "tryon";

const DNA_GETS = [
  "Looks shaped around you, not only the occasion",
  "Your colours, read from a photo",
  "Your fit and taste, remembered",
  "One profile you can review and change",
  "Your own pieces, worked into your looks",
];

function Gets({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((b) => (
        <li key={b} className="flex items-start gap-2 text-[15px] leading-6">
          <Check size={16} strokeWidth={1.5} aria-hidden="true" className="mt-1 shrink-0 text-[var(--accent)]" />
          {b}
        </li>
      ))}
    </ul>
  );
}

function IntroHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="a-label flex items-center gap-3 text-[var(--muted)]">
        {eyebrow}
        <span className="a-tag">{PREMIUM.name}</span>
      </p>
      <h2 className="a-display mt-3">{title}</h2>
    </div>
  );
}

function IntroFoot({ onStart, onLater, start }: { onStart: () => void; onLater: () => void; start: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-baseline gap-2">
        <span className="text-[15px]">{PREMIUM.name}</span>
        <span className="a-mono text-[15px] text-[var(--muted)]">{premiumPrice()}</span>
        <span className="text-[13px] text-[var(--muted)]">Cancel any time.</span>
      </p>
      <div className="flex items-center gap-2">
        <PrimaryButton onClick={onStart}>{start}</PrimaryButton>
        <TextButton onClick={onLater}>Not now</TextButton>
      </div>
    </div>
  );
}

/** Style DNA, explained before anything is asked: what it gives, what it takes, how long, the price. */
export function DnaIntro({ onStart, onLater }: { onStart: () => void; onLater: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <IntroHead eyebrow="Style DNA" title="Your style. More personal." />
      <Gets items={DNA_GETS} />
      <div>
        <p className="a-label text-[var(--muted)]">What it takes</p>
        <p className="mt-2 text-[15px] leading-6">Four short steps: a photo of your face, or a sample instead, then your fit, your week and your taste. About two minutes.</p>
      </div>
      <p className="text-[13px] leading-5 text-[var(--muted)]">Style DNA is in preview. It keeps your profile today; looks built on it come next.</p>
      <IntroFoot onStart={onStart} onLater={onLater} start="Start" />
    </div>
  );
}

/** Try-on, explained honestly before anything is asked. The picture is the look on a model, and says so. */
export function TryOnIntro({ image, title, onStart, onLater }: { image: string | null; title: string | null; onStart: () => void; onLater: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <IntroHead eyebrow="Try-on" title="See it on you." />
      <div className="flex items-start gap-4">
        {image ? (
          <figure className="a-intro-print shrink-0">
            <img src={image} alt={title ? `${title}, on a model` : "The look, on a model"} draggable={false} />
            <figcaption className="a-label mt-2 text-[var(--muted)]">On a model</figcaption>
          </figure>
        ) : null}
        <p className="text-[15px] leading-6">Add one photo of you and I’ll show this look on it, so you can judge the fit and the colours before you buy.</p>
      </div>
      <p className="text-[13px] leading-5 text-[var(--muted)]">Try-on isn’t switched on yet. You can add your photo and send it; I’ll tell you plainly that no picture was made, never show one made to look like you.</p>
      <IntroFoot onStart={onStart} onLater={onLater} start="Continue" />
    </div>
  );
}

/* ------------------------------------------------------------------ sign in */

interface SignInProps {
  /** Why an account is asked for here, in one line. */
  reason: string;
  onSignedIn: (email: string | undefined, method: SignInMethod) => void;
}

export function SignInStep({ reason, onSignedIn }: SignInProps) {
  const [busy, setBusy] = useState<SignInMethod | null>(null);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  const start = (way: SignInMethod) => {
    if (busy) return;
    if (way === "email" && !isEmail(email)) {
      setEmailError(email.trim() ? "That address looks incomplete. Check it and try again." : "Enter your email to continue.");
      return;
    }
    setEmailError(null);
    setBusy(way);
    window.setTimeout(() => onSignedIn(way === "email" ? email.trim() : undefined, way), SIGNIN_MS);
  };

  const label = (way: SignInMethod, text: string) => (busy === way ? "Signing you in" : text);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="a-display">Sign in so I can remember you.</h2>
        <p className="mt-3 max-w-[40ch] text-[15px] leading-6 text-[var(--muted)]">{reason}</p>
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
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          start("email");
        }}
      >
        <Field
          id="gate-email"
          label="Email"
          value={email}
          onChange={(v) => {
            setEmail(v);
            setEmailError(null);
          }}
          placeholder="you@example.com"
          type="email"
          inputMode="email"
          autoComplete="email"
        />
        {emailError ? (
          <p role="alert" className="text-[13px] leading-5 text-[var(--error)]">
            {emailError}
          </p>
        ) : null}
        <QuietButton type="submit" className="w-full" disabled={busy !== null} aria-busy={busy === "email"}>
          {label("email", "Continue with email")}
        </QuietButton>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ Premium */

const BENEFITS = ["Style DNA: your colours, fit and taste in one profile", "Try-on, in preview while it is built"];

function groups(v: string): string {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
}

function expiry(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d;
}

interface PremiumProps {
  onPaid: () => void;
}

/** The parts of the Premium step that must always be visible: what it includes, the price, Apple Pay. */
export function PremiumTop({ busy, onApplePay }: { busy: "apple" | "card" | null; onApplePay: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="a-display">{PREMIUM.name}</h2>
        <ul className="mt-4 flex flex-col gap-2">
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
          <span className="a-display a-display-md">{premiumAmount()}</span>
          <span className="text-[15px] text-[var(--muted)]">a {PREMIUM.period}</span>
        </p>
        <p className="mt-1 text-[13px] leading-5 text-[var(--muted)]">Cancel any time.</p>
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
export function PremiumCard({ busy, onPay }: { busy: "apple" | "card" | null; onPay: () => boolean }) {
  const [card, setCard] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (busy) return;
    if (!card.trim() || !exp.trim() || !cvc.trim()) {
      setError("Check your card number, expiry and CVC.");
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
      <Field id="gate-card" label="Card number" value={card} onChange={(v) => setCard(groups(v))} placeholder="4242 4242 4242 4242" inputMode="numeric" autoComplete="off" />
      <div className="flex gap-3">
        <Field id="gate-exp" label="Expiry" value={exp} onChange={(v) => setExp(expiry(v))} placeholder="MM / YY" inputMode="numeric" autoComplete="off" />
        <Field id="gate-cvc" label="CVC" value={cvc} onChange={(v) => setCvc(v.replace(/\D/g, "").slice(0, 4))} placeholder="123" inputMode="numeric" autoComplete="off" />
      </div>
      {error ? (
        <p role="alert" className="text-[13px] leading-5 text-[var(--error)]">
          {error}
        </p>
      ) : null}
      <PrimaryButton type="submit" className="w-full" disabled={busy !== null} aria-busy={busy === "card"}>
        {busy === "card" ? "One moment" : `Pay ${premiumAmount()}`}
      </PrimaryButton>
      <p className="flex items-center gap-1.5 text-[12px] leading-4 text-[var(--muted)]">
        <Lock size={12} strokeWidth={1.5} aria-hidden="true" />
        This is a preview. No charge is made.
      </p>
    </form>
  );
}

/** Owns the paying state for both routes so the header and the card share it. */
export function usePremiumPayment({ onPaid }: PremiumProps) {
  const [busy, setBusy] = useState<"apple" | "card" | null>(null);
  const pay = (route: "apple" | "card") => {
    if (busy) return false;
    setBusy(route);
    window.setTimeout(onPaid, PAY_MS);
    return true;
  };
  return { busy, applePay: () => pay("apple"), cardPay: () => pay("card") };
}
