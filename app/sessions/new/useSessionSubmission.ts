"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SessionFormMode } from "@/hooks/use-session-form";
import {
  createPlannedSession,
  createLoggedSession,
} from "@/actions/session-actions";
import { uploadSessionPhotosAction } from "@/actions/session-media-actions";
import { createActivity } from "@/actions/activity-actions";
import { track } from "@/lib/analytics";
import { slugify } from "@/lib/utils/text-utils";
import { createForecastSnapshot } from "@/actions/forecast-calibration-actions";
import { type ForecastFeedback } from "@/components/forecast/forecast-feedback-form";
import { REVIEW_TIMEOUTS } from "@/lib/constants/review-tracking";
import { combineDateAndTime, parseDuration } from "./utils";

interface UseSessionSubmissionOptions {
  mode: SessionFormMode;
  user: { id: string } | null;
  reviewPrompt: ReturnType<typeof import("@/hooks/use-review-prompt").useReviewPrompt>;
  convertSessionId?: string | null;
}

/**
 * Load the closest forecast for feedback based on session arrival time
 */
async function tryLoadClosestForecastForFeedback(session: any) {
  try {
    const beachId = session?.beach_id;
    const arrivalTimeRaw = session?.arrival_time;
    if (!beachId || !arrivalTimeRaw) return null;

    const arrival = new Date(arrivalTimeRaw);
    if (Number.isNaN(arrival.getTime())) return null;

    const response = await fetch(
      `/api/forecasts/update-enhanced?beachId=${encodeURIComponent(
        beachId
      )}&days=2`
    );

    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    const forecasts = payload?.data?.forecasts || payload?.forecasts || [];
    if (!Array.isArray(forecasts) || forecasts.length === 0) return null;

    const arrivalDate = arrival.toISOString().split("T")[0];
    const sameDay = forecasts.filter(
      (f: any) => String(f?.forecast_date || "") === arrivalDate
    );
    const candidates = sameDay.length > 0 ? sameDay : forecasts;

    let best: any | null = null;
    let bestDiff = Infinity;

    for (const f of candidates) {
      const dateStr = String(f?.forecast_date || "");
      const timeStrRaw = String(f?.forecast_time || "");
      if (!dateStr) continue;
      const hhmm = timeStrRaw.includes(":")
        ? timeStrRaw.slice(0, 5)
        : "00:00";
      const forecastTs = new Date(`${dateStr}T${hhmm}:00Z`);
      const diff = Math.abs(forecastTs.getTime() - arrival.getTime());
      if (diff < bestDiff) {
        bestDiff = diff;
        best = f;
      }
    }

    return best;
  } catch (e) {
    console.error("Failed to load forecast for feedback:", e);
    return null;
  }
}

