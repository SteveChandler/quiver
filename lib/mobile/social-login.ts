/**
 * Shared initialization for @capgo/capacitor-social-login.
 *
 * SocialLogin.initialize() must complete before SocialLogin.login() is called.
 * auth-context.tsx triggers initialization on app start; auth-utils.ts awaits
 * the same promise before attempting login, eliminating the race condition.
 */

let initPromise: Promise<void> | null = null;

/**
 * Start SocialLogin initialization. Safe to call multiple times — only the
 * first call creates the promise; subsequent calls return the same one.
 */
export function initializeSocialLogin(webClientId: string): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = import("@capgo/capacitor-social-login").then(
    ({ SocialLogin }) =>
      SocialLogin.initialize({
        google: { webClientId },
      })
  );

  return initPromise;
}

/**
 * Wait until SocialLogin is ready. Resolves immediately if initialization
 * was never started (the caller should handle that — e.g. web builds).
 */
export async function ensureSocialLoginReady(): Promise<void> {
  if (initPromise) {
    await initPromise;
  }
}
