import posthog from "posthog-js";
import { getAttributionForAnalytics } from "@/lib/attribution";

type PostHogProperties = Record<string, unknown>;
type PostHogClient = typeof posthog & { __quiverInitialized?: boolean };

const POSTHOG_HOST = "/ingest";
const POSTHOG_UI_HOST = "https://us.posthog.com";

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

export function initPostHog(): boolean {
  if (typeof window === "undefined") return false;
  if (!isPostHogEnabled()) return false;

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
    return true;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[PostHog] Failed to initialize:", error);
    }
    return false;
  }
}

export function captureClientPostHogEvent(
  event: string,
  properties: PostHogProperties = {}
): void {
  if (!initPostHog()) return;

  try {
    posthog.capture(event, {
      ...getBaseProperties(),
      ...properties,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[PostHog] Failed to capture event:", error);
    }
  }
}

export function identifyPostHogUser(
  userId: string,
  properties: PostHogProperties = {}
): void {
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
  if (!initPostHog()) return;

  try {
    posthog.reset();
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
}