export function useSessionSubmission({
  mode,
  user,
  reviewPrompt,
  convertSessionId,
}: UseSessionSubmissionOptions) {
  const router = useRouter();

  // Celebration and share state
  const [showCelebration, setShowCelebration] = useState(false);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [savedSessionData, setSavedSessionData] = useState<any | null>(null);
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);

  // Forecast feedback state
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSession, setFeedbackSession] = useState<any | null>(null);
  const [feedbackForecast, setFeedbackForecast] = useState<any | null>(null);
  const [feedbackResolved, setFeedbackResolved] = useState(false);
  const feedbackResolvedRef = useRef(false);

  /**
   * Start celebration animation and redirect to profile
   */
  const startCelebrationAndRedirect = (modeToCelebrate: SessionFormMode) => {
    setShowCelebration(true);

    // Trigger celebration with confetti
    if (typeof window !== "undefined") {
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      if (!reduce) {
        import("canvas-confetti")
          .then(({ default: confetti }) => {
            confetti({
              particleCount: 140,
              spread: 70,
              origin: { y: 0.6 },
            });
          })
          .catch(() => {
            // Silently fail - confetti is non-essential
          });
      }
    }

    // Redirect to profile after extended celebration (5 seconds for better visibility)
    setTimeout(() => {
      router.push("/profile");
    }, REVIEW_TIMEOUTS.CELEBRATION_DURATION);
  };

  /**
   * Show review prompt after feedback (if beach_id exists)
   */
  const showReviewPromptIfEligible = () => {
    // Try to get beach info from feedbackSession first, then fallback to savedSessionData
    const beachId = feedbackSession?.beach_id || savedSessionData?.selectedBeachId;
    const beachName = feedbackSession?.beach_name || savedSessionData?.selectedBeach;

    if (beachId && beachName) {
      reviewPrompt.showPrompt({
        beachId,
        beachName,
        sessionId: createdSessionId,
      });
    } else {
      // No beach info available, skip review prompt
      startCelebrationAndRedirect("log");
    }
  };

  /**
   * Handle skipping forecast feedback
   */
  const handleSkipFeedback = (reason: "skip" | "timeout") => {
    if (feedbackResolvedRef.current) return;
    feedbackResolvedRef.current = true;
    setFeedbackResolved(true);
    setFeedbackOpen(false);
    try {
      if (feedbackSession?.id) {
        track("forecast_feedback_skipped", {
          session_id: feedbackSession.id,
          reason,
        });
      }
    } catch (e) { console.error('[SessionSubmission] error:', e); }
    // Instead of celebration, show review prompt
    showReviewPromptIfEligible();
  };

  /**
   * Handle submitting forecast feedback
   */
  const handleSubmitFeedback = async (feedback: ForecastFeedback) => {
    if (
      !feedbackSession?.id ||
      feedbackSubmitting ||
      feedbackResolvedRef.current
    ) {
      return;
    }

    setFeedbackSubmitting(true);
    try {
      const forecast = feedbackForecast;
      const forecastSnapshot = forecast
        ? {
            wave_height: forecast.wave_height,
            wave_period: forecast.wave_period,
            wave_direction: forecast.wave_direction,
            wind_speed: forecast.wind_speed,
            wind_direction: forecast.wind_direction,
            water_temp: forecast.water_temp,
            air_temperature: forecast.air_temperature,
            confidence_score: forecast.confidence_score,
            data_source: forecast.data_source,
            swell_1_height: forecast.swell_1_height,
            swell_1_period: forecast.swell_1_period,
            swell_1_direction: forecast.swell_1_direction,
            swell_2_height: forecast.swell_2_height,
            swell_2_period: forecast.swell_2_period,
            swell_2_direction: forecast.swell_2_direction,
            wind_wave_height: forecast.wind_wave_height,
            wind_wave_period: forecast.wind_wave_period,
            wind_wave_direction: forecast.wind_wave_direction,
            forecast_time: forecast.forecast_time,
            forecast_date: forecast.forecast_date,
          }
        : {};

      const actualConditions = {
        wave_height: feedback.waveHeight,
        wind_condition: feedback.windCondition,
        wind_speed: feedback.windSpeed ?? null,
        overall_accuracy: feedback.overallAccuracy,
        notes: feedback.notes ?? null,
        // also persist session context (keeps parity with DB-trigger snapshot shape)
        wave_quality: feedbackSession.wave_quality ?? null,
        water_temp: feedbackSession.water_temp ?? null,
        crowd_level: feedbackSession.crowd_level ?? null,
        parking_ease: feedbackSession.parking_ease ?? null,
        rating: feedbackSession.rating ?? null,
        duration_minutes: feedbackSession.duration_minutes ?? null,
        arrival_time: feedbackSession.arrival_time ?? null,
      };

      const result = await createForecastSnapshot(
        feedbackSession.id,
        forecastSnapshot as any,
        actualConditions as any
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to save forecast feedback");
      }

      try {
        track("forecast_feedback_submitted", {
          session_id: feedbackSession.id,
          overall_accuracy: feedback.overallAccuracy,
        });
      } catch (e) { console.error('[SessionSubmission] error:', e); }

      feedbackResolvedRef.current = true;
      setFeedbackResolved(true);
      setFeedbackOpen(false);
      toast.success("Thanks! Your feedback helps improve forecasts.");
      // Instead of celebration, show review prompt
      showReviewPromptIfEligible();
    } catch (error) {
      console.error("Error saving forecast feedback:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save feedback. You can still finish your session."
      );
      // Don't block completion on feedback errors
      handleSkipFeedback("skip");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

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
   * Handle session invitations
   */
  const handleSessionInvitations = async (
    sessionId: string,
    invitees: any[],
    message?: string
  ) => {
    try {
      const response = await fetch("/api/session-planner/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          invitees,
          message,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        const errMessage =
          payload?.error ||
          (typeof payload?.details === "string"
            ? payload.details
            : response.statusText) ||
          "Failed to send invitations";
        console.error("Invitation API error:", errMessage, payload);
        toast.error("Failed to send invitations");
        return;
      }

      const inviteErrors: string[] = payload?.data?.errors ?? [];
      if (inviteErrors.length > 0) {
        console.warn("Invitation warnings:", inviteErrors);
        toast.warning(inviteErrors[0]);
      }
    } catch (error) {
      console.error("Error sending invitations:", error);
      toast.error("Failed to send invitations");
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
      // Analytics: session creation attempt
      void createActivity("session_creation_attempt", "session", "n/a", {
        mode,
        hasPhotos: (sessionData.photos || []).length > 0,
        convertSessionId,
      });

      let result;

      if (mode === "plan") {
        // Create planned session
        const plannedSessionData = {
          beach_name: sessionData.selectedBeach,
          beach_id: sessionData.selectedBeachId,
          arrival_time: combineDateAndTime(
            sessionData.selectedDate,
            sessionData.selectedTime
          ),
          board_id: sessionData.boardId,
          user_id: user.id,
          notes: sessionData.notes || undefined,
          status: "planned" as const,
        };

        result = await createPlannedSession(plannedSessionData);

        if (!result.success) {
          throw new Error(result.error);
        }

        // Save session data for sharing
        setSavedSessionData(sessionData);
        setCreatedSessionId(result.data.id);

        // Handle invitations if any (fire-and-forget)
        if (sessionData.invitees && sessionData.invitees.length > 0) {
          void handleSessionInvitations(
            result.data.id,
            sessionData.invitees,
            sessionData.invitationMessage
          );
        }

        // Analytics: success
        void createActivity("session_planned", "session", result.data.id, {
          inviteesCount: sessionData.invitees?.length || 0,
        });

        toast.success("Session planned successfully!");
      } else {
        // Create logged session
        const loggedSessionData = {
          beach_name: sessionData.selectedBeach,
          beach_id: sessionData.selectedBeachId,
          arrival_time: combineDateAndTime(
            sessionData.selectedDate,
            sessionData.selectedTime
          ),
          board_id: sessionData.boardId,
          user_id: user.id,
          notes: sessionData.notes || undefined,
          status: "completed" as const,
          // Additional logging fields
          ...(sessionData.duration && {
            duration_minutes: parseDuration(sessionData.duration),
          }),
          ...(sessionData.waveQuality && {
            wave_quality: parseInt(sessionData.waveQuality),
          }),
          ...(sessionData.waterTemp && { water_temp: sessionData.waterTemp }),
          ...(sessionData.crowdLevel && {
            crowd_level: parseInt(sessionData.crowdLevel),
          }),
          ...(sessionData.parkingEase && {
            parking_ease: parseInt(sessionData.parkingEase),
          }),
          ...(sessionData.overallRating && {
            rating: parseInt(sessionData.overallRating),
          }),
          // Condition fields
          ...(sessionData.waveHeight !== undefined && {
            wave_height_ft: sessionData.waveHeight,
          }),
          ...(sessionData.windSpeed !== undefined && {
            wind_speed_mph: sessionData.windSpeed,
          }),
          ...(sessionData.windDirection && {
            wind_direction: sessionData.windDirection,
          }),
          ...(sessionData.tideHeight !== undefined && {
            tide_height_ft: sessionData.tideHeight,
          }),
          ...(sessionData.tideStatus && {
            tide_status: sessionData.tideStatus,
          }),
          // Forecast accuracy feedback
          ...(sessionData.forecastAccuracy && {
            forecast_accuracy: sessionData.forecastAccuracy,
          }),
        };

        result = await createLoggedSession(loggedSessionData);

        if (!result.success) {
          throw new Error(result.error);
        }

        // Save session data for sharing
        setSavedSessionData(sessionData);
        setCreatedSessionId(result.data.id);

        // Analytics: session_log_submit (mark as conversion in GA UI)
        try {
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
          track("session_log_submit", {
            beach_slug: sessionData.selectedBeach
              ? slugify(sessionData.selectedBeach)
              : sessionData.selectedBeachId,
            wave_rating: isFinite(wave as number) ? wave : undefined,
            crowd: isFinite(crowd as number) ? crowd : undefined,
            water_temp: isFinite(water as number) ? water : undefined,
          });
        } catch (e) { console.error('[SessionSubmission] error:', e); }

        // Handle photo uploads if any
        if (sessionData.photos && sessionData.photos.length > 0) {
          await handlePhotoUpload(result.data.id, sessionData.photos);
        }

        // Analytics: success
        void createActivity("session_logged", "session", result.data.id, {
          hasPhotos: (sessionData.photos || []).length > 0,
        });

        toast.success("Session logged successfully!");
      }

      // Log sessions: capture actual conditions before celebrating/redirecting.
      // Plan sessions: keep existing celebrate+redirect behavior.
      if (mode === "log") {
        const loggedSession = result?.data;
        if (loggedSession?.id) {
          // If the wizard already collected actual conditions, use them directly
          // and skip the post-log feedback modal (avoid redundancy).
          const hasWizardActuals =
            typeof sessionData?.waveHeight === "number" ||
            typeof sessionData?.windSpeed === "number" ||
            Boolean(sessionData?.windDirection) ||
            Boolean(sessionData?.forecastAccuracy);

          if (hasWizardActuals) {
            const closest = await tryLoadClosestForecastForFeedback(
              loggedSession
            );
            const forecastSnapshot = closest
              ? {
                  wave_height: closest.wave_height,
                  wave_period: closest.wave_period,
                  wave_direction: closest.wave_direction,
                  wind_speed: closest.wind_speed,
                  wind_direction: closest.wind_direction,
                  water_temp: closest.water_temp,
                  air_temperature: closest.air_temperature,
                  confidence_score: closest.confidence_score,
                  data_source: closest.data_source,
                  swell_1_height: closest.swell_1_height,
                  swell_1_period: closest.swell_1_period,
                  swell_1_direction: closest.swell_1_direction,
                  swell_2_height: closest.swell_2_height,
                  swell_2_period: closest.swell_2_period,
                  swell_2_direction: closest.swell_2_direction,
                  wind_wave_height: closest.wind_wave_height,
                  wind_wave_period: closest.wind_wave_period,
                  wind_wave_direction: closest.wind_wave_direction,
                  forecast_time: closest.forecast_time,
                  forecast_date: closest.forecast_date,
                }
              : {};

            const accuracyToScore = (value: any): number | null => {
              if (!value) return null;
              if (value === "accurate") return 5;
              if (value === "somewhat") return 3;
              if (value === "inaccurate") return 1;
              return null;
            };

            const actualConditions = {
              wave_height:
                typeof sessionData?.waveHeight === "number"
                  ? sessionData.waveHeight
                  : null,
              wind_speed:
                typeof sessionData?.windSpeed === "number"
                  ? sessionData.windSpeed
                  : null,
              wind_direction: sessionData?.windDirection ?? null,
              wave_types: Array.isArray(sessionData?.waveTypes)
                ? sessionData.waveTypes
                : null,
              overall_accuracy: accuracyToScore(sessionData?.forecastAccuracy),
              notes: null,
              // session context
              wave_quality: loggedSession.wave_quality ?? null,
              water_temp: loggedSession.water_temp ?? null,
              crowd_level: loggedSession.crowd_level ?? null,
              parking_ease: loggedSession.parking_ease ?? null,
              rating: loggedSession.rating ?? null,
              duration_minutes: loggedSession.duration_minutes ?? null,
              arrival_time: loggedSession.arrival_time ?? null,
            };

            try {
              const snapResult = await createForecastSnapshot(
                loggedSession.id,
                forecastSnapshot as any,
                actualConditions as any
              );
            } catch (e) {
              console.error(
                "Failed to save forecast snapshot from wizard actuals:",
                e
              );
            }

            // Instead of celebration, show review prompt (if beach_id exists)
            if (loggedSession.beach_id && sessionData?.selectedBeach) {
              reviewPrompt.showPrompt({
                beachId: loggedSession.beach_id,
                beachName: sessionData.selectedBeach,
                sessionId: loggedSession.id,
              });
            } else {
              startCelebrationAndRedirect("log");
            }
            return;
          }

          // Store beach info with the session for the review prompt
          setFeedbackSession({
            ...loggedSession,
            beach_name: sessionData?.selectedBeach || loggedSession.beach_name,
          });
          const closest = await tryLoadClosestForecastForFeedback(
            loggedSession
          );
          setFeedbackForecast(closest);
          feedbackResolvedRef.current = false;
          setFeedbackResolved(false);
          setFeedbackOpen(true);

          // Safety net: don't block completion forever
          setTimeout(() => {
            if (!feedbackResolvedRef.current) {
              handleSkipFeedback("timeout");
            }
          }, REVIEW_TIMEOUTS.FEEDBACK_AUTO_DISMISS);
          return;
        }
      }

      startCelebrationAndRedirect(mode);
    } catch (error) {
      console.error("Error creating session:", error);

      // Analytics: failure
      void createActivity("session_creation_failed", "session", "n/a", {
        error: error instanceof Error ? error.message : "Unknown error",
        mode,
      });

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create session. Please try again."
      );
    }
  };

  return {
    // States
    showCelebration,
    shareSheetOpen,
    setShareSheetOpen,
    savedSessionData,
    createdSessionId,
    feedbackOpen,
    feedbackSubmitting,
    feedbackSession,
    feedbackForecast,
    feedbackResolved,
    feedbackResolvedRef,
    // Handlers
    handleSessionComplete,
    handleShareSession,
    handleShareSheetClose,
    handleSubmitFeedback,
    handleSkipFeedback,
    startCelebrationAndRedirect,
  };
}
