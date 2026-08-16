"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SessionFormMode } from "@/hooks/use-session-form";
import { createLoggedSession } from "@/actions/session-actions";
import { uploadSessionPhotosAction } from "@/actions/session-media-actions";
import { createActivity } from "@/actions/activity-actions";
import { track } from "@/lib/analytics";
import { useTrackEvent } from "@/hooks/use-track-event";
import {
  buildSessionLogEventMetadata,
  createSessionLogFlowId,
} from "@/lib/analytics/session-log-funnel";
import { slugify } from "@/lib/utils/text-utils";
import { buildSessionPayload } from "@/lib/utils/session-data-builder";
import { buildSessionShareUrl } from "@/lib/share/build-share-card-url";
import { saveLastBeach } from "@/hooks/use-nearest-beach";

interface UseSessionSubmissionOptions {
  mode: SessionFormMode;
  user: { id: string } | null;
  forecastFeedbackId?: string;
}

export function useSessionSubmission({
  mode,
  user,
  forecastFeedbackId,
}: UseSessionSubmissionOptions) {
  const router = useRouter();
  const { track: trackSupabaseEvent } = useTrackEvent();
  const fallbackFlowIdRef = useRef(createSessionLogFlowId());

  // Share state
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [showSharePrompt, setShowSharePrompt] = useState(false);
  const [savedSessionData, setSavedSessionData] = useState<any | null>(null);
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);

  /**
   * Handle sharing session
   */
  const handleShareSession = () => {
    if (!savedSessionData) return;

    // Track share attempt
    try {
      track("session_share_opened_post_save", {
        session_id: createdSessionId,
        mode,
      });
    } catch (e) {
      console.error("Error tracking share attempt:", e);
    }

    setShareSheetOpen(true);
  };

  /**
   * Handle skipping the share prompt — navigates to profile with session highlighted.
   */
  const handleSkipShare = () => {
    setShowSharePrompt(false);
    const highlightId = createdSessionId ?? "";
    router.push(`/profile?highlight=${highlightId}`);
  };

  /**
   * Handle share sheet close
   */
  const handleShareSheetClose = (open: boolean) => {
    setShareSheetOpen(open);
    if (!open) {
      // Track share completion/cancellation
      try {
        track("session_share_closed_post_save", {
          session_id: createdSessionId,
          mode,
        });
      } catch (e) {
        console.error("Error tracking share close:", e);
      }

      // Navigate to profile with the session highlighted so the user
      // has a clear next step instead of being stuck on the overlay.
      setShowSharePrompt(false);
      const highlightId = createdSessionId ?? "";
      router.push(`/profile?highlight=${highlightId}`);
    }
  };

  /**
   * Handle photo upload
   */
  const handlePhotoUpload = async (sessionId: string, photos: File[]) => {
    try {
      const formData = new FormData();
      formData.append("fileCount", photos.length.toString());

      photos.forEach((file, index) => {
        formData.append(`file_${index}`, file);
      });

      const uploadResult = await uploadSessionPhotosAction(sessionId, formData);

      if (uploadResult.success) {
        const uploaded = uploadResult.data?.uploaded ?? photos.length;
        toast.success(`Photos uploaded: ${uploaded} of ${photos.length}`);
      } else {
        toast.warning("Some photos failed to upload");
      }
    } catch (error) {
      console.error("Photo upload error:", error);
      toast.warning("Photos could not be uploaded");
    }
  };

  /**
   * Handle session completion - main orchestrator
   */
  const handleSessionComplete = async (sessionData: any) => {
    if (!user?.id) {
      toast.error("Authentication required");
      return;
    }

    try {
      // Create logged session using shared builder (single source of truth for condition fields)
      const loggedSessionData = buildSessionPayload(
        sessionData,
        user.id
      );

      const result = await createLoggedSession(
        forecastFeedbackId
          ? {
              ...loggedSessionData,
              forecast_feedback_context_id: forecastFeedbackId,
            }
          : loggedSessionData
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      // Save session data for sharing
      setSavedSessionData(sessionData);
      setCreatedSessionId(result.data.id);

      // Persist last-used beach for quick-log auto-detection
      if (sessionData.selectedBeachId && sessionData.selectedBeach) {
        saveLastBeach({
          id: sessionData.selectedBeachId,
          name: sessionData.selectedBeach,
        });
      }

      // Submit-funnel telemetry only; session_created is the session-count event.
      try {
        const flowId =
          sessionData.sessionLogFlowId ?? fallbackFlowIdRef.current;
        const wave = sessionData.waveQuality
          ? parseInt(sessionData.waveQuality)
          : undefined;
        const crowd = sessionData.crowdLevel
          ? parseInt(sessionData.crowdLevel)
          : undefined;
        let water: number | undefined;
        if (sessionData.waterTemp) {
          const m = String(sessionData.waterTemp).match(/(\d+)/);
          water = m ? parseInt(m[1]) : undefined;
        }
        const submitMetadata = buildSessionLogEventMetadata(flowId, {
          event_id: `session:${result.data.id}:submit:web:v1`,
          session_id: result.data.id,
        });
        const analyticsSubmitMetadata = {
          ...submitMetadata,
          beach_slug: sessionData.selectedBeach
            ? slugify(sessionData.selectedBeach)
            : sessionData.selectedBeachId,
          wave_rating: isFinite(wave as number) ? wave : undefined,
          crowd: isFinite(crowd as number) ? crowd : undefined,
          water_temp: isFinite(water as number) ? water : undefined,
        };
        track("session_log_submit", analyticsSubmitMetadata);
        trackSupabaseEvent("session_log_submit", {
          beachId: sessionData.selectedBeachId,
          metadata: submitMetadata,
          debounceMs: 0,
        });
      } catch (e) { console.error('[SessionSubmission] error:', e); }

      // Analytics: success
      void createActivity("session_logged", "session", result.data.id, {
        hasPhotos: (sessionData.photos || []).length > 0,
      });

      toast.success("Logged. Nice one.");

      // Upload photos in background (handlePhotoUpload shows its own toast notifications)
      if (sessionData.photos && sessionData.photos.length > 0) {
        handlePhotoUpload(result.data.id, sessionData.photos).catch((err) =>
          console.error("Background photo upload failed:", err)
        );
      }

      // Show share prompt for log mode instead of navigating immediately
      setShowSharePrompt(true);
    } catch (error) {
      console.error("Error creating session:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create session. Please try again."
      );
    }
  };

  // Build share card URL from saved session data (null until a session is logged)
  const shareCardUrl = savedSessionData
    ? buildSessionShareUrl({
        beach: savedSessionData.selectedBeach || savedSessionData.selectedBeachId || "Unknown Beach",
        rating: savedSessionData.overallRating
          ? String(savedSessionData.overallRating)
          : "Good",
        stars: savedSessionData.overallRating
          ? Math.round(Number(savedSessionData.overallRating))
          : 4,
        size: savedSessionData.waveSize || savedSessionData.waveHeight || "Waist-Chest",
        board: savedSessionData.boardUsed || savedSessionData.board || "",
      })
    : null;

  return {
    // States
    shareSheetOpen,
    setShareSheetOpen,
    showSharePrompt,
    setShowSharePrompt,
    savedSessionData,
    createdSessionId,
    shareCardUrl,
    // Handlers
    handleSessionComplete,
    handleShareSession,
    handleShareSheetClose,
    handleSkipShare,
  };
}
