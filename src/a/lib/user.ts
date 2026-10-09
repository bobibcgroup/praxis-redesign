/**
 * The account preview. Sign-in and Plus are persisted in localStorage;
 * no network, no real Stripe or Clerk.
 */
import { useCallback, useState } from "react";

export interface LabUser {
  name: string;
  email: string;
  plus: boolean;
}

export type GateKind = "tryon" | "dna" | "save" | "signin";
export type GateStep = "signin" | "plus";

const KEY = "praxis_lab_a_user";

function read(): LabUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LabUser>;
    if (typeof parsed.name !== "string" || typeof parsed.email !== "string") return null;
    return { name: parsed.name, email: parsed.email, plus: parsed.plus === true };
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

/** Which steps a gated action still needs for this user. */
export function stepsFor(kind: GateKind, user: LabUser | null): GateStep[] {
  const steps: GateStep[] = [];
  if (!user) steps.push("signin");
  if ((kind === "tryon" || kind === "dna") && !user?.plus) steps.push("plus");
  return steps;
}

export function useUser() {
  const [user, setUser] = useState<LabUser | null>(() => read());

  const signIn = useCallback((email?: string) => {
    setUser((prev) => {
      const next: LabUser = { name: "Bob", email: email || prev?.email || "bob@praxis.app", plus: prev?.plus ?? false };
      write(next);
      return next;
    });
  }, []);

  const signOut = useCallback(() => {
    write(null);
    setUser(null);
  }, []);

  const grantPlus = useCallback(() => {
    setUser((prev) => {
      const next: LabUser = { ...(prev ?? { name: "Bob", email: "bob@praxis.app" }), plus: true };
      write(next);
      return next;
    });
  }, []);

  return { user, signIn, signOut, grantPlus };
}
