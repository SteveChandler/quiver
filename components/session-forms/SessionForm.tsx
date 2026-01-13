"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, WavesIcon as Surfboard, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import { useSessionForm, SessionFormMode } from "@/hooks/use-session-form";
import { useAuth } from "@/context/auth-context";
import { SessionFormHeader } from "./SessionFormHeader";
import { LocationStep } from "./LocationStep";
import { EquipmentStep } from "./EquipmentStep";
import { GoalsSection } from "./GoalsSection";
import { ConditionsSection } from "./ConditionsSection";
import { DateTimeSection } from "./DateTimeSection";
import { NotesSection } from "./NotesSection";
import { PhotoSelectionSection } from "./PhotoSelectionSection";
import { OptimalTimesSection } from "./OptimalTimesSection";
import { GearSuggestionsSection } from "./GearSuggestionsSection";
import { SimpleCardLayout } from "@/components/ui/form-layout";
import {
  getFormText,
  getModeStyles,
} from "@/lib/constants/session-form-constants";

import {
  createPlannedSession,
  createLoggedSession,
  getPlannedSessionForConversion,
  updatePlannedSessionToCompleted,
} from "@/actions/session-actions";
import { uploadSessionPhotosAction } from "@/actions/session-media-actions";
import { createActivity } from "@/actions/activity-actions";

import { useForecastCalibration } from "@/hooks/use-forecast-calibration";

interface SessionFormProps {
  initialMode?: SessionFormMode;
  beachId?: string;
  beachName?: string;
  /** Initial time value in HH:MM format (e.g., "08:30") */
  initialTime?: string;
  onSuccess?: () => void;
}

