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
export function initializeSocialLogin(
  webClientId: string,
  iosClientId?: string
): Promise<void> {
  if (initPromise) return initPromise;

  const options = {
    google: {
      webClientId,
      iOSClientId: iosClientId || webClientId,
      iOSServerClientId: webClientId,
    },
  };

  console.log(
    "[SocialLogin] Initializing with options:",
    JSON.stringify(options)
  );

  initPromise = import("@capgo/capacitor-social-login")
    .then(({ SocialLogin }) => SocialLogin.initialize(options))
    .catch((err) => {
      // Reset initPromise so retries are possible via ensureSocialLoginReady
      console.error(
        "[SocialLogin] Initialize failed, resetting for retry:",
        err
      );
      initPromise = null;
      throw err;
    });

  return initPromise;
}

/**
 * Wait until SocialLogin is ready. Resolves immediately if initialization
 * was never started (the caller should handle that — e.g. web builds).
 */
export async function ensureSocialLoginReady(): Promise<void> {
  if (initPromise) {
    await initPromise;
    return;
  }

  // Fallback: initPromise is null (either never called OR was reset after failure)
  const webClientId = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID;

  if (webClientId) {
    console.log(
      "[SocialLogin] Retrying initialization from ensureSocialLoginReady"
    );
    await initializeSocialLogin(webClientId, iosClientId);
  } else {
    console.warn(
      "ensureSocialLoginReady: NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID is missing"
    );
  }
}
