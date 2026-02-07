"use client";

import { useCallback, useState } from "react";
import { useXPToastSystem } from "@/components/gamification/xp-toast-system";
import { trackXP, getUserXPStatus, getUserBadges } from "@/lib/gamification";
import type { XPAction, XPTrackingResult } from "@/lib/gamification";

interface UseGamificationOptions {
  onSuccess?: (result: XPTrackingResult) => void;
  onError?: (error: string) => void;
  showToast?: boolean;
}

/**
 * Hook for integrating gamification into existing flows
 * Provides XP tracking, badge checking, and toast notifications
 */
export function useGamification(options: UseGamificationOptions = {}) {
  const { showToast = true, onSuccess, onError } = options;
  const { showXPGainedToast } = useXPToastSystem();
  const [isTracking, setIsTracking] = useState(false);

  const trackUserXP = useCallback(
    async (
      action: XPAction,
      relatedEntityId?: string,
      relatedEntityType?: "session" | "board" | "intel_post" | "review" | "invite" | "photo"
    ) => {
      if (isTracking) return; // Prevent duplicate tracking
      
      setIsTracking(true);
      try {
        const result = await trackXP(action, relatedEntityId, relatedEntityType);
        
        if (result.success && result.data) {
          if (showToast) {
            showXPGainedToast(result.data);
          }
          onSuccess?.(result.data);
          return result.data;
        } else {
          const error = result.error || "Failed to track XP";
          console.error("XP tracking failed:", error);
          onError?.(error);
          return null;
        }
      } catch (error) {
        console.error("XP tracking error:", error);
        onError?.(error?.toString() || "Unknown error");
        return null;
      } finally {
        setIsTracking(false);
      }
    },
    [isTracking, showToast, showXPGainedToast, onSuccess, onError]
  );

  const getUserGamificationStatus = useCallback(async () => {
    try {
      const [xpResult, badgesResult] = await Promise.all([
        getUserXPStatus(),
        getUserBadges(),
      ]);

      return {
        xp: xpResult.success ? xpResult.data : null,
        badges: badgesResult.success ? badgesResult.data : [],
      };
    } catch (error) {
      console.error("Failed to fetch gamification status:", error);
      return { xp: null, badges: [] };
    }
  }, []);

  return {
    trackUserXP,
    getUserGamificationStatus,
    isTracking,
  };
}
