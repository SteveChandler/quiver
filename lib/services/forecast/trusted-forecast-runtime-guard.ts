/**
 * Runtime browser guard for the trusted-forecast Node adapters.
 *
 * The `-server` adapters use `import "server-only"`, which is the right guard
 * inside the Next.js graph. The `-node` adapters cannot: they are the fallback
 * `forecast-builder` reaches for when the `-server` import throws
 * MODULE_NOT_FOUND under plain Node (`server-only` is not an installed
 * dependency), so importing it here would make the fallback fail with the very
 * error it exists to recover from — silently breaking
 * `scripts/regenerate-enhanced-forecasts.ts` and the production smoke.
 *
 * These adapters construct a service-role client, so reaching one from a
 * browser bundle must still be a loud failure rather than a silent key
 * exposure. Enforced at call time instead of import time.
 */
export function assertNotBrowser(adapterName: string): void {
  if (typeof window === "undefined") return;
  throw new Error(
    `${adapterName} is server-only: it builds a Supabase service-role client ` +
      "and must never be reached from a browser bundle. Import the `-server` " +
      "adapter from Next.js code instead.",
  );
}
