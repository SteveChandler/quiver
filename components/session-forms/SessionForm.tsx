"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Notes } from "lucide-react";

import { useSessionForm, SessionFormMode } from "@/hooks/use-session-form";
import { SessionFormHeader } from "./SessionFormHeader";
import { ProgressIndicator } from "./ProgressIndicator";
import { LocationStep } from "./LocationStep";
import { DateTimeStep } from "./DateTimeStep";
import { EquipmentStep } from "./EquipmentStep";
import { FormNavigation } from "./FormNavigation";

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
    step,
    nextStep,
    prevStep,
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

  const isComplete = Boolean(formState.selectedBeach && formState.selectedDate);

  const handleSubmit = async () => {
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

      const sessionData = {
        beach_name: formState.selectedBeach,
        session_date: formState.selectedDate,
        start_time: formState.selectedTime,
        board_id: formState.boardId,
        notes: formState.notes || undefined,
        status: isPlanning
          ? "planned"
          : ("completed" as "planned" | "completed"),
      };

      if (isPlanning) {
        await createPlannedSession(sessionData);
        toast.success("Session planned successfully!");
      } else {
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
        toast.success("Session logged successfully!");
      }

      // Handle completion
      router.push("/dashboard");
    } catch (error) {
      console.error("Error saving session:", error);
      toast.error("Failed to save session. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Dynamic content based on current step
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <LocationStep
            formState={formState}
            beaches={beaches}
            updateField={updateField}
          />
        );
      case 2:
        return <DateTimeStep formState={formState} updateField={updateField} />;
      case 3:
        return (
          <EquipmentStep
            formState={formState}
            boards={boards}
            updateField={updateField}
          />
        );
      case 4:
        return (
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="flex items-center mb-4">
                <Notes className="w-5 h-5 mr-2 text-primary" />
                <h2 className="text-lg font-medium">Additional Notes</h2>
              </div>
              <Textarea
                placeholder="Any notes about this session..."
                className="min-h-24"
                value={formState.notes}
                onChange={(e) => updateField("notes", e.target.value)}
              />
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  const totalSteps = isPlanning ? 4 : 10;

  return (
    <div className="flex-1 flex flex-col">
      <SessionFormHeader mode={mode} />
      <ProgressIndicator currentStep={step} mode={mode} />

      <div className="container flex-1 px-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (step === totalSteps) {
              handleSubmit();
            } else {
              nextStep();
            }
          }}
        >
          {renderStepContent()}

          <FormNavigation
            step={step}
            totalSteps={totalSteps}
            loading={loading}
            onBack={prevStep}
            onNext={nextStep}
            onSubmit={handleSubmit}
            isComplete={isComplete}
          />
        </form>
      </div>
    </div>
  );
}
