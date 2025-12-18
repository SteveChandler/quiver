"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Calendar,
  Target,
  Camera,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

import {
  useSessionForm,
  SessionFormMode,
  SessionFormState,
} from "@/hooks/use-session-form";
import { useAuth } from "@/context/auth-context";
import { WIZARD_MOTION, PHASE2_ANIMATIONS } from "@/lib/constants/animations";
import { LocationStep } from "@/components/session-forms/LocationStep";
import { DateTimeSection } from "@/components/session-forms/DateTimeSection";
import { EquipmentStep } from "@/components/session-forms/EquipmentStep";
import { GoalsSection } from "@/components/session-forms/GoalsSection";
import { ConditionsSection } from "@/components/session-forms/ConditionsSection";
import { PhotoSelectionSection } from "@/components/session-forms/PhotoSelectionSection";
import { NotesSection } from "@/components/session-forms/NotesSection";
import { SessionDetailsSection } from "@/components/session-forms/SessionDetailsSection";
import {
  createPlannedSession,
  createLoggedSession,
} from "@/actions/session-actions";

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  component: string;
  isRequired: boolean;
}

interface AnimatedSessionWizardProps {
  initialMode: SessionFormMode;
  className?: string;
  onComplete?: (sessionData: any) => void | Promise<void>;
  onCancel?: () => void;
  /**
   * Optional initial form state for prefilling the wizard.
   * Example: { selectedBeachId: 'abc-123', selectedBeach: 'Pacific Beach', selectedDate: '2025-11-22' }
   */
  initialFormState?: Partial<SessionFormState>;
  /**
   * Optional target step to jump to after initial render (1-indexed: 1-4).
   * The wizard will validate that required fields for earlier steps are satisfied before jumping.
   * Example: targetStep={3} will jump to the Goals step if beach and date/time are prefilled.
   */
  targetStep?: number;
}

// Feature flag for consolidated wizard (safe rollout)
// Set to true to enable the new 4-step consolidated flow for log mode
const USE_CONSOLIDATED_WIZARD = true;

// Legacy step configurations (6 steps for log mode)
const WIZARD_STEPS_V1: Record<SessionFormMode, WizardStep[]> = {
  plan: [
    {
      id: "location",
      title: "Location",
      description: "Choose where you'll be surfing",
      icon: <MapPin className="w-5 h-5" />,
      component: "LocationStep",
      isRequired: true,
    },
    {
      id: "datetime",
      title: "When",
      description: "Set your session date and time",
      icon: <Calendar className="w-5 h-5" />,
      component: "DateTimeSection",
      isRequired: true,
    },
    {
      id: "goals",
      title: "Goals",
      description: "What do you want to focus on?",
      icon: <Target className="w-5 h-5" />,
      component: "GoalsSection",
      isRequired: false,
    },
    {
      id: "notes",
      title: "Notes & Invites",
      description: "Add notes and invite friends",
      icon: <FileText className="w-5 h-5" />,
      component: "NotesSection",
      isRequired: false,
    },
  ],
  log: [
    {
      id: "location",
      title: "Location",
      description: "Where did your session take place?",
      icon: <MapPin className="w-5 h-5" />,
      component: "LocationStep",
      isRequired: true,
    },
    {
      id: "datetime",
      title: "When",
      description: "When did you surf?",
      icon: <Calendar className="w-5 h-5" />,
      component: "DateTimeSection",
      isRequired: true,
    },
    {
      id: "equipment",
      title: "Equipment",
      description: "Which board did you ride?",
      icon: <Target className="w-5 h-5" />,
      component: "EquipmentStep",
      isRequired: false,
    },
    {
      id: "conditions",
      title: "Conditions",
      description: "How were the waves and conditions?",
      icon: <Target className="w-5 h-5" />,
      component: "ConditionsSection",
      isRequired: false,
    },
    {
      id: "photos",
      title: "Photos",
      description: "Add photos from your session",
      icon: <Camera className="w-5 h-5" />,
      component: "PhotoSelectionSection",
      isRequired: false,
    },
    {
      id: "notes",
      title: "Notes",
      description: "Reflect on your session",
      icon: <FileText className="w-5 h-5" />,
      component: "NotesSection",
      isRequired: false,
    },
  ],
};

