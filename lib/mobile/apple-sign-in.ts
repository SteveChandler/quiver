/**
 * Apple Sign-In integration for Quiver.
 *
 * Native iOS: Uses @capacitor-community/apple-sign-in to get an identity
 * token, then exchanges it with Supabase via signInWithIdToken.
 *
 * Web: Falls back to Supabase's built-in Apple OAuth redirect flow.
 */

import { createClient } from "@/lib/supabase/client";
import { isNativeApp } from "@/lib/mobile/platform";
import * as Sentry from "@sentry/nextjs";

export interface AppleSignInResult {
  error?: string;
}

/**
 * Initiate Apple Sign-In.
 *
 * On native iOS, launches the system Apple Sign-In sheet and exchanges the
 * resulting identity token with Supabase. On web, initiates the Supabase
 * OAuth redirect flow for Apple.
 *
 * @param returnTo - Path to return to after auth (used for web OAuth redirect)
 */
export async function signInWithApple(
  returnTo: string = "/"
): Promise<AppleSignInResult> {
  const sb = createClient();

  if (isNativeApp()) {
    return signInWithAppleNative(sb);
  }

  return signInWithAppleWeb(sb, returnTo);
}

/**
 * Native iOS Apple Sign-In via Capacitor plugin.
 */
async function signInWithAppleNative(
  sb: ReturnType<typeof createClient>
): Promise<AppleSignInResult> {
  try {
    const { SignInWithApple } = await import(
      "@capacitor-community/apple-sign-in"
    );

    const result = await SignInWithApple.authorize({
      clientId: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || "",
      redirectURI: "", // Not used for native
      scopes: "email name",
      state: "",
      nonce: "",
    });

    const identityToken = result.response?.identityToken;

    if (!identityToken) {
      return { error: "Apple sign-in was cancelled or failed." };
    }

    const { error: tokenError } = await sb.auth.signInWithIdToken({
      provider: "apple",
      token: identityToken,
    });

    if (tokenError) {
      console.error("[apple-sign-in] signInWithIdToken error:", tokenError);
      return {
        error: "Unable to sign in with Apple. Please try another method.",
      };
    }

    return {};
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[apple-sign-in] Native exception:", err);
    Sentry.captureException(err, {
      tags: { context: "native_apple_signin" },
    });
    return { error: `Apple sign-in failed: ${errorMessage}` };
  }
}

/**
 * Web Apple Sign-In via Supabase OAuth redirect.
 */
async function signInWithAppleWeb(
  sb: ReturnType<typeof createClient>,
  returnTo: string
): Promise<AppleSignInResult> {
  try {
    const origin =
      typeof window !== "undefined" ? window.location.origin : ""; // eslint-disable-line no-restricted-properties
    const redirectTo = `${origin}/auth/callback?redirect=${encodeURIComponent(returnTo)}`;

    const { error: oauthError } = await sb.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo },
    });

    if (oauthError) {
      console.error("[apple-sign-in] OAuth error:", oauthError);
      return {
        error: "Unable to sign in with Apple. Please try another method.",
      };
    }

    return {};
  } catch (err) {
    console.error("[apple-sign-in] Web exception:", err);
    return { error: "An unexpected error occurred during Apple sign in." };
  }
}
