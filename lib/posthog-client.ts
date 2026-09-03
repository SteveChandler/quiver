import posthog from "posthog-js";
import { getAttributionForAnalytics } from "@/lib/attribution";

type PostHogProperties = Record<string, unknown>;
type PostHogClient = typeof posthog & { __quiverInitialized?: boolean };
type PostHogTrackingState = "unknown" | "allowed" | "denied";
type PendingPostHogEvent = {
  event: string;
  properties: PostHogProperties;
};

const POSTHOG_HOST = "/ingest";
const POSTHOG_UI_HOST = "https://us.posthog.com";
const POSTHOG_TRACKING_DENIED_KEY = "quiver_posthog_tracking_denied_v1";
const POSTHOG_SIGNUP_PENDING_PREFIX = "posthog_signup_pending_";
const POSTHOG_SIGNUP_CAPTURED_PREFIX = "posthog_signup_captured_";
const MAX_PENDING_POSTHOG_EVENTS = 50;

let postHogTrackingState: PostHogTrackingState = "unknown";
let postHogTrackingRevision = 0;
const pendingPostHogEvents: PendingPostHogEvent[] = [];

function getPostHogToken(): string {
  return process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ?? "";
}

function getEnvironment(): string {
  return (
    process.env.NEXT_PUBLIC_VERCEL_ENV ??
    process.env.NODE_ENV ??
    "development"
  );
}

function getEmailDomain(email?: string | null): string | undefined {
  if (!email) return undefined;
  const [, domain] = email.split("@");
  return domain || undefined;
}

function getLocationProperties(): PostHogProperties {
  if (typeof window === "undefined") return {};

  // eslint-disable-next-line no-restricted-properties -- Analytics snapshot only; no navigation or routing decision is made here.
  const currentUrl = window.location.href;
  // eslint-disable-next-line no-restricted-properties -- Analytics snapshot only; no navigation or routing decision is made here.
  const pathname = window.location.pathname;
  // eslint-disable-next-line no-restricted-properties -- Analytics snapshot only; no navigation or routing decision is made here.
  const search = window.location.search || undefined;

  return {
    current_url: currentUrl,
    pathname,
    search,
    external_referrer: document.referrer || undefined,
    title: document.title || undefined,
  };
}

function getBaseProperties(): PostHogProperties {
  const attribution =
    typeof window === "undefined"
      ? {}
      : getAttributionForAnalytics({
          includeTimestamp: true,
          includeLandingPage: true,
        });

  return {
    app: "quiver-web",
    platform: "web",
    environment: getEnvironment(),
    ...getLocationProperties(),
    ...attribution,
  };
}

export function isPostHogEnabled(): boolean {
  return Boolean(getPostHogToken());
}

function isPostHogInitialized(): boolean {
  return (posthog as PostHogClient).__quiverInitialized === true;
}

function safelySetPostHogCapturing(enabled: boolean): void {
  try {
    if (enabled) {
      // Runs on every init, so the default `$opt_in` event would fire per page load.
      posthog.opt_in_capturing({ captureEventName: false });
      return;
    }
    posthog.opt_out_capturing();
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[PostHog] Failed to update capture state:", error);
    }
  }
}

function persistPostHogTrackingDenial(denied: boolean): void {
  if (typeof window === "undefined") return;

  try {
    if (denied) {
      window.localStorage.setItem(POSTHOG_TRACKING_DENIED_KEY, "true");
      return;
    }
    window.localStorage.removeItem(POSTHOG_TRACKING_DENIED_KEY);
  } catch {
    // The in-memory gate still prevents capture for the current page.
  }
}

function hasPersistedPostHogTrackingDenial(): boolean {
  if (typeof window === "undefined") return true;

  try {
    return window.localStorage.getItem(POSTHOG_TRACKING_DENIED_KEY) === "true";
  } catch {
    return true;
  }
}

export function initPostHog(): boolean {
  if (typeof window === "undefined") return false;
  if (!isPostHogEnabled()) return false;
  if (postHogTrackingState !== "allowed") return false;

  const posthogClient = posthog as PostHogClient;
  if (posthogClient.__quiverInitialized) return true;

  try {
    posthog.init(getPostHogToken(), {
      api_host: POSTHOG_HOST,
      ui_host: POSTHOG_UI_HOST,
      defaults: "2026-01-30",
      capture_pageview: false,
      autocapture: false,
      persistence: "localStorage+cookie",
      loaded: () => {
        posthogClient.__quiverInitialized = true;
      },
    });
    posthogClient.__quiverInitialized = true;
    safelySetPostHogCapturing(true);
    return true;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[PostHog] Failed to initialize:", error);
    }
    return false;
  }
}

export function setClientPostHogTrackingAllowed(
  allowed: boolean | null,
): number {
  postHogTrackingRevision += 1;
  const previousState = postHogTrackingState;

  if (allowed === null) {
    postHogTrackingState = "unknown";
    if (isPostHogInitialized()) {
      safelySetPostHogCapturing(false);
    }
    return postHogTrackingRevision;
  }

  postHogTrackingState = allowed ? "allowed" : "denied";
  persistPostHogTrackingDenial(!allowed);

  if (!allowed) {
    pendingPostHogEvents.length = 0;
    if (isPostHogInitialized()) {
      safelySetPostHogCapturing(false);
    }
    return postHogTrackingRevision;
  }

  const wasInitialized = isPostHogInitialized();
  if (
    initPostHog() &&
    wasInitialized &&
    previousState !== "allowed"
  ) {
    safelySetPostHogCapturing(true);
  }
  return postHogTrackingRevision;
}