export function SessionForm({
  initialMode = "plan",
  beachId,
  beachName,
  initialTime,
  onSuccess,
}: SessionFormProps) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const paramMode =
    (searchParams.get("mode") as SessionFormMode) || initialMode;
  const convertSessionId = searchParams.get("convert"); // For converting planned sessions
  const router = useRouter();

  const [sessionCreated, setSessionCreated] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [convertingFromPlanned, setConvertingFromPlanned] = useState<
    string | null
  >(null);
  const [createdSession, setCreatedSession] = useState<any>(null);
  const [sessionForecast, setSessionForecast] = useState<any>(null);
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
  const [feedbackCompleted, setFeedbackCompleted] = useState(false);

  const {
    mode,
    setMode,
    loading,
    setLoading,
    boards,
    beaches,
    formState,
    updateField,
    resetForm,
    refreshBoards,
    isPlanning,
  } = useSessionForm(paramMode);

  const text = getFormText(mode);
  const styles = getModeStyles(mode);

  // Optional: prefill beach when embedding (e.g. in a modal)
  useEffect(() => {
    if (beachId) {
      updateField("selectedBeachId", beachId);
    }
    if (beachName) {
      updateField("selectedBeach", beachName);
    }
    // Intentionally only reacts to explicit prop changes
  }, [beachId, beachName, updateField]);

  // Optional: prefill time when provided (e.g., from Magic Hour suggestion)
  useEffect(() => {
    if (initialTime) {
      updateField("selectedTime", initialTime);
    }
  }, [initialTime, updateField]);

  useEffect(() => {
    setMode(paramMode);
  }, [paramMode, setMode]);

  // Set correct mode for conversion
  useEffect(() => {
    if (convertSessionId && mode === "plan") {
      setMode("log");
    }
  }, [convertSessionId, mode, setMode]);

  // Load planned session data for conversion
  useEffect(() => {
    if (convertSessionId && user && !isConverting) {
      setIsConverting(true);
      setConvertingFromPlanned(convertSessionId);

      const loadPlannedSession = async () => {
        try {
          const result = await getPlannedSessionForConversion(convertSessionId);

          // Prefill form with planned session data
          if (result) {
            // Check if result is wrapped in success/data structure
            const sessionData = result.data || result;

            updateField(
              "selectedBeach",
              sessionData.beach?.name || sessionData.beach_name || ""
            );
            updateField("selectedBeachId", sessionData.beach_id || "");
            updateField("boardId", sessionData.board_id || "");
            updateField("notes", sessionData.notes || "");

            // Convert arrival_time back to date and time
            if (sessionData.arrival_time) {
              const arrivalDate = new Date(sessionData.arrival_time);
              const dateString = arrivalDate.toISOString().split("T")[0];
              const timeString = arrivalDate.toTimeString().slice(0, 5);

              updateField("selectedDate", dateString);
              updateField("selectedTime", timeString);
            }

            // Set the board selection properly
            if (sessionData.board_id) {
              updateField("selectedBoard", sessionData.board_id);
            }
          }

          toast.success(
            "Loaded planned session data. Add conditions and complete your log!"
          );
        } catch (error) {
          console.error("Error loading planned session:", error);
          toast.error("Failed to load planned session data");
          router.push("/sessions/new?mode=log"); // Fallback to normal log session
        }
      };

      loadPlannedSession();
    }
  }, [convertSessionId, user, isConverting, updateField, router]);

  // Initialize forecast calibration hook
  const { submitForecastFeedback } = useForecastCalibration({
    sessionId: createdSession?.id,
    beachId: formState.selectedBeachId,
  });

  // Load forecast data for the session when session is created
  useEffect(() => {
    if (
      sessionCreated &&
      createdSession &&
      formState.selectedBeachId &&
      formState.selectedDate
    ) {
      const loadForecast = async () => {
        try {
          // Show feedback prompt for logged sessions
          setShowFeedbackPrompt(true);
        } catch (error) {
          console.error("Error loading forecast for feedback:", error);
          setShowFeedbackPrompt(true);
        }
      };

      if (!isPlanning) {
        loadForecast();
      }
    }
  }, [
    sessionCreated,
    createdSession,
    formState.selectedBeachId,
    formState.selectedDate,
    isPlanning,
  ]);

  // Auto-redirect after session is successfully logged and feedback is handled
  useEffect(() => {
    if (
      !isPlanning &&
      sessionCreated &&
      (feedbackCompleted || !showFeedbackPrompt)
    ) {
      const redirectTimer = setTimeout(() => {
        router.push("/profile");
      }, 2500); // 2.5 seconds to show success message

      return () => clearTimeout(redirectTimer);
    }
  }, [
    sessionCreated,
    isPlanning,
    feedbackCompleted,
    showFeedbackPrompt,
    router,
  ]);

  const isComplete = (() => {
    const hasBasics = Boolean(
      formState.selectedBeach && formState.selectedDate
    );
    if (isPlanning) {
      return hasBasics && Boolean(formState.selectedTime);
    }
    return hasBasics;
  })();

  const handleFinishSession = () => {
    router.push("/profile");
  };

  const handleForecastFeedback = async (feedback: any) => {
    if (!createdSession) return;

    try {
      await submitForecastFeedback(createdSession, sessionForecast, feedback);
      setFeedbackCompleted(true);
      setShowFeedbackPrompt(false);
    } catch (error) {
      console.error("Error submitting forecast feedback:", error);
      // Let the user continue even if feedback fails
      setFeedbackCompleted(true);
      setShowFeedbackPrompt(false);
    }
  };

  const handleSkipFeedback = () => {
    setFeedbackCompleted(true);
    setShowFeedbackPrompt(false);
  };

  const handlePhotosChange = (files: File[]) => {
    setSelectedPhotos(files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      toast.error("Authentication required");
      return;
    }

    // Validate required fields
    if (!formState.selectedBeach) {
      toast.error("Please select a beach location");
      return;
    }

    // For plan mode, allow saving with beach name even if not selected from dropdown (no beachId)

    if (!formState.selectedDate) {
      toast.error("Please select a date");
      return;
    }

    if (isPlanning && !formState.selectedTime) {
      toast.error("Please select a start time");
      return;
    }

    // Ensure a default duration exists
    if (!formState.duration) {
      updateField("duration", "60m");
    }

    setLoading(true);

    try {
      // Analytics: planning attempt (non-blocking)
      void createActivity("session_planning_attempt", "session", "", {
        beachId: formState.selectedBeachId || null,
        beachName: formState.selectedBeach || null,
        selectedDate: formState.selectedDate || null,
        selectedTime: formState.selectedTime || null,
        mode,
      });

      let durationMinutes: number | undefined = undefined;
      if (formState.duration) {
        const hourMatch = formState.duration.match(/(\d+)h/);
        const minuteMatch = formState.duration.match(/(\d+)m/);
        const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
        const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;
        durationMinutes = hours * 60 + minutes;
      }

      // Handle converting planned session to completed
      if (convertingFromPlanned && !isPlanning) {
        const completedData = {
          ...(durationMinutes !== undefined && {
            duration_minutes: durationMinutes,
          }),
          ...(formState.waveQuality && {
            wave_quality: parseInt(formState.waveQuality),
          }),
          ...(formState.waterTemp && { water_temp: formState.waterTemp }),
          ...(formState.crowdLevel && {
            crowd_level: parseInt(formState.crowdLevel),
          }),
          ...(formState.parkingEase && {
            parking_ease: parseInt(formState.parkingEase),
          }),
          ...(formState.overallRating && {
            rating: parseInt(formState.overallRating),
          }),
          ...(formState.notes && { notes: formState.notes }),
        };

        const updatedSession = await updatePlannedSessionToCompleted(
          convertingFromPlanned,
          completedData
        );

        // Handle photo uploads for converted session
        if (selectedPhotos.length > 0) {
          try {
            const formData = new FormData();
            formData.append("fileCount", selectedPhotos.length.toString());

            selectedPhotos.forEach((file, index) => {
              formData.append(`file_${index}`, file);
            });

            const uploadResult = await uploadSessionPhotosAction(
              convertingFromPlanned,
              formData
            );

            if (uploadResult.success) {
              toast.success(
                `Session completed with ${uploadResult.data.uploaded} photo(s)!`
              );
            } else {
              toast.success("Session completed successfully!");
              toast.warning("Some photos failed to upload");
            }
          } catch (photoError) {
            console.error("Photo upload error:", photoError);
            toast.success("Session completed successfully!");
            toast.warning("Photos could not be uploaded");
          }
        } else {
          toast.success("Session completed successfully!");
        }

        setSessionCreated(true);
        return;
      }

      // Combine date and time into arrival_time
      let arrivalTime: string | undefined = undefined;

      if (formState.selectedDate && formState.selectedTime) {
        // Create a Date object from the selected date and time
        const dateTimeString = `${formState.selectedDate}T${formState.selectedTime}:00`;
        const dateTime = new Date(dateTimeString);

        // Format as PostgreSQL timestamp with timezone: 2025-05-24 18:43:00+00
        arrivalTime = dateTime
          .toISOString()
          .replace("T", " ")
          .replace(/\.\d{3}Z$/, "+00");
      } else if (formState.selectedDate) {
        // If only date is provided, use start of day
        const dateTime = new Date(`${formState.selectedDate}T00:00:00`);
        arrivalTime = dateTime
          .toISOString()
          .replace("T", " ")
          .replace(/\.\d{3}Z$/, "+00");
      }

      const sessionData = {
        beach_name: formState.selectedBeach,
        beach_id: formState.selectedBeachId,
        arrival_time: arrivalTime,
        board_id: formState.boardId,
        user_id: user.id,
        notes: formState.notes || undefined,
        status: isPlanning
          ? "planned"
          : ("completed" as "planned" | "completed"),
      };

      if (isPlanning) {
        const result = await createPlannedSession(sessionData);
        if (!result.success) {
          throw new Error(result.error);
        }

        // Success feedback immediately
        toast.success("Session planned successfully!");

        // Analytics: success (non-blocking)
        void createActivity("session_planned", "session", result.data.id, {
          inviteesCount: formState.invitees?.length || 0,
        });

        // If embedded, let parent handle completion
        if (onSuccess) {
          onSuccess();
          return;
        }

        // Fire-and-forget invitations to avoid blocking redirect
        if (formState.invitees && formState.invitees.length > 0) {
          void (async () => {
            try {
              const response = await fetch("/api/session-planner/invitations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  sessionId: result.data.id,
                  invitees: formState.invitees,
                  message: formState.invitationMessage,
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
            } catch (invitationError) {
              console.error("Error sending invitations:", invitationError);
              toast.error("Failed to send invitations");
            }
          })();
        }
      } else {
        // Create logged session data with additional fields
        const parsedWaterTemp =
          formState.waterTemp && formState.waterTemp.trim().length > 0
            ? Number.parseFloat(formState.waterTemp)
            : null;
        const loggedSessionData = {
          ...sessionData,
          ...(durationMinutes !== undefined && {
            duration_minutes: durationMinutes,
          }),
          ...(formState.waveQuality && {
            wave_quality: parseInt(formState.waveQuality),
          }),
          ...(typeof parsedWaterTemp === "number" &&
            Number.isFinite(parsedWaterTemp) && {
              water_temp: parsedWaterTemp,
            }),
          ...(formState.crowdLevel && {
            crowd_level: parseInt(formState.crowdLevel),
          }),
          ...(formState.parkingEase && {
            parking_ease: parseInt(formState.parkingEase),
          }),
          ...(formState.overallRating && {
            rating: parseInt(formState.overallRating),
          }),
          // Condition fields
          ...(formState.waveHeight !== undefined && {
            wave_height_ft: formState.waveHeight,
          }),
          ...(formState.windSpeed !== undefined && {
            wind_speed_mph: formState.windSpeed,
          }),
          ...(formState.windDirection && {
            wind_direction: formState.windDirection,
          }),
          ...(formState.tideHeight !== undefined && {
            tide_height_ft: formState.tideHeight,
          }),
          ...(formState.tideStatus && {
            tide_status: formState.tideStatus,
          }),
          // Forecast accuracy feedback
          ...(formState.forecastAccuracy && {
            forecast_accuracy: formState.forecastAccuracy,
          }),
        };

        const sessionResult = await createLoggedSession(loggedSessionData);
        if (!sessionResult.success || !sessionResult.data) {
          throw new Error(sessionResult.error || "Failed to create session");
        }
        const session = sessionResult.data;
        setCreatedSession(session);

        // If photos were selected, upload them
        if (selectedPhotos.length > 0) {
          try {
            const formData = new FormData();
            formData.append("fileCount", selectedPhotos.length.toString());

            selectedPhotos.forEach((file, index) => {
              formData.append(`file_${index}`, file);
            });

            const uploadResult = await uploadSessionPhotosAction(
              session.id,
              formData
            );

            if (uploadResult.success) {
              toast.success(
                `Session logged with ${uploadResult.data.uploaded} photo(s)!`
              );
            } else {
              toast.success("Session logged successfully!");
              toast.warning("Some photos failed to upload");
            }
          } catch (photoError) {
            console.error("Photo upload error:", photoError);
            toast.success("Session logged successfully!");
            toast.warning("Photos could not be uploaded");
          }
        } else {
          toast.success("Session logged successfully!");
        }

        setSessionCreated(true);

        // If embedded, let parent handle completion (avoid redirect)
        if (onSuccess) {
          onSuccess();
          return;
        }
      }

      // Handle completion - redirect to profile for both planned and logged sessions
      if (isPlanning) {
        router.push("/profile");
      } else {
        // For logged sessions, redirect to profile after a brief delay to show success message
        setTimeout(() => {
          router.push("/profile");
        }, 1500);
      }
    } catch (error) {
      console.error("Error saving session:", error);
      // Analytics: failure (non-blocking)
      void createActivity("session_plan_failed", "session", "n/a", {
        error: error instanceof Error ? error.message : "Unknown error",
        beachId: formState.selectedBeachId || null,
        selectedDate: formState.selectedDate || null,
        selectedTime: formState.selectedTime || null,
        mode,
      });
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save session. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <SessionFormHeader mode={mode} />

      <div className="container flex-1 px-4">
        {/* Success Message */}
        {!isPlanning && sessionCreated && (
          <div className="space-y-4 mb-4">
            <Card className={`${styles.headerBorder} ${styles.headerBg}`}>
              <CardContent className="pt-6">
                <div className={`flex items-center ${styles.headerText}`}>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  <div>
                    <p className="font-medium">{text.successMessage}</p>
                    <p className="text-sm opacity-80">
                      {"finishMessage" in text ? text.finishMessage : ""}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Forecast Feedback Prompt - Temporarily disabled */}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          data-testid="session-planning-form"
        >
          {/* Location Section */}
          <SimpleCardLayout
            title={
              <div className="flex items-center">
                <MapPin className="w-5 h-5 mr-2 text-primary" />
                {text.location}
              </div>
            }
            description={
              isPlanning
                ? "Choose where you'll be surfing"
                : "Where did your session take place?"
            }
          >
            <LocationStep
              formState={formState}
              beaches={beaches}
              mode={mode}
              updateField={updateField}
            />
          </SimpleCardLayout>

          {/* Date/Time & Duration Section */}
          <DateTimeSection
            mode={mode}
            formState={formState}
            updateField={updateField}
            sessionCreated={sessionCreated}
          />

          {/* Enhanced Planning Sections - Only for planning mode */}
          {isPlanning && (
            <>
              {/* Optimal Times Section */}
              <OptimalTimesSection
                formState={formState}
                updateField={updateField}
              />

              {/* Smart Gear Suggestions Section (selection shouldn't submit form) */}
              <GearSuggestionsSection
                formState={formState}
                updateField={updateField}
              />
            </>
          )}

          {/* Equipment Section - Only for logging mode */}
          {!isPlanning && (
            <SimpleCardLayout
              title={
                <div className="flex items-center">
                  <Surfboard className="w-5 h-5 mr-2 text-primary" />
                  {text.equipment}
                </div>
              }
              description={
                isPlanning
                  ? "Select the board you plan to use"
                  : "Which board did you ride?"
              }
            >
              <EquipmentStep
                formState={formState}
                boards={boards}
                updateField={updateField}
                onBoardsRefresh={refreshBoards}
              />
            </SimpleCardLayout>
          )}

          {/* Goals/Performance Section */}
          <GoalsSection
            mode={mode}
            formState={formState}
            updateField={updateField}
          />

          {/* Session Conditions Section - Only for logged sessions */}
          <ConditionsSection
            mode={mode}
            formState={formState}
            updateField={updateField}
          />

          {/* Photo Selection Section - Part of main form */}
          <PhotoSelectionSection
            mode={mode}
            selectedFiles={selectedPhotos}
            onFilesChange={handlePhotosChange}
            disabled={loading}
          />

          {/* Notes & Invite Section */}
          <NotesSection
            mode={mode}
            formState={formState}
            updateField={updateField}
          />

          {/* Submit Button */}
          <div className="flex justify-center mt-6 pb-24">
            {!isPlanning && sessionCreated ? (
              <div className="flex gap-4 w-full">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleFinishSession}
                  className="flex-1"
                >
                  Save
                </Button>
              </div>
            ) : (
              <Button
                type="submit"
                disabled={loading || !isComplete}
                className={`w-full ${
                  !isComplete
                    ? "bg-gray-400 hover:bg-gray-400 text-gray-600"
                    : `${styles.buttonColor} text-white`
                } ${loading ? "opacity-75" : ""}`}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {selectedPhotos.length > 0
                      ? `Saving session with ${selectedPhotos.length} photo${
                          selectedPhotos.length !== 1 ? "s" : ""
                        }...`
                      : "Saving..."}
                  </div>
                ) : !isComplete ? (
                  "Complete required fields to save"
                ) : selectedPhotos.length > 0 ? (
                  `${text.submitButton} with ${selectedPhotos.length} photo${
                    selectedPhotos.length !== 1 ? "s" : ""
                  }`
                ) : (
                  text.submitButton
                )}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
