/**
 * Who is using Praxis, without asking. A random anonymous id is made on the first visit and kept
 * in this browser; saved looks, feedback and analytics hang off it. Signing in adds a user id, and
 * account.ts moves what the anonymous id owns onto the account. No name, email or photo is used to
 * make either id.
 */
import { local, newId, readJson, session, writeJson } from "./ids";

const ANON_KEY = "praxis_anon";
const VISIT_KEY = "praxis_visit";
const USER_KEY = "praxis_lab_a_user";
const ACCOUNTS_KEY = "praxis_lab_a_accounts";

interface AnonRecord {
  id: string;
  firstSeenAt: string;
  lastSeenAt: string;
  visits: number;
}

let cached: AnonRecord | null = null;

function record(): AnonRecord {
  if (cached) return cached;
  const stored = readJson<AnonRecord>(local(), ANON_KEY);
  if (stored && typeof stored.id === "string" && stored.id.startsWith("anon_")) return (cached = stored);
  const now = new Date().toISOString();
  cached = { id: newId("anon"), firstSeenAt: now, lastSeenAt: now, visits: 0 };
  writeJson(local(), ANON_KEY, cached);
  return cached;
}

export function anonymousId(): string {
  return record().id;
}

export interface Visit {
  /** True when this browser has been here before, in an earlier visit. */
  returning: boolean;
  /** Whole days since the last visit; 0 for a first visit. */
  daysSinceLastVisit: number;
  visits: number;
}

/**
 * Counts a visit once per browser tab session. Returns null when this tab already counted one, so
 * a reload or a second screen never counts the same visit twice.
 */
export function noteVisit(now = new Date()): Visit | null {
  const tab = session();
  if (readJson<boolean>(tab, VISIT_KEY)) return null;
  writeJson(tab, VISIT_KEY, true);
  const r = record();
  const returning = r.visits > 0;
  const days = returning ? Math.max(0, Math.floor((now.getTime() - new Date(r.lastSeenAt).getTime()) / 86_400_000)) : 0;
  cached = { ...r, lastSeenAt: now.toISOString(), visits: r.visits + 1 };
  writeJson(local(), ANON_KEY, cached);
  return { returning, daysSinceLastVisit: days, visits: cached.visits };
}

/**
 * The account id for an address. The stand-in sign-in has no server, so this browser keeps a random
 * id per address: the same person signing in again gets the same id, and nothing about the address
 * can be read back from it. A real account system replaces this with its own user id.
 */
export function userIdFor(email: string): string {
  const address = email.trim().toLowerCase();
  const accounts = readJson<Record<string, string>>(local(), ACCOUNTS_KEY) ?? {};
  const known = accounts[address];
  if (typeof known === "string") return known;
  const id = newId("user");
  writeJson(local(), ACCOUNTS_KEY, { ...accounts, [address]: id });
  return id;
}

/** The signed-in user's id, read from the stand-in account, or undefined for a guest. */
export function currentUserId(): string | undefined {
  const user = readJson<{ id?: unknown; email?: unknown }>(local(), USER_KEY);
  if (!user) return undefined;
  if (typeof user.id === "string") return user.id;
  return typeof user.email === "string" ? userIdFor(user.email) : undefined;
}

/** For tests: forget the cached record so the next read comes from storage. */
export function resetIdentityCache(): void {
  cached = null;
}
