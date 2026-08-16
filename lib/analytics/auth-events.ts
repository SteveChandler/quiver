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
import { getBrowserSessionId } from "@/lib/utils/browser-session-id";
import { getVisitorId } from "@/lib/utils/visitor-id";
import { captureClientPostHogEvent } from "@/lib/posthog-client";
import { enrichWithWebAnalyticsContext } from "@/lib/analytics/web-context";

export type SignupProvider = "password" | "apple" | "google";
export type SignupRedirectState = "inline" | "pending" | "completed";
export const SIGNUP_FLOW_TTL_MS = 15 * 60 * 1000;

export interface SignupFlowContext {
  flow_id: string;
  provider: SignupProvider;
  source?: string;
  landing_page?: string;
  redirect_path?: string;
  redirect_state: SignupRedirectState;
  started_at: number;
}

const SIGNUP_FLOW_KEY = "quiver_signup_flow";
const signupTerminalFlows = new Set<string>();

function createSignupFlowId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `signup_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function normalizeSignupProvider(method: string): SignupProvider {
  if (method === "apple") return "apple";
  if (method === "google" || method === "google_one_tap") return "google";
  return "password";
}

function readSignupFlow(): SignupFlowContext | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = sessionStorage.getItem(SIGNUP_FLOW_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<SignupFlowContext>;
    if (
      typeof parsed.flow_id !== "string" ||
      typeof parsed.provider !== "string" ||
      typeof parsed.redirect_state !== "string" ||
      typeof parsed.started_at !== "number"
    ) {
      sessionStorage.removeItem(SIGNUP_FLOW_KEY);
      return undefined;
    }
    if (Date.now() - parsed.started_at > SIGNUP_FLOW_TTL_MS) {
      sessionStorage.removeItem(SIGNUP_FLOW_KEY);
      return undefined;
    }
    return parsed as SignupFlowContext;
  } catch {
    return undefined;
  }
}

function writeSignupFlow(flow: SignupFlowContext): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SIGNUP_FLOW_KEY, JSON.stringify(flow));
  } catch {
    // Analytics correlation must never break auth.
  }
}

export function getSignupFlow(): SignupFlowContext | undefined {
  return readSignupFlow();
}

export function clearSignupFlow(flowId?: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = readSignupFlow();
    if (!flowId || current?.flow_id === flowId) {
      sessionStorage.removeItem(SIGNUP_FLOW_KEY);
    }
  } catch {
    // Analytics correlation must never break auth.
  }
}

function resolveSignupFlow(
  method: string,
  options?: {
    flow_id?: string;
    provider?: SignupProvider;
    source?: string;
    landing_page?: string;
    redirect_path?: string;
    redirect_state?: SignupRedirectState;
    started_at?: number;
  },
): SignupFlowContext | undefined {
  const existing = readSignupFlow();
  if (options?.flow_id) {
    const matchingExisting = existing?.flow_id === options.flow_id ? existing : undefined;
    const startedAt = options.started_at ?? matchingExisting?.started_at;
    if (startedAt != null && Date.now() - startedAt > SIGNUP_FLOW_TTL_MS) {
      if (matchingExisting) clearSignupFlow(matchingExisting.flow_id);
      return undefined;
    }
    return {
      flow_id: options.flow_id,
      provider: options.provider ?? matchingExisting?.provider ?? normalizeSignupProvider(method),
      ...((options.source ?? matchingExisting?.source) && {
        source: options.source ?? matchingExisting?.source,
      }),
      ...((options.landing_page ?? matchingExisting?.landing_page) && {
        landing_page: options.landing_page ?? matchingExisting?.landing_page,
      }),
      ...((options.redirect_path ?? matchingExisting?.redirect_path) && {
        redirect_path: options.redirect_path ?? matchingExisting?.redirect_path,
      }),
      redirect_state:
        options.redirect_state ?? matchingExisting?.redirect_state ?? "inline",
      started_at:
        options.started_at ?? matchingExisting?.started_at ?? Date.now(),
    };
  }
  return existing;
}

function isSignupTerminalAlreadyRecorded(flowId: string): boolean {
  if (signupTerminalFlows.has(flowId)) return true;
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(`quiver_signup_terminal_${flowId}`) === "1";
  } catch {
    return false;
  }
}

function markSignupTerminal(flow: SignupFlowContext): void {
  signupTerminalFlows.add(flow.flow_id);
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(`quiver_signup_terminal_${flow.flow_id}`, "1");
    } catch {
      // Analytics correlation must never break auth.
    }
  }
  clearSignupFlow(flow.flow_id);
}

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

function fireToPostHog(eventType: string, params: Record<string, unknown>) {
  captureClientPostHogEvent(eventType, params);
}

function withBrowserSessionId(params: Record<string, unknown>): Record<string, unknown> {
  const browserSessionId = getBrowserSessionId();

  if (!browserSessionId) return params;

  return {
    ...params,
    browser_session_id: browserSessionId,
  };
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
  const payload = enrichWithWebAnalyticsContext(
    {
      mode: params.mode,
      source: params.source,
      context: params.context,
    },
    { includeSignupChannel: params.mode === "signup" }
  );
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
  const payload = enrichWithWebAnalyticsContext(
    {
      mode: params.mode,
      source: params.source,
    },
    { includeSignupChannel: params.mode === "signup" }
  );
  track("auth_modal_closed_without_action", payload);
  fireToUserEvents("auth_modal_closed_without_action", payload);
}

/**
 * @deprecated Use {@link trackAuthProviderSelected} instead. This helper is a
 * no-op retained only so existing call sites compile while we migrate dashboards
 * off the redundant `auth_method_selected` event. The event type remains in the
 * union (`types/implicit-preferences.ts`) for backwards compatibility with SQL
 * dashboards, but no new events will be emitted from the client.
 *
 * @param params.method - The auth method selected (apple/google/password/magic_link)
 * @param params.mode - The current mode (login/signup)
 */
export function trackAuthMethodSelected(_params: {
  method: "apple" | "google" | "password" | "magic_link";
  mode: "login" | "signup";
}): void {
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "[deprecated] trackAuthMethodSelected: use trackAuthProviderSelected instead"
    );
  }
}

/**
 * Track when user clicks a specific auth provider button (Google, Apple, Email).
 * Dual-fires to GA4 and /api/events for internal funnel measurement.
 *
 * The `provider` value is narrowed to the three user-visible provider buckets
 * ('apple' | 'google' | 'email') to match AuthProviderSelectedMetadata and
 * keep the signup funnel groupable. Email-based sub-methods (password vs.
 * magic_link) are preserved in the GA4-only `email_method` field; the
 * internal user_events payload only carries the normalized provider.
 *
 * @param params.provider - The provider bucket that was selected
 * @param params.mode - The current mode (login/signup)
 * @param params.source - Where the modal was triggered from
 * @param params.email_method - For provider='email', which sub-flow was used
 */
export function trackAuthProviderSelected(params: {
  provider: "apple" | "google" | "email";
  mode: "login" | "signup";
  source: string;
  email_method?: "password" | "magic_link";
}) {
  const ga4Payload = enrichWithWebAnalyticsContext(
    {
      provider: params.provider,
      mode: params.mode,
      source: params.source,
      ...(params.email_method && { email_method: params.email_method }),
    },
    { includeSignupChannel: params.mode === "signup" }
  );
  const userEventsPayload = enrichWithWebAnalyticsContext(
    {
      provider: params.provider,
      mode: params.mode,
      source: params.source,
    },
    { includeSignupChannel: params.mode === "signup" }
  );
  track("auth_provider_selected", ga4Payload);
  fireToUserEvents("auth_provider_selected", userEventsPayload);
}

/**
 * Track when the email SIGNUP form is submitted (before success/failure).
 * Dual-fires to GA4 and /api/events for internal funnel measurement.
 *
 * Scope: only fires when the auth modal is in signup mode. The parallel
 * login helper is {@link trackLoginFormSubmitted}. Historically this function
 * accepted `mode: "login" | "signup"` and callers fired it for both modes;
 * that conflated 96% of events into the signup funnel and produced a false
 * 92% dropoff alarm (F3 investigation, 2026-04-20).
 *
 * @param params.source - Where the modal was triggered from
 */
export function trackSignupFormSubmitted(params: {
  source: string;
}) {
  const payload = enrichWithWebAnalyticsContext(
    {
      mode: "signup" as const,
      source: params.source,
    },
    { includeSignupChannel: true }
  );
  track("signup_form_submitted", payload);
  fireToUserEvents("signup_form_submitted", payload);
}

/**
 * Track when the email LOGIN form is submitted (before success/failure).
 * Dual-fires to GA4 and /api/events for internal funnel measurement.
 *
 * Split from `trackSignupFormSubmitted` on 2026-04-20 so the login path
 * stops inflating the signup funnel. Historical `signup_form_submitted` rows
 * with `metadata.mode='login'` remain in the DB for continuity.
 *
 * @param params.source - Where the modal was triggered from
 */
export function trackLoginFormSubmitted(params: {
  source: string;
}) {
  const payload = enrichWithWebAnalyticsContext(
    withBrowserSessionId({
      mode: "login" as const,
      source: params.source,
    }),
  );
  track("login_form_submitted", payload);
  fireToUserEvents("login_form_submitted", payload);
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
  source?: string;
  landing_page?: string;
  flow_id?: string;
  redirect_path?: string;
  redirect_state?: SignupRedirectState;
  started_at?: number;
}) {
  const eventParams = enrichWithWebAnalyticsContext(
    withBrowserSessionId({
      method: params.method,
      duration_ms: params.duration_ms,
      ...(params.source && { source: params.source }),
      ...(params.landing_page && { landing_page: params.landing_page }),
      ...(params.flow_id && { flow_id: params.flow_id }),
      ...(params.started_at && { started_at: params.started_at }),
      ...(params.redirect_path && { redirect_path: params.redirect_path }),
      ...(params.redirect_state && { redirect_state: params.redirect_state }),
    }),
    { pathname: params.landing_page },
  );
  track("login_success", eventParams);
  fireToUserEvents("login_success", eventParams);
  fireToPostHog("user_signed_in", eventParams);
}

/**
 * Track failed login attempt
 * @param params.method - The auth method attempted
 * @param params.error_type - The type of error encountered
 */
export function trackLoginFailed(params: {
  method: string;
  error_type: string;
  source?: string;
  landing_page?: string;
}) {
  const eventParams = enrichWithWebAnalyticsContext(
    withBrowserSessionId({
      method: params.method,
      error_type: params.error_type,
      ...(params.source && { source: params.source }),
      ...(params.landing_page && { landing_page: params.landing_page }),
    }),
    { pathname: params.landing_page },
  );
  track("login_failed", eventParams);
  fireToUserEvents("login_failed", eventParams);
}

/**
 * Track when a signup attempt starts
 * @param method - The auth method being used
 * @param options.source - The CTA source string (e.g., "intent-longboard-torrance")
 * @param options.landing_page - The pathname at the time of signup
 */
export function trackSignupStarted(
  method: string,
  options?: {
    source?: string;
    landing_page?: string;
    flow_id?: string;
    redirect_path?: string;
    redirect_state?: SignupRedirectState;
    started_at?: number;
  },
): SignupFlowContext {
  const provider = normalizeSignupProvider(method);
  const flow: SignupFlowContext = {
    flow_id: options?.flow_id ?? createSignupFlowId(),
    provider,
    ...(options?.source && { source: options.source }),
    ...(options?.landing_page && { landing_page: options.landing_page }),
    ...(options?.redirect_path && { redirect_path: options.redirect_path }),
    redirect_state: options?.redirect_state ?? "inline",
    started_at: options?.started_at ?? Date.now(),
  };
  writeSignupFlow(flow);
  const eventParams = enrichWithWebAnalyticsContext(
    withBrowserSessionId({
      method: provider,
      provider,
      flow_id: flow.flow_id,
      started_at: flow.started_at,
      redirect_state: flow.redirect_state,
      timestamp: Date.now(),
      ...(options?.source && { source: options.source }),
      ...(options?.landing_page && { landing_page: options.landing_page }),
      ...(options?.redirect_path && { redirect_path: options.redirect_path }),
    }),
    { includeSignupChannel: true, pathname: options?.landing_page }
  );
  track("signup_started", eventParams);
  fireToUserEvents("signup_started", eventParams);
  return flow;
}

/**
 * Track successful signup completion
 * @param params.method - The auth method used
 * @param params.requires_verification - Whether email verification is required
 * @param params.source - The CTA source string (e.g., "intent-longboard-torrance")
 * @param params.landing_page - The pathname at the time of signup
 */
export function trackSignupSuccess(params: {
  method: string;
  requires_verification: boolean;
  source?: string;
  landing_page?: string;
  flow_id?: string;
  redirect_path?: string;
  redirect_state?: SignupRedirectState;
  started_at?: number;
}) {
  const flow = resolveSignupFlow(params.method, {
    flow_id: params.flow_id,
    source: params.source,
    landing_page: params.landing_page,
    redirect_path: params.redirect_path,
    redirect_state: params.redirect_state,
    started_at: params.started_at,
  });
  if (params.flow_id && params.started_at && !flow) return;
  if (flow && isSignupTerminalAlreadyRecorded(flow.flow_id)) return;
  if (flow) markSignupTerminal(flow);
  const provider = flow?.provider ?? normalizeSignupProvider(params.method);
  const eventParams = enrichWithWebAnalyticsContext(
    withBrowserSessionId({
      method: provider,
      provider,
      requires_verification: params.requires_verification,
      ...((params.source ?? flow?.source) && {
        source: params.source ?? flow?.source,
      }),
      ...((params.landing_page ?? flow?.landing_page) && {
        landing_page: params.landing_page ?? flow?.landing_page,
      }),
      ...(flow && { flow_id: flow.flow_id }),
      ...(flow && { started_at: flow.started_at }),
      ...(flow && {
        redirect_state: params.redirect_state ?? flow.redirect_state,
      }),
      ...((params.redirect_path ?? flow?.redirect_path) && {
        redirect_path: params.redirect_path ?? flow?.redirect_path,
      }),
    }),
    { includeSignupChannel: true, pathname: params.landing_page }
  );
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
  source?: string;
  landing_page?: string;
  flow_id?: string;
  redirect_path?: string;
  redirect_state?: SignupRedirectState;
  started_at?: number;
}) {
  const flow = resolveSignupFlow(params.method, {
    flow_id: params.flow_id,
    source: params.source,
    landing_page: params.landing_page,
    redirect_path: params.redirect_path,
    redirect_state: params.redirect_state,
    started_at: params.started_at,
  });
  if (params.flow_id && params.started_at && !flow) return;
  if (flow && isSignupTerminalAlreadyRecorded(flow.flow_id)) return;
  if (flow) markSignupTerminal(flow);
  const provider = flow?.provider ?? normalizeSignupProvider(params.method);
  const eventParams = enrichWithWebAnalyticsContext(
    withBrowserSessionId({
      method: provider,
      provider,
      error_type: params.error_type,
      ...((params.source ?? flow?.source) && {
        source: params.source ?? flow?.source,
      }),
      ...((params.landing_page ?? flow?.landing_page) && {
        landing_page: params.landing_page ?? flow?.landing_page,
      }),
      ...(flow && { flow_id: flow.flow_id }),
      ...(flow && { started_at: flow.started_at }),
      ...(flow && {
        redirect_state: params.redirect_state ?? flow.redirect_state,
      }),
      ...((params.redirect_path ?? flow?.redirect_path) && {
        redirect_path: params.redirect_path ?? flow?.redirect_path,
      }),
    }),
    { includeSignupChannel: true, pathname: params.landing_page },
  );
  track("signup_failed", eventParams);
  fireToUserEvents("signup_failed", eventParams);
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
