import { track } from "@/lib/analytics";

import { isNativeApp } from "./platform";

const DEFAULT_TITLE = "Share your session";
const DEFAULT_TEXT = "Check out this Quiver session!";

export type ShareChannel = "capacitor" | "web" | "fallback";

export interface ShareSessionOptions {
  title?: string;
  text?: string;
  url?: string;
  fallback?: (context: ShareFallbackContext) => Promise<void> | void;
  analytics?: ShareAnalyticsContext;
}

export type ShareResult =
  | { method: "capacitor"; url: string }
  | { method: "web"; url: string }
  | {
      method: "unsupported";
      url: string;
      reason: ShareFallbackContext["reason"];
      attemptedChannel: ShareChannel;
      error?: string;
    };

export interface ShareAnalyticsContext {
  surface: string;
  sessionId: string;
  beachId?: string;
  variant?: string;
}

export interface ShareFallbackContext {
  reason: "unsupported" | "error";
  channel: ShareChannel;
  error?: string;
}

export async function shareSession(
  sessionId: string,
  options: ShareSessionOptions = {}
): Promise<ShareResult> {
  const url = options.url ?? buildSessionUrl(sessionId);
  const title = options.title ?? DEFAULT_TITLE;
  const text = options.text ?? DEFAULT_TEXT;
  let lastError: unknown;
  let lastChannel: ShareChannel = "fallback";

  const trackShare = (
    event: "share_session_attempt" | "share_session_success" | "share_session_error" | "share_session_fallback",
    channel: ShareChannel,
    extra: Record<string, unknown> = {}
  ) => {
    if (!options.analytics) return;
    track(event, {
      ...options.analytics,
      channel,
      ...extra,
    });
  };

  if (isNativeApp()) {
    try {
      lastChannel = "capacitor";
      trackShare("share_session_attempt", lastChannel);
      const { Share } = await import("@capacitor/share");

      const shareable = await Share.canShare?.();
      if (!shareable?.value) {
        throw new Error("Share plugin not available");
      }

      await Share.share({
        title,
        text,
        url,
      });

      trackShare("share_session_success", lastChannel);

      return { method: "capacitor", url };
    } catch (error) {
      lastError = error;
      trackShare("share_session_error", lastChannel, {
        error: error instanceof Error ? error.message : String(error),
      });
      console.warn("Capacitor share failed, falling back", error);
    }
  }

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      lastChannel = "web";
      trackShare("share_session_attempt", lastChannel);
      await navigator.share({ title, text, url });
      trackShare("share_session_success", lastChannel);
      return { method: "web", url };
    } catch (error) {
      lastError = error;
      trackShare("share_session_error", lastChannel, {
        error: error instanceof Error ? error.message : String(error),
      });
      console.warn("Web share failed, falling back", error);
    }
  }

  const fallbackContext: ShareFallbackContext = {
    reason: lastError ? "error" : "unsupported",
    channel: lastChannel,
    error: lastError
      ? lastError instanceof Error
        ? lastError.message
        : String(lastError)
      : undefined,
  };

  trackShare("share_session_fallback", "fallback", fallbackContext);
  if (options.fallback) {
    await options.fallback(fallbackContext);
  }

  return {
    method: "unsupported",
    url,
    reason: fallbackContext.reason,
    attemptedChannel: fallbackContext.channel,
    error: fallbackContext.error,
  };
}

export function buildSessionUrl(sessionId: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/sessions/${sessionId}`;
  }
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://quiversurf.app";
  return `${origin}/sessions/${sessionId}`;
}
