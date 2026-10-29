/**
 * The user's own Meta API key. It lives only in sessionStorage (gone when the
 * tab closes, never remembered) and travels in a header on each analysis; the
 * server uses it instead of its own and never stores or logs it.
 */
export const API_KEY_HEADER = "x-model-api-key";

/** Printable characters without spaces, long enough to be a real key. */
export const API_KEY_PATTERN = /^[\x21-\x7E]{8,256}$/;

const STORAGE_KEY = "tutor360.model-api-key";

const listeners = new Set<() => void>();

export function readApiKey(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

/** Returns false when the key is malformed or the browser refuses to store it. */
export function saveApiKey(key: string): boolean {
  const clean = key.trim();
  if (!API_KEY_PATTERN.test(clean)) return false;
  try {
    sessionStorage.setItem(STORAGE_KEY, clean);
  } catch {
    return false;
  }
  listeners.forEach((listener) => listener());
  return true;
}

export function clearApiKey(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
  listeners.forEach((listener) => listener());
}

/** For `useSyncExternalStore`: sessionStorage fires no event in its own tab. */
export function subscribeApiKey(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Shows only the end of a key, e.g. "••••a1b2". */
export function maskApiKey(key: string): string {
  return `••••${key.slice(-4)}`;
}