// New consolidated step configurations (4 steps for log mode)
const WIZARD_STEPS_V2: Record<SessionFormMode, WizardStep[]> = {
  plan: [
    // Plan mode unchanged (same as V1)
    {
      id: "location",
      title: "Location",
      description: "Choose where you'll be surfing",
      icon: <MapPin className="w-5 h-5" />,
      component: "LocationStep",
      isRequired: true,
    },
    {
      id: "datetime",
      title: "When",
      description: "Set your session date and time",
      icon: <Calendar className="w-5 h-5" />,
      component: "DateTimeSection",
      isRequired: true,
    },
    {
      id: "goals",
      title: "Goals",
      description: "What do you want to focus on?",
      icon: <Target className="w-5 h-5" />,
      component: "GoalsSection",
      isRequired: false,
    },
    {
      id: "notes",
      title: "Notes & Invites",
      description: "Add notes and invite friends",
      icon: <FileText className="w-5 h-5" />,
      component: "NotesSection",
      isRequired: false,
    },
  ],
  log: [
    // CONSOLIDATED: 4 steps (was 6)
    {
      id: "location",
      title: "Location",
      description: "Where did your session take place?",
      icon: <MapPin className="w-5 h-5" />,
      component: "LocationStep",
      isRequired: true,
    },
    {
      id: "datetime",
      title: "When",
      description: "When did you surf?",
      icon: <Calendar className="w-5 h-5" />,
      component: "DateTimeSection",
      isRequired: true,
    },
    {
      id: "equipment",
      title: "Equipment",
      description: "Which board did you ride?",
      icon: <Target className="w-5 h-5" />,
      component: "EquipmentStep",
      isRequired: false,
    },
    {
      id: "session-details",
      title: "Session Details",
      description: "Rate conditions, add photos, and share your experience",
      icon: <FileText className="w-5 h-5" />,
      component: "SessionDetailsSection", // NEW CONSOLIDATED COMPONENT
      isRequired: false,
    },
  ],
};

