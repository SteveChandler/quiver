"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  trackAuthMethodSelected,
  trackAuthProviderSelected,
  trackSignupStarted,
  trackSignupSuccess,
  trackSignupFailed,
  trackLoginSuccess,
  clearSignupFlow,
} from "@/lib/analytics/auth-events";
import {
  safeGetItem,
  safeSetItem,
} from "@/lib/utils/safe-storage";

/**
 * Google Identity Services typings for the One Tap API.
 * @see https://developers.google.com/identity/gsi/web/reference/js-reference
 */
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleOneTapConfig) => void;
          prompt: (callback?: (notification: PromptNotification) => void) => void;
          cancel: () => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

interface GoogleOneTapConfig {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  context?: "signin" | "signup" | "use";
  itp_support?: boolean;
}

interface GoogleCredentialResponse {
  credential: string;
  select_by: string;
  client_id?: string;
}

interface PromptNotification {
  isDisplayed: () => boolean;
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
  isDismissedMoment: () => boolean;
  getNotDisplayedReason: () => string;
  getSkippedReason: () => string;
  getDismissedReason: () => string;
}

const ONE_TAP_DISMISSED_KEY = "qvr_one_tap_dismissed";
const ONE_TAP_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours after dismissal
const ONE_TAP_DELAY_MS = 3000; // 3 second delay before showing

/**
 * GoogleOneTap — Renders the Google One Tap sign-in prompt for anonymous web users.
 *
 * Loads the Google Identity Services script, initializes One Tap, and handles
 * the credential callback by exchanging the ID token with Supabase via
 * `signInWithIdToken`.
 *
 * Behavior:
 * - Only shows for unauthenticated users
 * - Delays 3 seconds after mount to avoid disrupting initial page load
 * - Remembers dismissal for 24 hours via localStorage
 * - Fires analytics events matching the existing auth event system
 */
export function GoogleOneTap() {
  const { user, isLoading } = useAuth();
  const scriptLoadedRef = useRef(false);
  const promptShownRef = useRef(false);
  const startTimeRef = useRef(0);

  const handleCredentialResponse = useCallback(
    async (response: GoogleCredentialResponse) => {
      const start = startTimeRef.current || Date.now();

      trackAuthMethodSelected({ method: "google", mode: "signup" });
      trackAuthProviderSelected({
        provider: "google",
        mode: "signup",
        source: "google_one_tap",
      });
      const signupFlow = trackSignupStarted("google", {
        source: "google_one_tap",
        redirect_state: "inline",
        // eslint-disable-next-line no-restricted-properties -- Analytics context only.
        landing_page: typeof window !== "undefined" ? window.location.pathname : undefined,
      });
      try {
        const supabase = createClient();

        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: response.credential,
        });

        if (error) {
          console.error("[google-one-tap] signInWithIdToken error:", error);
          trackSignupFailed({
            method: "google",
            error_type: "token_exchange_failed",
            source: "google_one_tap",
            flow_id: signupFlow.flow_id,
            started_at: signupFlow.started_at,
          });
          return;
        }

        const duration = Date.now() - start;
        const isNewUser =
          data.user?.created_at &&
          Date.now() - new Date(data.user.created_at).getTime() < 60_000;

        if (isNewUser) {
          trackSignupSuccess({
            method: "google",
            requires_verification: false,
            source: "google_one_tap",
            flow_id: signupFlow.flow_id,
            started_at: signupFlow.started_at,
          });
        } else {
          trackLoginSuccess({
            method: "google",
            duration_ms: duration,
            source: "google_one_tap",
            flow_id: signupFlow.flow_id,
            redirect_state: "completed",
            started_at: signupFlow.started_at,
          });
          clearSignupFlow(signupFlow.flow_id);
        }

        // Reload the page to let auth context pick up the new session
        // eslint-disable-next-line no-restricted-properties
        window.location.reload();
      } catch (err) {
        console.error("[google-one-tap] Unexpected error:", err);
        trackSignupFailed({
          method: "google",
          error_type: "unexpected_error",
          source: "google_one_tap",
          flow_id: signupFlow.flow_id,
          started_at: signupFlow.started_at,
        });
      }
    },
    []
  );

  useEffect(() => {
    // Guard: only for anonymous users, only after auth resolves
    if (isLoading) return;
    if (user) return;
    if (promptShownRef.current) return;

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    if (!clientId) return;

    // Check if user dismissed One Tap recently
    const dismissedAt = safeGetItem(ONE_TAP_DISMISSED_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10);
      if (elapsed < ONE_TAP_COOLDOWN_MS) return;
    }

    const initializeOneTap = () => {
      if (!window.google?.accounts?.id) return;
      if (promptShownRef.current) return;

      startTimeRef.current = Date.now();

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
        context: "signin",
        itp_support: true,
      });

      window.google.accounts.id.prompt((notification) => {
        if (notification.isDismissedMoment()) {
          // User explicitly closed the prompt — cool down for 24 hours
          safeSetItem(ONE_TAP_DISMISSED_KEY, String(Date.now()));
        }
      });

      promptShownRef.current = true;
    };

    // Delay showing One Tap to avoid disrupting initial page experience
    const delayTimer = setTimeout(() => {
      if (scriptLoadedRef.current) {
        initializeOneTap();
        return;
      }

      // Load Google Identity Services script
      const existingScript = document.querySelector(
        'script[src="https://accounts.google.com/gsi/client"]'
      );

      if (existingScript) {
        scriptLoadedRef.current = true;
        initializeOneTap();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        scriptLoadedRef.current = true;
        initializeOneTap();
      };
      script.onerror = () => {
        console.warn("[google-one-tap] Failed to load Google Identity Services");
      };
      document.head.appendChild(script);
    }, ONE_TAP_DELAY_MS);

    return () => {
      clearTimeout(delayTimer);
      // Cancel any pending One Tap prompt when component unmounts
      try {
        window.google?.accounts?.id?.cancel();
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [user, isLoading, handleCredentialResponse]);

  // This component renders nothing — the One Tap prompt is a Google-managed overlay
  return null;
}