export function setAnonymousClientPostHogTracking(): void {
  setClientPostHogTrackingAllowed(!hasPersistedPostHogTrackingDenial());
}

export function isClientPostHogTrackingRevisionCurrent(
  revision: number,
): boolean {
  return postHogTrackingRevision === revision;
}

export function applyClientPostHogTrackingStorageEvent(
  event: StorageEvent,
): void {
  if (event.key !== POSTHOG_TRACKING_DENIED_KEY) return;
  if (event.newValue !== "true") return;

  setClientPostHogTrackingAllowed(false);
  resetPostHog();
}

export function captureClientPostHogEvent(
  event: string,
  properties: PostHogProperties = {}
): boolean {
  if (postHogTrackingState !== "allowed") return false;
  if (!initPostHog()) return false;

  try {
    posthog.capture(event, {
      ...getBaseProperties(),
      ...properties,
    });
    return true;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[PostHog] Failed to capture event:", error);
    }
    return false;
  }
}

export function captureClientPostHogEventAfterConsent(
  event: string,
  properties: PostHogProperties = {},
): boolean {
  if (postHogTrackingState === "allowed") {
    return captureClientPostHogEvent(event, properties);
  }
  if (postHogTrackingState === "denied") return false;

  if (pendingPostHogEvents.length >= MAX_PENDING_POSTHOG_EVENTS) {
    pendingPostHogEvents.shift();
  }
  pendingPostHogEvents.push({
    event,
    properties: { ...properties },
  });
  return true;
}

export function flushQueuedClientPostHogEvents(): number {
  if (postHogTrackingState !== "allowed") return 0;
  if (!initPostHog()) return 0;

  const events = pendingPostHogEvents.splice(0);
  let capturedCount = 0;

  for (let index = 0; index < events.length; index += 1) {
    const pendingEvent = events[index];
    if (
      pendingEvent &&
      captureClientPostHogEvent(
        pendingEvent.event,
        pendingEvent.properties,
      )
    ) {
      capturedCount += 1;
      continue;
    }

    pendingPostHogEvents.unshift(...events.slice(index));
    break;
  }

  return capturedCount;
}

export function queueClientPostHogSignup(
  userId: string,
  provider: string,
): void {
  if (typeof window === "undefined") return;

  try {
    const capturedKey = `${POSTHOG_SIGNUP_CAPTURED_PREFIX}${userId}`;
    if (window.sessionStorage.getItem(capturedKey) === "true") return;

    window.sessionStorage.setItem(
      `${POSTHOG_SIGNUP_PENDING_PREFIX}${userId}`,
      provider,
    );
  } catch {
    // Signup analytics must never interfere with authentication.
  }
}

export function captureQueuedClientPostHogSignup(userId: string): void {
  if (postHogTrackingState !== "allowed") return;
  if (typeof window === "undefined") return;

  try {
    const pendingKey = `${POSTHOG_SIGNUP_PENDING_PREFIX}${userId}`;
    const capturedKey = `${POSTHOG_SIGNUP_CAPTURED_PREFIX}${userId}`;

    if (window.sessionStorage.getItem(capturedKey) === "true") {
      window.sessionStorage.removeItem(pendingKey);
      return;
    }

    const provider = window.sessionStorage.getItem(pendingKey);
    if (!provider) return;

    const captured = captureClientPostHogEvent("user_signed_up", { provider });
    if (!captured) return;

    window.sessionStorage.setItem(capturedKey, "true");
    window.sessionStorage.removeItem(pendingKey);
  } catch {
    // Keep the event pending when storage or capture is unavailable.
  }
}

export function identifyPostHogUser(
  userId: string,
  properties: PostHogProperties = {}
): void {
  if (postHogTrackingState !== "allowed") return;
  if (!initPostHog()) return;

  try {
    posthog.identify(userId, {
      ...getBaseProperties(),
      ...properties,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[PostHog] Failed to identify user:", error);
    }
  }
}

export function resetPostHog(): void {
  pendingPostHogEvents.length = 0;
  if (!isPostHogInitialized()) return;

  try {
    posthog.reset();
    if (postHogTrackingState !== "allowed") {
      safelySetPostHogCapturing(false);
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[PostHog] Failed to reset user:", error);
    }
  }
}

export function buildPostHogUserProperties(user: {
  email?: string | null;
  created_at?: string;
  app_metadata?: Record<string, unknown>;
}): PostHogProperties {
  const provider =
    typeof user.app_metadata?.provider === "string"
      ? user.app_metadata.provider
      : "email";

  return {
    provider,
    email_domain: getEmailDomain(user.email),
    user_created_at: user.created_at,
  };
}

export function _resetPostHogClientForTesting(): void {
  (posthog as PostHogClient).__quiverInitialized = false;
  postHogTrackingState = "unknown";
  postHogTrackingRevision = 0;
  pendingPostHogEvents.length = 0;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(POSTHOG_TRACKING_DENIED_KEY);
  }
}
