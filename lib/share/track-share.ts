/**
 * Share Analytics Tracker
 * Tracks share events to database and analytics services
 */

import type {
  SharePlatform,
  ShareVariant,
  AspectRatio,
  ShareEvent,
  ShareTrackingResult,
} from "@/types/session-share";
import { track } from "@/lib/analytics";
import { createServerClient } from "@/lib/supabase";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

/**
 * Track share event to database
 * Inserts row into session_shares table
 */
async function trackShareToDatabase(
  event: ShareEvent,
  isServer: boolean = false
): Promise<ShareTrackingResult> {
  try {
    const supabase = isServer ? createServerClient() : createSupabaseBrowser();

    const { data, error } = await supabase
      .from("session_shares")
      .insert({
        session_id: event.sessionId,
        user_id: event.userId,
        platform: event.platform,
        variant: String(event.variant), // Store as string for consistency
        aspect_ratio: event.aspectRatio,
        share_url: event.shareUrl,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to track share to database:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      shareId: data?.id,
    };
  } catch (error) {
    console.error("Exception tracking share to database:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Track share event to Google Analytics
 * Fires gtag event if GA is configured
 */
function trackShareToAnalytics(
  event: ShareEvent,
  surface: string = "session_detail"
): void {
  try {
    track("share", {
      method: event.platform,
      content_type: "session",
      content_id: event.sessionId,
      variant: event.variant,
      aspect_ratio: event.aspectRatio,
      surface: surface,
    });

    // Also fire platform-specific event
    track(`share_${event.platform}`, {
      session_id: event.sessionId,
      variant: event.variant,
      aspect_ratio: event.aspectRatio,
      surface: surface,
    });
  } catch (error) {
    // Swallow analytics errors to avoid disrupting UX
    console.error("Failed to track share to analytics:", error);
  }
}

/**
 * Track share event (main function)
 * Tracks to both database and analytics
 */
export async function trackShare(
  platform: SharePlatform,
  options: {
    sessionId: string;
    userId: string;
    variant: ShareVariant;
    aspectRatio: AspectRatio;
    shareUrl?: string;
    surface?: string;
    isServer?: boolean;
  }
): Promise<ShareTrackingResult> {
  const event: ShareEvent = {
    sessionId: options.sessionId,
    userId: options.userId,
    platform: platform,
    variant: options.variant,
    aspectRatio: options.aspectRatio,
    shareUrl: options.shareUrl,
  };

  // Track to analytics (non-blocking)
  trackShareToAnalytics(event, options.surface);

  // Track to database
  return trackShareToDatabase(event, options.isServer);
}

/**
 * Track share platform selection
 * Fires when user clicks a share button (before actual share)
 */
export function trackSharePlatformSelected(
  platform: SharePlatform,
  options: {
    sessionId: string;
    variant: ShareVariant;
    aspectRatio: AspectRatio;
    surface?: string;
  }
): void {
  try {
    track("share_platform_selected", {
      platform: platform,
      session_id: options.sessionId,
      variant: options.variant,
      aspect_ratio: options.aspectRatio,
      surface: options.surface || "session_detail",
    });
  } catch (error) {
    console.error("Failed to track platform selection:", error);
  }
}

/**
 * Track share completion
 * Fires when share is successfully completed
 */
export function trackShareCompleted(
  platform: SharePlatform,
  options: {
    sessionId: string;
    variant: ShareVariant;
    aspectRatio: AspectRatio;
    surface?: string;
  }
): void {
  try {
    track("share_completed", {
      platform: platform,
      session_id: options.sessionId,
      variant: options.variant,
      aspect_ratio: options.aspectRatio,
      surface: options.surface || "session_detail",
    });
  } catch (error) {
    console.error("Failed to track share completion:", error);
  }
}

/**
 * Track share failure
 * Fires when share fails
 */
export function trackShareFailed(
  platform: SharePlatform,
  options: {
    sessionId: string;
    variant: ShareVariant;
    aspectRatio: AspectRatio;
    error: string;
    surface?: string;
  }
): void {
  try {
    track("share_failed", {
      platform: platform,
      session_id: options.sessionId,
      variant: options.variant,
      aspect_ratio: options.aspectRatio,
      error: options.error,
      surface: options.surface || "session_detail",
    });
  } catch (error) {
    console.error("Failed to track share failure:", error);
  }
}

/**
 * Track variant change
 * Fires when user changes the card variant
 */
export function trackVariantChanged(
  variant: ShareVariant,
  options: {
    sessionId: string;
    previousVariant?: ShareVariant;
    surface?: string;
  }
): void {
  try {
    track("share_variant_changed", {
      variant: variant,
      previous_variant: options.previousVariant,
      session_id: options.sessionId,
      surface: options.surface || "session_detail",
    });
  } catch (error) {
    console.error("Failed to track variant change:", error);
  }
}

/**
 * Track aspect ratio change
 * Fires when user changes the aspect ratio
 */
export function trackAspectRatioChanged(
  aspectRatio: AspectRatio,
  options: {
    sessionId: string;
    previousAspectRatio?: AspectRatio;
    surface?: string;
  }
): void {
  try {
    track("share_aspect_ratio_changed", {
      aspect_ratio: aspectRatio,
      previous_aspect_ratio: options.previousAspectRatio,
      session_id: options.sessionId,
      surface: options.surface || "session_detail",
    });
  } catch (error) {
    console.error("Failed to track aspect ratio change:", error);
  }
}

/**
 * Track download started
 * Fires when user starts downloading an image
 */
export function trackDownloadStarted(options: {
  sessionId: string;
  variant: ShareVariant;
  aspectRatio: AspectRatio;
  surface?: string;
}): void {
  try {
    track("share_download_started", {
      session_id: options.sessionId,
      variant: options.variant,
      aspect_ratio: options.aspectRatio,
      surface: options.surface || "session_detail",
    });
  } catch (error) {
    console.error("Failed to track download started:", error);
  }
}

/**
 * Track download completed
 * Fires when download successfully completes
 */
export function trackDownloadCompleted(options: {
  sessionId: string;
  variant: ShareVariant;
  aspectRatio: AspectRatio;
  fileSize?: number;
  surface?: string;
}): void {
  try {
    track("share_download_completed", {
      session_id: options.sessionId,
      variant: options.variant,
      aspect_ratio: options.aspectRatio,
      file_size: options.fileSize,
      surface: options.surface || "session_detail",
    });
  } catch (error) {
    console.error("Failed to track download completed:", error);
  }
}

/**
 * Increment session share count
 * Updates the share_count field on sessions table
 */
export async function incrementSessionShareCount(
  sessionId: string,
  isServer: boolean = false
): Promise<void> {
  try {
    const supabase = isServer ? createServerClient() : createSupabaseBrowser();

    const { error } = await supabase.rpc("increment_session_share_count", {
      session_id: sessionId,
    });

    if (error) {
      console.error("Failed to increment share count:", error);
    }
  } catch (error) {
    console.error("Exception incrementing share count:", error);
  }
}
