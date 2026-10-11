/** Identifiers and small storage helpers shared by the core modules. */

/** A random id with a readable prefix, such as req_3f2a... */
export function newId(prefix: string): string {
  const c = globalThis.crypto;
  const raw =
    typeof c?.randomUUID === "function"
      ? c.randomUUID()
      : `${Date.now().toString(16)}${Math.floor(Math.random() * 0xffffffff).toString(16)}${Math.floor(Math.random() * 0xffffffff).toString(16)}`;
  return `${prefix}_${raw.replace(/-/g, "")}`;
}

/** A short stable hash for deriving ids from content (FNV-1a, 32 bit). */
export function shortHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

export function readJson<T>(storage: Storage | undefined, key: string): T | null {
  try {
    const raw = storage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Writes, and says whether it worked, so callers can keep the old state when storage is full or blocked. */
export function writeJson(storage: Storage | undefined, key: string, value: unknown): boolean {
  try {
    if (!storage) return false;
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function local(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function session(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}
