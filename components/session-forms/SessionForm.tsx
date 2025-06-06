"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  ClipboardList,
  MapPin,
  CalendarDays,
  WavesIcon as Surfboard,
  Timer,
  Target,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import { useSessionForm, SessionFormMode } from "@/hooks/use-session-form";
import { SessionFormHeader } from "./SessionFormHeader";
import { LocationStep } from "./LocationStep";
import { DateTimeStep } from "./DateTimeStep";
import { EquipmentStep } from "./EquipmentStep";

import {
  createPlannedSession,
  createLoggedSession,
} from "@/actions/session-actions";

interface SessionFormProps {
  initialMode?: SessionFormMode;
}

export function SessionForm({ initialMode = "plan" }: SessionFormProps) {
  const searchParams = useSearchParams();
  const paramMode =
    (searchParams.get("mode") as SessionFormMode) || initialMode;
  const router = useRouter();

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
    isPlanning,
  } = useSessionForm(paramMode);

  useEffect(() => {
    setMode(paramMode);
  }, [paramMode, setMode]);

  // Enhance validation to ensure required fields are present and valid
  const isComplete = Boolean(
    formState.selectedBeach &&
      formState.selectedDate &&
      formState.selectedBeach.trim() !== "" &&
      formState.selectedDate.trim() !== ""
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Double-check validation before proceeding
    if (!isComplete) {
      toast.error("Please fill in all required fields before saving.");
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

      // Clean up values to avoid undefined strings
      const boardId =
        formState.boardId && formState.boardId !== "$undefined"
          ? formState.boardId
          : undefined;

      const notes =
        formState.notes && formState.notes !== "$undefined"
          ? formState.notes
          : undefined;

      // Find the selected beach object to get its id
      const matchedBeach = beaches.find(
        (b) => b.name === formState.selectedBeach
      );
      const beachId = matchedBeach?.id;

      // Client-side validation to ensure beach_id exists
      if (!beachId) {
        toast.error("Please select a beach before planning a session.");
        setLoading(false);
        return;
      }

      // Prepare base session data as a single object, not an array
      const sessionData = {
        beach_id: beachId,
        beach_name: formState.selectedBeach,
        session_date: formState.selectedDate,
        start_time: formState.selectedTime,
        board_id: boardId,
        notes: notes,
        status: isPlanning
          ? "planned"
          : ("completed" as "planned" | "completed"),
      };

      // Log the actual data being sent (for debugging)
      if (process.env.NODE_ENV === "development") {
        console.log("Submitting session data:", sessionData);
      }

      // Retry logic for auth issues
      const MAX_RETRIES = 2;
      let retries = 0;
      let success = false;
      let lastError: any = null;

      while (retries <= MAX_RETRIES && !success) {
        try {
          if (retries > 0) {
            // Add a small delay between retries
            await new Promise((resolve) => setTimeout(resolve, 500 * retries));
            console.log(
              `Retrying session save, attempt ${retries}/${MAX_RETRIES}`
            );
          }

          if (isPlanning) {
            // Pass the single object directly to the server action
            await createPlannedSession(sessionData);
            success = true;
            toast.success("Session planned successfully!");
          } else {
            // For logged sessions, include additional fields
            await createLoggedSession({
              ...sessionData,
              duration_minutes: durationMinutes,
              wave_quality: formState.waveQuality
                ? parseInt(formState.waveQuality)
                : undefined,
              water_temp: formState.waterTemp || undefined,
              crowd_level: formState.crowdLevel
                ? parseInt(formState.crowdLevel)
                : undefined,
              parking_ease: formState.parkingEase
                ? parseInt(formState.parkingEase)
                : undefined,
            });
            success = true;
            toast.success("Session logged successfully!");
          }
        } catch (error) {
          lastError = error;
          console.error(
            `Error saving session (attempt ${retries + 1}/${MAX_RETRIES + 1}):`,
            error
          );

          // If error indicates auth issue, we'll retry
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          if (
            errorMessage.includes("Authentication") &&
            retries < MAX_RETRIES
          ) {
            retries++;
            // Try to refresh the auth state before retrying
            try {
              const response = await fetch("/api/auth/[...supabase]", {
                method: "GET",
                credentials: "include",
              });
              if (!response.ok) {
                console.warn("Failed to refresh auth state before retry");
              }
            } catch (refreshError) {
              console.error("Error refreshing auth:", refreshError);
            }
          } else {
            // Other errors or final retry failed
            break;
          }
        }
      }

      if (!success) {
        // If all retries failed
        const errorMessage =
          lastError instanceof Error ? lastError.message : "Unknown error";
        if (errorMessage.includes("Authentication")) {
          toast.error(
            "Authentication error. Please try logging out and back in."
          );
        } else {
          toast.error("Failed to save session. Please try again.");
        }
        throw lastError;
      }

      // Handle completion
      router.push("/");
    } catch (error) {
      console.error("Error saving session:", error);
      // Toast is already handled in retry logic
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <SessionFormHeader mode={mode} />

      <div className="container flex-1 px-4">
        <form onSubmit={handleSubmit}>
          {/* Location Section */}
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="flex items-center mb-4">
                <MapPin className="w-5 h-5 mr-2 text-primary" />
                <h2 className="text-lg font-medium">Where</h2>
              </div>
              <LocationStep
                formState={formState}
                beaches={beaches}
                updateField={updateField}
              />
            </CardContent>
          </Card>

          {/* Date/Time Section */}
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="flex items-center mb-4">
                <CalendarDays className="w-5 h-5 mr-2 text-primary" />
                <h2 className="text-lg font-medium">When</h2>
              </div>
              <DateTimeStep formState={formState} updateField={updateField} />
            </CardContent>
          </Card>

          {/* Equipment Section */}
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="flex items-center mb-4">
                <Surfboard className="w-5 h-5 mr-2 text-primary" />
                <h2 className="text-lg font-medium">Board</h2>
              </div>
              <EquipmentStep
                formState={formState}
                boards={boards}
                updateField={updateField}
              />
            </CardContent>
          </Card>

          {/* Duration Section */}
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="flex items-center mb-4">
                <Timer className="w-5 h-5 mr-2 text-primary" />
                <h2 className="text-lg font-medium">Duration</h2>
              </div>
              <div className="space-y-4">
                <input
                  type="number"
                  min={15}
                  step={15}
                  className="border rounded p-2 w-24"
                  value={formState.duration ? parseInt(formState.duration) : 60}
                  onChange={(e) =>
                    updateField("duration", `${e.target.value}m`)
                  }
                />{" "}
                minutes
              </div>
            </CardContent>
          </Card>

          {/* Goal Section */}
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="flex items-center mb-4">
                <Target className="w-5 h-5 mr-2 text-primary" />
                <h2 className="text-lg font-medium">Goal</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {["Pop-ups", "Tube Riding", "Cutbacks", "Duck Dives"].map(
                  (goal) => (
                    <Button
                      key={goal}
                      type="button"
                      variant={
                        formState.notes?.includes(goal) ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => {
                        const currentNotes = formState.notes || "";
                        if (currentNotes.includes(goal)) {
                          updateField(
                            "notes",
                            currentNotes.replace(goal, "").trim()
                          );
                        } else {
                          updateField(
                            "notes",
                            currentNotes ? `${currentNotes}, ${goal}` : goal
                          );
                        }
                      }}
                    >
                      {goal}
                    </Button>
                  )
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notes & Invite Section */}
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="flex items-center mb-4">
                <ClipboardList className="w-5 h-5 mr-2 text-primary" />
                <h2 className="text-lg font-medium">Notes & Invite</h2>
              </div>
              <Textarea
                placeholder="Any notes about this session..."
                className="min-h-24 mb-4"
                value={formState.notes}
                onChange={(e) => updateField("notes", e.target.value)}
              />
              <div>
                <input
                  type="text"
                  className="border rounded p-2 w-full"
                  placeholder="Invite friends by email (comma-separated)"
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-center mt-6 mb-6">
            <Button
              type="submit"
              disabled={loading || !isComplete}
              className="w-full"
            >
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>

          {/* Debug information to help with troubleshooting */}
          {process.env.NODE_ENV === "development" && !isComplete && (
            <div className="text-xs text-red-500 mt-2">
              Please complete these required fields:
              {!formState.selectedBeach && " Beach Location,"}
              {!formState.selectedDate && " Session Date"}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
