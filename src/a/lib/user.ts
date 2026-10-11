/**
 * The account preview. Sign-in and Premium are persisted in localStorage;
 * no network, no real payment or identity provider.
 */
import { useCallback, useState } from "react";
import { userIdFor } from "../../core/identity";

export interface LabUser {
  /** Stable account id, used to own saved looks and feedback. */
  id: string;
  name: string;
  email: string;
  premium: boolean;
}

/**
 * What a gate can stand in front of. Save is open to everyone; signin is the plain sign-in, as from
 * the bar or the offer to sync after saving.
 */
export type GateKind = "tryon" | "dna" | "signin";
/** The intro explains a Premium feature before anything is asked of the customer. */
export type GateStep = "intro" | "signin" | "premium";

const KEY = "praxis_lab_a_user";
const DEFAULT_EMAIL = "bob@praxis.app";

function read(): LabUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LabUser> & { plus?: boolean };
    if (typeof parsed.name !== "string" || typeof parsed.email !== "string") return null;
    // Earlier builds called the subscription Plus.
    const premium = parsed.premium === true || parsed.plus === true;
    return { id: typeof parsed.id === "string" ? parsed.id : userIdFor(parsed.email), name: parsed.name, email: parsed.email, premium };
  } catch {
    return null;
  }
}

function write(user: LabUser | null): void {
  try {
    if (user) localStorage.setItem(KEY, JSON.stringify(user));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable; the session still works in memory.
  }
}

/** Which steps a gated action still needs for this user. The intro shows to anyone without Premium. */
export function stepsFor(kind: GateKind, user: LabUser | null, options: { hasDna?: boolean } = {}): GateStep[] {
  const steps: GateStep[] = [];
  const premiumFeature = kind === "tryon" || kind === "dna";
  if (premiumFeature && !user?.premium && !(kind === "dna" && options.hasDna)) steps.push("intro");
  if (!user) steps.push("signin");
  if (premiumFeature && !user?.premium) steps.push("premium");
  return steps;
}

export function useUser() {
  const [user, setUser] = useState<LabUser | null>(() => read());

  const signIn = useCallback((email?: string): LabUser => {
    const prev = read();
    const address = email || prev?.email || DEFAULT_EMAIL;
    const next: LabUser = { id: userIdFor(address), name: "Bob", email: address, premium: prev?.premium ?? false };
    write(next);
    setUser(next);
    return next;
  }, []);

  const signOut = useCallback(() => {
    write(null);
    setUser(null);
  }, []);

  const grantPremium = useCallback(() => {
    const prev = read();
    const address = prev?.email ?? DEFAULT_EMAIL;
    const next: LabUser = { id: prev?.id ?? userIdFor(address), name: prev?.name ?? "Bob", email: address, premium: true };
    write(next);
    setUser(next);
  }, []);

  return { user, signIn, signOut, grantPremium };
}
