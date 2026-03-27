"use client";

import { useCallback } from "react";

import { useToast } from "@/hooks/use-toast";
import { useWebPushRegistration } from "@/hooks/useWebPushRegistration";
import { updateProfile } from "@/actions/profile-actions";
import { track } from "@/lib/analytics";

/**
 * Result of attempting to enable reminders
 */
export interface ReminderResult {
  success: boolean;
  errorType?: "denied" | "error" | "unsupported";
  errorMessage?: string;
}

/**
 * Configuration for the reminder handler
 */
interface UseReminderHandlerConfig {
  /** Current home beach ID (if set) */
  homeBeachId: string | null;
  /** Callback to refresh profile data after update */
  onProfileUpdate?: () => void;
}

/**
 * Hook for handling forecast reminder enablement
 *
 * Extracts the platform-specific push notification registration logic
 * and profile update flow into a reusable hook.
 *
 * @example
 * ```tsx
 * const { enableReminder } = useReminderHandler({
 *   homeBeachId: homeBeach?.id ?? null,
 *   onProfileUpdate: refreshProfile,
 * });
 *
 * // Later in your component
 * const result = await enableReminder(beachId, beachName);
 * if (result.success) {
 *   // Handle success
 * }
 * ```
 */
export function useReminderHandler({
  homeBeachId,
  onProfileUpdate,
}: UseReminderHandlerConfig) {
  const { toast } = useToast();
  const { requestPushOptIn: requestWebPush, isSupported: webPushSupported } =
    useWebPushRegistration();

  /**
   * Handle push registration for web browsers
   * Returns null if successful, or a ReminderResult on failure
   */
  const handlePushRegistration = useCallback(
    async (
      beachId: string,
      beachName: string
    ): Promise<ReminderResult | null> => {
      const platform = "web";

      // Skip web push if not supported
      if (!webPushSupported) {
        console.warn("Web push not supported, continuing with profile update only");
        return null;
      }

      const pushResult = await requestWebPush();

      if (pushResult.status === "denied") {
        toast({
          title: "Push notifications blocked",
          description: "Enable notifications in browser settings to get alerts.",
          variant: "destructive",
        });
        track("first_win_reminder_declined", {
          beach_id: beachId,
          beach_name: beachName,
          platform,
          reason: "push_denied",
        });
        return { success: false, errorType: "denied" };
      }

      if (pushResult.status === "error") {
        toast({
          title: "Couldn't enable push notifications",
          description: pushResult.detail || "Please try again or check your settings.",
          variant: "destructive",
        });
        track("first_win_reminder_declined", {
          beach_id: beachId,
          beach_name: beachName,
          platform,
          reason: "push_error",
        });
        return {
          success: false,
          errorType: "error",
          errorMessage: pushResult.detail,
        };
      }

      if (pushResult.status === "unsupported") {
        console.warn("Web push not supported, continuing with profile update only");
      }

      // Success or unsupported (continue with profile update)
      return null;
    },
    [requestWebPush, webPushSupported, toast]
  );

  /**
   * Enable forecast reminders for a beach
   *
   * Handles:
   * 1. Platform-specific push notification registration
   * 2. Profile update (notification flags + home beach if needed)
   * 3. Success/error toasts and analytics tracking
   */
  const enableReminder = useCallback(
    async (beachId: string, beachName: string): Promise<ReminderResult> => {
      const platform = "web";

      try {
        // Step 1: Handle push registration
        const pushError = await handlePushRegistration(beachId, beachName);
        if (pushError) {
          return pushError;
        }

        // Step 2: Update profile with notification flags
        const updateData: Record<string, unknown> = {
          notif_push_enabled: true,
          notif_forecast_alerts: true,
        };

        // Set home beach if not already set
        if (!homeBeachId) {
          updateData.home_beach_id = beachId;
        }

        await updateProfile(updateData);

        // Step 3: Refresh profile cache
        onProfileUpdate?.();

        // Step 4: Success feedback
        toast({
          title: "Reminders enabled!",
          description: `We'll notify you when ${beachName} has good conditions.`,
        });

        track("first_win_reminder_enabled", {
          beach_id: beachId,
          beach_name: beachName,
          platform,
        });

        return { success: true };
      } catch (error) {
        console.error("Failed to enable reminder:", error);
        toast({
          title: "Couldn't enable reminders",
          description: "Please try again or check your settings.",
          variant: "destructive",
        });
        track("first_win_reminder_declined", {
          beach_id: beachId,
          beach_name: beachName,
          platform,
          reason: "error",
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          success: false,
          errorType: "error",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    [homeBeachId, handlePushRegistration, onProfileUpdate, toast]
  );

  return {
    /** Enable forecast reminders for a beach */
    enableReminder,
  };
}
