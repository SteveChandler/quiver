import { track } from "@/lib/analytics";

import { isNativeApp } from "./platform";
import { downloadShareImage, createShareImageFile } from "@/lib/utils/share-image-utils";

const DEFAULT_TITLE = "Share your session";
const DEFAULT_TEXT = "Check out this Quiver session!";

export type ShareChannel = "capacitor" | "web" | "fallback";

export interface ShareSessionOptions {
  title?: string;
  text?: string;
  url?: string;
  imageUrl?: string; // Optional share image URL
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
  const imageUrl = options.imageUrl;
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

  // Try sharing with image if provided
  if (imageUrl) {
    try {
      const imageBlob = await downloadShareImage(imageUrl);
      const imageFile = createShareImageFile(imageBlob, sessionId, "story");

      if (isNativeApp()) {
        try {
          lastChannel = "capacitor";
          trackShare("share_session_attempt", lastChannel);
          const { Share } = await import("@capacitor/share");

          const shareable = await Share.canShare?.();
          if (!shareable?.value) {
            throw new Error("Share plugin not available");
          }

          // Capacitor Share API doesn't directly support files
          // Fall through to Web Share API
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
          console.warn("Capacitor share with image failed, trying web share", error);
        }
      }

      // Try Web Share API with files
      if (
        typeof navigator !== "undefined" &&
        navigator.share &&
        navigator.canShare?.({ files: [imageFile] })
      ) {
        try {
          lastChannel = "web";
          trackShare("share_session_attempt", lastChannel);
          await navigator.share({
            title,
            text,
            url,
            files: [imageFile],
          });
          trackShare("share_session_success", lastChannel);
          return { method: "web", url };
        } catch (error) {
          lastError = error;
          trackShare("share_session_error", lastChannel, {
            error: error instanceof Error ? error.message : String(error),
          });
          console.warn("Web share with image failed, trying without image", error);
        }
      }
    } catch (imageError) {
      console.warn("Failed to download share image, falling back to text-only share", imageError);
    }
  }

  // Fallback to text-only sharing
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
    return `${window.location.origin}/sessions/${sessionId}`; // eslint-disable-line no-restricted-properties
  }
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://quiversurf.app";
  return `${origin}/sessions/${sessionId}`;
}