export function AnimatedSessionWizard({
  initialMode,
  className,
  onComplete,
  onCancel,
  initialFormState,
  targetStep,
}: AnimatedSessionWizardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved"
  >("idle");

  // Track whether we've performed the auto-jump to target step
  const hasJumpedRef = useRef(false);

  const {
    mode,
    loading,
    setLoading,
    boards,
    beaches,
    formState,
    updateField,
    refreshBoards,
    isPlanning,
  } = useSessionForm({
    initialMode,
    initialFormState,
  });

  const sendInvitations = useCallback(
    async (
      sessionId: string,
      invitees: SessionFormState["invitees"],
      message?: string
    ) => {
      if (!Array.isArray(invitees) || invitees.length === 0) {
        return;
      }

      try {
        const response = await fetch("/api/session-planner/invitations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, invitees, message }),
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
    },
    []
  );

  // Select wizard steps based on feature flag
  const WIZARD_STEPS = USE_CONSOLIDATED_WIZARD
    ? WIZARD_STEPS_V2
    : WIZARD_STEPS_V1;
  const steps = WIZARD_STEPS[mode];
  const currentWizardStep = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  /**
   * Validates that required fields for all steps up to (but not including) the target step are satisfied.
   * This ensures we can safely jump to a target step without skipping required data.
   */
  const validateStepsUpTo = useCallback(
    (targetStepIndex: number): boolean => {
      // Step 1 (index 0) - Location: Requires beach
      if (targetStepIndex > 0 && !formState.selectedBeachId) {
        console.warn(
          "Cannot jump to step",
          targetStepIndex + 1,
          "- missing beach selection"
        );
        return false;
      }

      // Step 2 (index 1) - DateTime: Requires date and time (for plan mode)
      if (targetStepIndex > 1) {
        if (!formState.selectedDate) {
          console.warn(
            "Cannot jump to step",
            targetStepIndex + 1,
            "- missing date selection"
          );
          return false;
        }
        // Time is only required for plan mode
        if (mode === "plan" && !formState.selectedTime) {
          console.warn(
            "Cannot jump to step",
            targetStepIndex + 1,
            "- missing time selection (plan mode)"
          );
          return false;
        }
      }

      // Step 3+ (index 2+) - Goals/Equipment/etc: No additional validation needed
      // These steps are optional and don't block progression
      return true;
    },
    [
      formState.selectedBeachId,
      formState.selectedDate,
      formState.selectedTime,
      mode,
    ]
  );

  /**
   * Auto-jump to target step if provided and valid.
   * This effect runs once after initial render and validates that required fields are present.
   */
  useEffect(() => {
    if (targetStep && !hasJumpedRef.current) {
      // Validate target step is in valid range (1-indexed to 0-indexed conversion)
      const targetStepIndex = targetStep - 1;
      if (targetStepIndex < 0 || targetStepIndex >= steps.length) {
        console.warn(
          `Invalid targetStep: ${targetStep}. Must be between 1 and ${steps.length}`
        );
        return;
      }

      // Validate that required fields for earlier steps are satisfied
      const canJump = validateStepsUpTo(targetStepIndex);

      if (canJump) {
        console.log(
          `Auto-jumping to step ${targetStep} (index ${targetStepIndex})`
        );
        setCurrentStep(targetStepIndex);
        hasJumpedRef.current = true;
      } else {
        console.warn(
          `Cannot auto-jump to step ${targetStep} - validation failed. Starting at step 1.`
        );
        hasJumpedRef.current = true; // Mark as attempted to prevent retry
      }
    }
  }, [targetStep, steps.length, validateStepsUpTo]);

  // Step validation
  const isStepValid = useCallback(
    (step: number): boolean => {
      const wizardStep = steps[step];
      if (!wizardStep) return false;

      switch (wizardStep.id) {
        case "location":
          return Boolean(formState.selectedBeach);
        case "datetime":
          if (mode === "plan") {
            return Boolean(formState.selectedDate && formState.selectedTime);
          }
          return Boolean(formState.selectedDate);
        default:
          return true; // Non-required steps are always valid
      }
    },
    [steps, formState, mode]
  );

  const canGoNext = currentStep < steps.length - 1 && isStepValid(currentStep);
  const canGoPrev = currentStep > 0;
  const isLastStep = currentStep === steps.length - 1;
  const isFormComplete = steps
    .filter((step) => step.isRequired)
    .every((_, index) => isStepValid(index));

  // Navigation functions
  const goToStep = useCallback(
    (step: number) => {
      if (step >= 0 && step < steps.length) {
        setCurrentStep(step);
      }
    },
    [steps.length]
  );

  const nextStep = useCallback(() => {
    if (canGoNext) {
      setCurrentStep((prev) => prev + 1);
      // Trigger auto-save on step progression
      setAutoSaveStatus("saving");
      setTimeout(() => setAutoSaveStatus("saved"), 500);
      setTimeout(() => setAutoSaveStatus("idle"), 2000);
    }
  }, [canGoNext]);

  const prevStep = useCallback(() => {
    if (canGoPrev) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [canGoPrev]);

  // Photo handling
  const handlePhotosChange = (files: File[]) => {
    setSelectedPhotos(files);
  };

  // Final submission
  const handleSubmit = async () => {
    if (!user?.id || !isFormComplete) {
      toast.error("Please complete all required fields");
      return;
    }

    setIsSubmitting(true);
    setLoading(true);

    try {
      // Prepare session data for callback
      const sessionData = {
        selectedBeach: formState.selectedBeach,
        selectedBeachId: formState.selectedBeachId,
        selectedDate: formState.selectedDate,
        selectedTime: formState.selectedTime,
        boardId: formState.boardId,
        notes: formState.notes,
        photos: selectedPhotos,
        invitees: Array.isArray(formState.invitees) ? formState.invitees : [],
        invitationMessage: formState.invitationMessage,
        // Log mode specific fields
        duration: formState.duration,
        waveQuality: formState.waveQuality,
        waterTemp: formState.waterTemp,
        crowdLevel: formState.crowdLevel,
        parkingEase: formState.parkingEase,
        overallRating: formState.overallRating,
        // Actual conditions + calibration fields (collected in SessionDetailsSection)
        waveHeight: formState.waveHeight,
        windSpeed: formState.windSpeed,
        windDirection: formState.windDirection,
        forecastAccuracy: formState.forecastAccuracy,
        waveTypes: formState.waveTypes,
      };

      if (onComplete) {
        // Use external completion handler (for /sessions/new)
        await onComplete(sessionData);
      } else {
        // Use internal completion logic (for direct page usage)
        await handleInternalSubmit(sessionData);
      }

      // Show completion celebration
      setAutoSaveStatus("saved");
    } catch (error) {
      console.error("Error creating session:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create session. Please try again."
      );
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  // Internal submission logic (fallback when no onComplete is provided)
  const handleInternalSubmit = async (sessionData: any) => {
    if (!user?.id) {
      throw new Error("User not authenticated");
    }

    // Combine date and time into arrival_time
    let arrivalTime: string | undefined = undefined;
    if (sessionData.selectedDate && sessionData.selectedTime) {
      const dateTimeString = `${sessionData.selectedDate}T${sessionData.selectedTime}:00`;
      const dateTime = new Date(dateTimeString);
      arrivalTime = dateTime
        .toISOString()
        .replace("T", " ")
        .replace(/\.\d{3}Z$/, "+00");
    } else if (sessionData.selectedDate) {
      const dateTime = new Date(`${sessionData.selectedDate}T00:00:00`);
      arrivalTime = dateTime
        .toISOString()
        .replace("T", " ")
        .replace(/\.\d{3}Z$/, "+00");
    }

    const baseSessionData = {
      beach_name: sessionData.selectedBeach,
      beach_id: sessionData.selectedBeachId,
      arrival_time: arrivalTime,
      board_id: sessionData.boardId,
      user_id: user.id,
      notes: sessionData.notes || undefined,
      status: isPlanning ? ("planned" as const) : ("completed" as const),
    };

    if (isPlanning) {
      const result = await createPlannedSession(baseSessionData);
      if (!result.success) {
        throw new Error(result.error);
      }
      if (result.data?.id) {
        await sendInvitations(
          result.data.id,
          sessionData.invitees,
          sessionData.invitationMessage
        );
      }
      toast.success("Session planned successfully!");
    } else {
      // Add logging-specific fields
      const parsedWaterTemp =
        sessionData.waterTemp && String(sessionData.waterTemp).trim().length > 0
          ? Number.parseFloat(String(sessionData.waterTemp))
          : null;
      const loggedSessionData = {
        ...baseSessionData,
        ...(sessionData.duration && {
          duration_minutes: parseDuration(sessionData.duration),
        }),
        ...(sessionData.waveQuality && {
          wave_quality: parseInt(sessionData.waveQuality),
        }),
        ...(typeof parsedWaterTemp === "number" &&
          Number.isFinite(parsedWaterTemp) && { water_temp: parsedWaterTemp }),
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

      const result = await createLoggedSession(loggedSessionData);
      if (!result.success) {
        throw new Error(result.error);
      }
      toast.success("Session logged successfully!");
    }

    // Redirect after brief delay
    setTimeout(() => {
      router.push("/profile");
    }, 1500);
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

  // Render step content
  const renderStepContent = () => {
    const step = currentWizardStep;
    if (!step) return null;

    const baseProps = {
      formState,
      updateField,
      mode,
    };

    switch (step.component) {
      case "LocationStep":
        return <LocationStep {...baseProps} beaches={beaches} />;
      case "DateTimeSection":
        return <DateTimeSection {...baseProps} />;
      case "EquipmentStep":
        return (
          <EquipmentStep
            {...baseProps}
            boards={boards}
            onBoardsRefresh={refreshBoards}
          />
        );
      case "GoalsSection":
        return <GoalsSection {...baseProps} />;
      case "ConditionsSection":
        return <ConditionsSection {...baseProps} />;
      case "PhotoSelectionSection":
        return (
          <PhotoSelectionSection
            mode={mode}
            selectedFiles={selectedPhotos}
            onFilesChange={handlePhotosChange}
            disabled={loading}
          />
        );
      case "NotesSection":
        return <NotesSection {...baseProps} />;
      case "SessionDetailsSection":
        return (
          <SessionDetailsSection
            mode={mode}
            formState={formState}
            updateField={updateField}
            selectedPhotos={selectedPhotos}
            onPhotosChange={handlePhotosChange}
          />
        );
      default:
        return <div>Step content not found</div>;
    }
  };

  // Render UI immediately for better UX; server actions still enforce auth

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-gray-50 to-gray-100/50 ${className}`}
    >
      {/* Header with Progress */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4">
          {/* Progress Bar */}
          <div className="mb-4">
            <motion.div
              className="flex items-center justify-between text-sm text-gray-600 mb-2"
              {...WIZARD_MOTION.hint}
            >
              <span>
                Step {currentStep + 1} of {steps.length}
              </span>
              <span>{Math.round(progress)}% complete</span>
            </motion.div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-blue-600 rounded-full"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: progress / 100 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                style={{ transformOrigin: "left" }}
              />
            </div>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center space-x-4">
            <motion.div
              className="flex items-center space-x-2"
              {...WIZARD_MOTION.hint}
            >
              <div className="p-2 bg-blue-100 rounded-lg">
                {currentWizardStep.icon}
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {currentWizardStep.title}
                </h1>
                <p className="text-sm text-gray-600">
                  {currentWizardStep.description}
                </p>
              </div>
            </motion.div>

            {currentWizardStep.isRequired && (
              <Badge variant="secondary" className="text-xs">
                Required
              </Badge>
            )}
          </div>

          {/* Auto-save Status */}
          <AnimatePresence>
            {autoSaveStatus !== "idle" && (
              <motion.div
                className="mt-2 text-xs text-gray-500 flex items-center space-x-1"
                {...WIZARD_MOTION.autosave}
                animate={autoSaveStatus}
              >
                <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse" />
                <span>
                  {autoSaveStatus === "saving" ? "Saving..." : "Saved"}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <form
          data-testid="session-wizard-form"
          onSubmit={(e) => e.preventDefault()}
        >
          <Card className="shadow-lg">
            <CardContent className="p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  {...WIZARD_MOTION.step}
                  className="min-h-[400px]"
                >
                  {renderStepContent()}
                </motion.div>
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={!canGoPrev}
              className="flex items-center space-x-2"
              type="button"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </Button>

            <div className="flex items-center space-x-2">
              {steps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToStep(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentStep
                      ? "bg-blue-600"
                      : index < currentStep
                      ? "bg-blue-300"
                      : "bg-gray-300"
                  }`}
                  disabled={index > currentStep && !isStepValid(currentStep)}
                  type="button"
                />
              ))}
            </div>

            {isLastStep ? (
              <motion.div
                {...WIZARD_MOTION.celebration}
                animate={isFormComplete ? "animate" : "initial"}
              >
                <Button
                  onClick={handleSubmit}
                  disabled={!isFormComplete || isSubmitting}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700"
                  type="button"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{isPlanning ? "Planning..." : "Logging..."}</span>
                    </>
                  ) : (
                    <span>{isPlanning ? "Plan Session" : "Log Session"}</span>
                  )}
                </Button>
              </motion.div>
            ) : (
              <Button
                onClick={nextStep}
                disabled={!canGoNext}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700"
                type="button"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
