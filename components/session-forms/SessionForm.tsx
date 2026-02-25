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

import { getPlannedSessionForConversion } from "@/actions/session-actions";

import { useForecastCalibration } from "@/hooks/use-forecast-calibration";
import { handleSessionSubmit } from "./session-submit-handler";

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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sessionData = (result as any).data || result as any;

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

    await handleSessionSubmit({
      userId: user.id,
      formState,
      mode,
      isPlanning,
      selectedPhotos,
      convertingFromPlanned,
      updateField,
      setLoading,
      setSessionCreated,
      setCreatedSession,
      onSuccess,
      routerPush: router.push,
    });
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
