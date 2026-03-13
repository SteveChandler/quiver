/**
 * Standardized authentication analytics events for Quiver
 *
 * This module provides consistent tracking for all auth-related user actions:
 * - Modal interactions
 * - Auth method selection
 * - Login flows
 * - Signup flows
 * - Magic link interactions
 * - Redirects
 *
 * All events follow the naming convention: {action}_{past_tense}
 * Example: "login_success", "auth_modal_opened", "magic_link_sent"
 *
 * Funnel events (auth_modal_opened, auth_modal_closed_without_action,
 * auth_provider_selected, signup_form_submitted) dual-fire to both GA4
 * and /api/events so they appear in the internal user_events table for
 * dashboard measurement and signup funnel analysis.
 */

import { track } from "@/lib/analytics";
import { getVisitorId } from "@/lib/utils/visitor-id";

/**
 * Fire a funnel event to the internal /api/events endpoint.
 * Errors are silently swallowed — tracking must never break the app.
 */
function fireToUserEvents(eventType: string, params: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  try {
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        metadata: params,
        sessionId: getVisitorId(),
        viewportWidth: window.innerWidth,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Swallow errors — tracking must never break the app
  }
}

/**
 * Track when the auth modal is opened.
 * Dual-fires to GA4 and /api/events for internal funnel measurement.
 * @param params.mode - The mode of the modal (login/signup/auto)
 * @param params.source - Where the modal was triggered from
 * @param params.context - Optional additional context
 */
export function trackAuthModalOpened(params: {
  mode: "login" | "signup" | "auto";
  source: string;
  context?: string;
}) {
  const payload = {
    mode: params.mode,
    source: params.source,
    context: params.context,
  };
  track("auth_modal_opened", payload);
  fireToUserEvents("auth_modal_opened", payload);
}

/**
 * Track when the auth modal is closed without the user taking any auth action.
 * Dual-fires to GA4 and /api/events for internal funnel measurement.
 * @param params.mode - The mode the modal was in when dismissed
 * @param params.source - Where the modal was triggered from
 */
export function trackAuthModalClosedWithoutAction(params: {
  mode: "login" | "signup" | "auto";
  source: string;
}) {
  const payload = {
    mode: params.mode,
    source: params.source,
  };
  track("auth_modal_closed_without_action", payload);
  fireToUserEvents("auth_modal_closed_without_action", payload);
}

/**
 * Track when user selects an auth method (GA4 only).
 * @param params.method - The auth method selected (apple/google/password/magic_link)
 * @param params.mode - The current mode (login/signup)
 */
export function trackAuthMethodSelected(params: {
  method: "apple" | "google" | "password" | "magic_link";
  mode: "login" | "signup";
}) {
  const eventParams = {
    method: params.method,
    mode: params.mode,
  };
  track("auth_method_selected", eventParams);
  fireToUserEvents("auth_method_selected", eventParams);
}

/**
 * Track when user clicks a specific auth provider button (Google, Apple, Email).
 * Dual-fires to GA4 and /api/events for internal funnel measurement.
 * @param params.provider - The provider that was selected
 * @param params.mode - The current mode (login/signup)
 * @param params.source - Where the modal was triggered from
 */
export function trackAuthProviderSelected(params: {
  provider: "apple" | "google" | "email_password" | "magic_link";
  mode: "login" | "signup";
  source: string;
}) {
  const payload = {
    provider: params.provider,
    mode: params.mode,
    source: params.source,
  };
  track("auth_provider_selected", payload);
  fireToUserEvents("auth_provider_selected", payload);
}

/**
 * Track when the email signup form is submitted (before success/failure).
 * Dual-fires to GA4 and /api/events for internal funnel measurement.
 * @param params.mode - The current mode (login/signup)
 * @param params.source - Where the modal was triggered from
 */
export function trackSignupFormSubmitted(params: {
  mode: "login" | "signup";
  source: string;
}) {
  const payload = {
    mode: params.mode,
    source: params.source,
  };
  track("signup_form_submitted", payload);
  fireToUserEvents("signup_form_submitted", payload);
}

