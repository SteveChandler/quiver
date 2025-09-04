"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { SessionWizard } from "@/components/session/wizard/SessionWizard";
import { SessionFormMode } from "@/hooks/useSessionWizard";
import {
  createPlannedSession,
  createLoggedSession,
} from "@/actions/session-actions";
import { uploadSessionPhotosAction } from "@/actions/session-media-actions";
import { createActivity } from "@/actions/activity-actions";
import { useAuth } from "@/context/auth-context";

function NewSessionPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [showCelebration, setShowCelebration] = useState(false);

  // Get mode from URL params (default to 'plan')
  const mode = (searchParams.get("mode") as SessionFormMode) || "plan";
  const convertSessionId = searchParams.get("convert"); // For converting planned sessions

  // Soft-auth: Allow UI to render; server actions enforce auth

  // Handle session completion
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

        result = await createPlannedSession(plannedSessionData, user.id);

        if (!result.success) {
          throw new Error(result.error);
        }

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
        };

        result = await createLoggedSession(loggedSessionData, user.id);

        if (!result.success) {
          throw new Error(result.error);
        }

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

      // Show celebration with enhanced logging
      console.log(
        `🎉 Session ${mode} completed successfully! Showing celebration...`
      );
      setShowCelebration(true);

      // Trigger celebration with confetti
      if (typeof window !== "undefined") {
        const reduce = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches;
        console.log(`Reduced motion preference: ${reduce}`);
        if (!reduce) {
          import("canvas-confetti")
            .then(({ default: confetti }) => {
              console.log("🎊 Launching confetti animation!");
              confetti({
                particleCount: 140,
                spread: 70,
                origin: { y: 0.6 },
              });
            })
            .catch((error) => {
              console.error("Failed to load confetti:", error);
            });
        } else {
          console.log("Confetti skipped due to reduced motion preference");
        }
      }

      // Redirect to profile after extended celebration (5 seconds for better visibility)
      setTimeout(() => {
        console.log("🎉 Celebration complete, redirecting to profile...");
        router.push("/profile");
      }, 5000);
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

  // Handle photo upload
  const handlePhotoUpload = async (sessionId: string, photos: File[]) => {
    try {
      const formData = new FormData();
      formData.append("fileCount", photos.length.toString());

      photos.forEach((file, index) => {
        formData.append(`file_${index}`, file);
      });

      const uploadResult = await uploadSessionPhotosAction(sessionId, formData);

      if (uploadResult.success) {
        toast.success(
          `Photos uploaded: ${uploadResult.data.uploaded} of ${photos.length}`
        );
      } else {
        toast.warning("Some photos failed to upload");
      }
    } catch (error) {
      console.error("Photo upload error:", error);
      toast.warning("Photos could not be uploaded");
    }
  };

  // Handle session invitations
  const handleSessionInvitations = async (
    sessionId: string,
    invitees: any[],
    message?: string
  ) => {
    try {
      await fetch("/api/session-planner/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          invitees,
          message,
        }),
      });
    } catch (error) {
      console.error("Error sending invitations:", error);
      // Don't show error toast since this is fire-and-forget
    }
  };

  // Handle cancellation
  const handleCancel = () => {
    router.push("/profile");
  };

  // Utility function to combine date and time
  const combineDateAndTime = (
    date?: string,
    time?: string
  ): string | undefined => {
    if (!date) return undefined;

    if (date && time) {
      // Create a Date object from the selected date and time
      const dateTimeString = `${date}T${time}:00`;
      const dateTime = new Date(dateTimeString);

      // Format as PostgreSQL timestamp with timezone
      return dateTime
        .toISOString()
        .replace("T", " ")
        .replace(/\.\d{3}Z$/, "+00");
    } else {
      // If only date is provided, use start of day
      const dateTime = new Date(`${date}T00:00:00`);
      return dateTime
        .toISOString()
        .replace("T", " ")
        .replace(/\.\d{3}Z$/, "+00");
    }
  };

  // Utility function to parse duration
  const parseDuration = (duration: string): number | undefined => {
    if (!duration) return undefined;

    const hourMatch = duration.match(/(\d+)h/);
    const minuteMatch = duration.match(/(\d+)m/);
    const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
    const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;

    return hours * 60 + minutes;
  };

  // Don't render if user is not authenticated
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 relative">
      <SessionWizard
        mode={mode}
        onComplete={handleSessionComplete}
        onCancel={handleCancel}
        className="min-h-screen"
      />

      {/* Celebration overlay with enhanced visibility */}
      {showCelebration && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none bg-black/10">
          <div className="text-center animate-in fade-in zoom-in duration-500 bg-white/95 backdrop-blur-sm rounded-2xl p-8 border-4 border-green-500 shadow-2xl">
            <h2 className="text-6xl font-bold text-green-600 mb-4">
              🎉 Success!
            </h2>
            <p className="text-2xl text-gray-700 font-semibold">
              {mode === "plan" ? "Session Planned!" : "Session Logged!"}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Redirecting in 5 seconds...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading session form…</p>
          </div>
        </div>
      }
    >
      <NewSessionPageContent />
    </Suspense>
  );
}
