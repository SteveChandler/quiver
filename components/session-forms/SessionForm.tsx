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
import { useAuth } from "@/context/auth-context";
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
  const { user } = useAuth();
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
    refreshBoards,
    isPlanning,
  } = useSessionForm(paramMode);

  useEffect(() => {
    setMode(paramMode);
  }, [paramMode, setMode]);

  const isComplete = Boolean(
    formState.selectedBeach &&
      formState.selectedBeachId &&
      formState.selectedDate
  );

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
        profile_id: user.id,
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
        };

        const result = await createLoggedSession(loggedSessionData, user.id);

        if (result.success) {
          toast.success("Session logged successfully!");
        } else {
          throw new Error(result.error);
        }
      }

      // Handle completion
      router.push("/sessions");
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
                onBoardsRefresh={refreshBoards}
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
        </form>
      </div>
    </div>
  );
}