/**
 * Track when a login attempt starts
 * @param method - The auth method being used
 */
export function trackLoginStarted(method: string) {
  track("login_started", {
    method,
    timestamp: Date.now(),
  });
}

/**
 * Track successful login completion
 * @param params.method - The auth method used
 * @param params.duration_ms - Time taken to complete login
 */
export function trackLoginSuccess(params: {
  method: string;
  duration_ms: number;
}) {
  const eventParams = {
    method: params.method,
    duration_ms: params.duration_ms,
  };
  track("login_success", eventParams);
  fireToUserEvents("login_success", eventParams);
}

/**
 * Track failed login attempt
 * @param params.method - The auth method attempted
 * @param params.error_type - The type of error encountered
 */
export function trackLoginFailed(params: {
  method: string;
  error_type: string;
}) {
  track("login_failed", {
    method: params.method,
    error_type: params.error_type,
  });
}

/**
 * Track when a signup attempt starts
 * @param method - The auth method being used
 */
export function trackSignupStarted(method: string) {
  const eventParams = {
    method,
    timestamp: Date.now(),
  };
  track("signup_started", eventParams);
  fireToUserEvents("signup_started", eventParams);
}

/**
 * Track successful signup completion
 * @param params.method - The auth method used
 * @param params.requires_verification - Whether email verification is required
 */
export function trackSignupSuccess(params: {
  method: string;
  requires_verification: boolean;
}) {
  const eventParams = {
    method: params.method,
    requires_verification: params.requires_verification,
  };
  track("signup_success", eventParams);
  fireToUserEvents("signup_success", eventParams);
}

/**
 * Track failed signup attempt
 * @param params.method - The auth method attempted
 * @param params.error_type - The type of error encountered
 */
export function trackSignupFailed(params: {
  method: string;
  error_type: string;
}) {
  track("signup_failed", {
    method: params.method,
    error_type: params.error_type,
  });
}

/**
 * Track when a magic link email is sent
 * @param email_domain - The domain of the email (for analytics, not full email)
 */
export function trackMagicLinkSent(email_domain: string) {
  track("magic_link_sent", {
    email_domain,
  });
}

/**
 * Track when a user clicks a magic link from email
 */
export function trackMagicLinkClicked() {
  track("magic_link_clicked", {
    timestamp: Date.now(),
  });
}

/**
 * Track successful auth redirect completion
 * @param return_path - The path the user was redirected to
 */
export function trackAuthRedirectCompleted(return_path: string) {
  track("auth_redirect_completed", {
    return_path,
  });
}

/**
 * Re-export existing auth wall events for consistency
 */

/**
 * Track when the auth wall/gate is shown to user
 * @param delay_ms - The delay before showing the wall
 */
export function trackAuthWallShown(delay_ms: number) {
  track("auth_wall_shown", {
    delay_ms,
  });
}

/**
 * Track when user dismisses the auth wall/gate
 */
export function trackAuthWallDismissed() {
  track("auth_wall_dismissed", {
    timestamp: Date.now(),
  });
}

/**
 * Utility function to categorize auth errors for analytics
 * @param error - The error object or message
 * @returns A categorized error type string
 */
export function categorizeAuthError(error: unknown): string {
  if (typeof error === "string") {
    if (error.includes("invalid_credentials")) return "invalid_credentials";
    if (error.includes("email not confirmed")) return "email_not_confirmed";
    if (error.includes("weak_password")) return "weak_password";
    if (error.includes("email already exists")) return "email_exists";
    if (error.includes("network")) return "network_error";
    return "unknown_error";
  }

  if (error instanceof Error) {
    return categorizeAuthError(error.message);
  }

  return "unknown_error";
}

/**
 * Extract email domain for privacy-safe analytics
 * @param email - Full email address
 * @returns Just the domain portion (e.g., "gmail.com")
 */
export function extractEmailDomain(email: string): string {
  const parts = email.split("@");
  return parts.length > 1 ? parts[1] : "unknown";
}
