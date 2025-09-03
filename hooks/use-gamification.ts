"use client";

import { useCallback, useState } from "react";
import { useXPToastSystem } from "@/components/gamification/xp-toast-system";
import { trackXP, getUserXPStatus, getUserBadges } from "@/lib/gamification-actions";
import type { XPAction, XPTrackingResult } from "@/lib/gamification-actions";

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

/**
 * Hook for session-related XP tracking
 */
export function useSessionGamification() {
  const gamification = useGamification();

  const trackSessionPlanned = useCallback(
    async (sessionId: string) => {
      return gamification.trackUserXP("plan_session", sessionId, "session");
    },
    [gamification]
  );

  const trackSessionReflection = useCallback(
    async (sessionId: string) => {
      return gamification.trackUserXP("write_reflection", sessionId, "session");
    },
    [gamification]
  );

  const trackBoardTagged = useCallback(
    async (sessionId: string) => {
      return gamification.trackUserXP("tag_board_to_session", sessionId, "session");
    },
    [gamification]
  );

  const trackFriendsTagged = useCallback(
    async (sessionId: string) => {
      return gamification.trackUserXP("tag_friends_in_session", sessionId, "session");
    },
    [gamification]
  );

  const trackSurfTags = useCallback(
    async (sessionId: string) => {
      return gamification.trackUserXP("add_surf_tags", sessionId, "session");
    },
    [gamification]
  );

  const trackTemperatureRecorded = useCallback(
    async (sessionId: string) => {
      return gamification.trackUserXP("record_temperature", sessionId, "session");
    },
    [gamification]
  );

  return {
    ...gamification,
    trackSessionPlanned,
    trackSessionReflection,
    trackBoardTagged,
    trackFriendsTagged,
    trackSurfTags,
    trackTemperatureRecorded,
  };
}

/**
 * Hook for board/quiver-related XP tracking
 */
export function useQuiverGamification() {
  const gamification = useGamification();

  const trackBoardAdded = useCallback(
    async (boardId: string) => {
      return gamification.trackUserXP("add_board", boardId, "board");
    },
    [gamification]
  );

  return {
    ...gamification,
    trackBoardAdded,
  };
}

/**
 * Hook for intel/community-related XP tracking
 */
export function useIntelGamification() {
  const gamification = useGamification();

  const trackIntelPosted = useCallback(
    async (intelPostId: string) => {
      return gamification.trackUserXP("post_beach_intel", intelPostId, "intel_post");
    },
    [gamification]
  );

  const trackIntelReviewed = useCallback(
    async (reviewId: string) => {
      return gamification.trackUserXP("review_intel", reviewId, "review");
    },
    [gamification]
  );

  const trackCrowdParkingSubmitted = useCallback(
    async (reviewId: string) => {
      return gamification.trackUserXP("submit_crowd_parking", reviewId, "review");
    },
    [gamification]
  );

  return {
    ...gamification,
    trackIntelPosted,
    trackIntelReviewed,
    trackCrowdParkingSubmitted,
  };
}

/**
 * Hook for social-related XP tracking
 */
export function useSocialGamification() {
  const gamification = useGamification();

  const trackFriendInvited = useCallback(
    async (inviteId: string) => {
      return gamification.trackUserXP("invite_friend", inviteId, "invite");
    },
    [gamification]
  );

  const trackPhotoPosted = useCallback(
    async (photoId: string) => {
      return gamification.trackUserXP("post_surf_photos", photoId, "photo");
    },
    [gamification]
  );

  const trackLikeReceived = useCallback(
    async (entityId: string) => {
      return gamification.trackUserXP("get_like_upvote", entityId);
    },
    [gamification]
  );

  return {
    ...gamification,
    trackFriendInvited,
    trackPhotoPosted,
    trackLikeReceived,
  };
}