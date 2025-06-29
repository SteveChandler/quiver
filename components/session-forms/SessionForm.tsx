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
import { SimpleCardLayout } from "@/components/ui/form-layout";
import {
  getFormText,
  getModeStyles,
} from "@/lib/constants/session-form-constants";

import {
  createPlannedSession,
  createLoggedSession,
} from "@/actions/session-actions";
import { uploadSessionPhotosAction } from "@/actions/session-media-actions";

interface SessionFormProps {
  initialMode?: SessionFormMode;
}

export function SessionForm({ initialMode = "plan" }: SessionFormProps) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const paramMode =
    (searchParams.get("mode") as SessionFormMode) || initialMode;
  const router = useRouter();

  const [sessionCreated, setSessionCreated] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);

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

  useEffect(() => {
    setMode(paramMode);
  }, [paramMode, setMode]);

  // Auto-redirect after session is successfully logged
  useEffect(() => {
    if (!isPlanning && sessionCreated) {
      const redirectTimer = setTimeout(() => {
        router.push("/profile");
      }, 2500); // 2.5 seconds to show success message

      return () => clearTimeout(redirectTimer);
    }
  }, [sessionCreated, isPlanning, router]);

  const isComplete = Boolean(
    formState.selectedBeach &&
      formState.selectedBeachId &&
      formState.selectedDate
  );

  const handleFinishSession = () => {
    router.push("/profile");
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

    setLoading(true);

    try {
      let durationMinutes: number | undefined = undefined;
      if (formState.duration) {
        const hourMatch = formState.duration.match(/(\d+)h/);
        const minuteMatch = formState.duration.match(/(\d+)m/);
        const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
        const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;
        durationMinutes = hours * 60 + minutes;
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
        const result = await createPlannedSession(sessionData, user.id);
        if (result.success) {
          toast.success("Session planned successfully!");
        } else {
          throw new Error(result.error);
        }
      } else {
        // Create logged session data with additional fields
        const loggedSessionData = {
          ...sessionData,
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
        };

        const session = await createLoggedSession(loggedSessionData, user.id);

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
      }

      // Handle completion - only redirect for planned sessions
      if (isPlanning) {
        router.push("/profile");
      }
    } catch (error) {
      console.error("Error saving session:", error);
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
          <Card className={`mb-4 ${styles.headerBorder} ${styles.headerBg}`}>
            <CardContent className="pt-6">
              <div className={`flex items-center ${styles.headerText}`}>
                <CheckCircle2 className="w-5 h-5 mr-2" />
                <div>
                  <p className="font-medium">{text.successMessage}</p>
                  <p className="text-sm opacity-80">{text.finishMessage}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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

          {/* Equipment Section */}
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
