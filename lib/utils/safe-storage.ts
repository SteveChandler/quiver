/**
 * Safe localStorage wrappers that catch exceptions in restricted environments
 * (e.g., Safari private mode, SSR, disabled cookies).
 */

export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage full or access denied — silently degrade
  }
}

export function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Access denied — silently degrade
  }
}
