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
  Star,
  Car,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import { useSessionForm, SessionFormMode } from "@/hooks/use-session-form";
import { useAuth } from "@/context/auth-context";
import { SessionFormHeader } from "./SessionFormHeader";
import { LocationStep } from "./LocationStep";
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

        const result = await createLoggedSession(loggedSessionData, user.id);

        if (result.success) {
          toast.success("Session logged successfully!");
        } else {
          throw new Error(result.error);
        }
      }

      // Handle completion
      router.push("/profile");
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

          {/* Date/Time & Duration Section */}
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="flex items-center mb-4">
                <CalendarDays className="w-5 h-5 mr-2 text-primary" />
                <h2 className="text-lg font-medium">When & Duration</h2>
              </div>
              <div className="space-y-4">
                {/* Date and Time in same row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Date
                    </label>
                    <input
                      type="date"
                      className="w-full border rounded p-2"
                      value={formState.selectedDate}
                      onChange={(e) =>
                        updateField("selectedDate", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Time
                    </label>
                    <div className="flex items-center">
                      <Timer className="w-4 h-4 mr-2 text-muted-foreground" />
                      <input
                        type="time"
                        className="flex-1 border rounded p-2"
                        value={formState.selectedTime}
                        onChange={(e) =>
                          updateField("selectedTime", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Duration underneath */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Duration
                  </label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      min={15}
                      step={15}
                      className="border rounded p-2 w-24"
                      value={
                        formState.duration ? parseInt(formState.duration) : 60
                      }
                      onChange={(e) =>
                        updateField("duration", `${e.target.value}m`)
                      }
                    />
                    <span className="ml-2 text-sm text-muted-foreground">
                      minutes
                    </span>
                  </div>
                </div>
              </div>
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

              {/* Overall Rating - Only show for logged sessions */}
              {!isPlanning && (
                <div className="mt-6 pt-4 border-t">
                  <div className="text-center">
                    <label className="block text-sm font-medium mb-2">
                      Overall Goal Performance
                    </label>
                    <div className="flex justify-center gap-1 mb-1">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() =>
                            updateField("overallRating", rating.toString())
                          }
                          className={`p-1 rounded transition-colors ${
                            parseInt(formState.overallRating) >= rating
                              ? "text-blue-400"
                              : "text-gray-300 hover:text-gray-400"
                          }`}
                        >
                          <Star
                            className="w-6 h-6"
                            fill={
                              parseInt(formState.overallRating) >= rating
                                ? "currentColor"
                                : "none"
                            }
                          />
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formState.overallRating
                        ? `${formState.overallRating}/5`
                        : "How did you perform?"}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Session Conditions Section - Only show for logged sessions */}
          {!isPlanning && (
            <Card className="mb-4">
              <CardContent className="pt-6">
                <div className="flex items-center mb-4">
                  <Activity className="w-5 h-5 mr-2 text-primary" />
                  <h2 className="text-lg font-medium">Session Conditions</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Wave Quality */}
                  <div className="text-center">
                    <label className="block text-sm font-medium mb-2">
                      Wave Quality
                    </label>
                    <div className="flex justify-center gap-1 mb-1">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() =>
                            updateField("waveQuality", rating.toString())
                          }
                          className={`p-1 rounded transition-colors ${
                            parseInt(formState.waveQuality) >= rating
                              ? "text-yellow-400"
                              : "text-gray-300 hover:text-gray-400"
                          }`}
                        >
                          <Star
                            className="w-5 h-5"
                            fill={
                              parseInt(formState.waveQuality) >= rating
                                ? "currentColor"
                                : "none"
                            }
                          />
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formState.waveQuality
                        ? `${formState.waveQuality}/5`
                        : "Rate the waves"}
                    </span>
                  </div>

                  {/* Crowd Density */}
                  <div className="text-center">
                    <label className="block text-sm font-medium mb-2">
                      Crowd Density
                    </label>
                    <div className="flex justify-center gap-1 mb-1">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() =>
                            updateField("crowdLevel", rating.toString())
                          }
                          className={`p-1 rounded transition-colors ${
                            parseInt(formState.crowdLevel) >= rating
                              ? "text-orange-400"
                              : "text-gray-300 hover:text-gray-400"
                          }`}
                        >
                          <Users
                            className="w-5 h-5"
                            fill={
                              parseInt(formState.crowdLevel) >= rating
                                ? "currentColor"
                                : "none"
                            }
                          />
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formState.crowdLevel
                        ? `${formState.crowdLevel}/5`
                        : "How crowded?"}
                    </span>
                  </div>

                  {/* Parking */}
                  <div className="text-center">
                    <label className="block text-sm font-medium mb-2">
                      Parking Ease
                    </label>
                    <div className="flex justify-center gap-1 mb-1">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() =>
                            updateField("parkingEase", rating.toString())
                          }
                          className={`p-1 rounded transition-colors ${
                            parseInt(formState.parkingEase) >= rating
                              ? "text-green-400"
                              : "text-gray-300 hover:text-gray-400"
                          }`}
                        >
                          <Car
                            className="w-5 h-5"
                            fill={
                              parseInt(formState.parkingEase) >= rating
                                ? "currentColor"
                                : "none"
                            }
                          />
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formState.parkingEase
                        ? `${formState.parkingEase}/5`
                        : "How easy?"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
          <div className="flex justify-center mt-6 pb-24">
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
