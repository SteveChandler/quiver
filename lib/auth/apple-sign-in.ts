/**
 * Apple Sign-In integration for Quiver (web).
 *
 * Uses Supabase's built-in Apple OAuth redirect flow.
 */

import { createClient } from "@/lib/supabase/client";
import type { SignupMetadata } from "@/lib/analytics/acquisition-context";
import {
  clearPendingSignupMetadata,
  storePendingSignupMetadata,
} from "@/lib/auth/auth-utils";

export interface AppleSignInResult {
  error?: string;
}

/**
 * Initiate Apple Sign-In via Supabase OAuth redirect.
 *
 * @param returnTo - Path to return to after auth
 */
export async function signInWithApple(
  returnTo: string = "/",
  metadata?: SignupMetadata,
): Promise<AppleSignInResult> {
  const sb = createClient();

  try {
    storePendingSignupMetadata(metadata);

    const origin =
      typeof window !== "undefined" ? window.location.origin : ""; // eslint-disable-line no-restricted-properties
    const callbackUrl = new URL(`${origin}/auth/callback`);
    callbackUrl.searchParams.set("redirect", returnTo);
    callbackUrl.searchParams.set("provider", "apple");
    const redirectTo = callbackUrl.toString();

    const { error: oauthError } = await sb.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo },
    });

    if (oauthError) {
      console.error("[apple-sign-in] OAuth error:", oauthError);
      clearPendingSignupMetadata();
      return {
        error: "Unable to sign in with Apple. Please try another method.",
      };
    }

    return {};
  } catch (err) {
    console.error("[apple-sign-in] Exception:", err);
    clearPendingSignupMetadata();
    return { error: "An unexpected error occurred during Apple sign in." };
  }
}
