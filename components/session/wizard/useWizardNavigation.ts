"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { SessionFormMode, SessionFormState } from "@/hooks/use-session-form";
import { WizardStep } from "./wizard-steps";

interface UseWizardNavigationOptions {
  steps: WizardStep[];
  formState: SessionFormState;
  mode: SessionFormMode;
  targetStep?: number;
}

interface UseWizardNavigationReturn {
  currentStep: number;
  currentWizardStep: WizardStep;
  progress: number;
  canGoNext: boolean;
  canGoPrev: boolean;
  isLastStep: boolean;
  isFormComplete: boolean;
  isStepValid: (step: number) => boolean;
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  autoSaveStatus: "idle" | "saving" | "saved";
}

/**
 * Custom hook for managing wizard navigation logic.
 * Handles step validation, navigation, auto-jump to target step, and auto-save status.
 */
export function useWizardNavigation({
  steps,
  formState,
  mode,
  targetStep,
}: UseWizardNavigationOptions): UseWizardNavigationReturn {
  const [currentStep, setCurrentStep] = useState(0);
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved"
  >("idle");

  // Track whether we've performed the auto-jump to target step
  const hasJumpedRef = useRef(false);

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
        if (process.env.NODE_ENV === "development") {
          console.warn(
            "Cannot jump to step",
            targetStepIndex + 1,
            "- missing beach selection"
          );
        }
        return false;
      }

      // Step 2 (index 1) - DateTime: Requires date and time (for plan mode)
      if (targetStepIndex > 1) {
        if (!formState.selectedDate) {
          if (process.env.NODE_ENV === "development") {
            console.warn(
              "Cannot jump to step",
              targetStepIndex + 1,
              "- missing date selection"
            );
          }
          return false;
        }
        // Time is only required for plan mode
        if (mode === "plan" && !formState.selectedTime) {
          if (process.env.NODE_ENV === "development") {
            console.warn(
              "Cannot jump to step",
              targetStepIndex + 1,
              "- missing time selection (plan mode)"
            );
          }
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
        if (process.env.NODE_ENV === "development") {
          console.warn(
            `Invalid targetStep: ${targetStep}. Must be between 1 and ${steps.length}`
          );
        }
        return;
      }

      // Validate that required fields for earlier steps are satisfied
      const canJump = validateStepsUpTo(targetStepIndex);

      if (canJump) {
        if (process.env.NODE_ENV === "development") {
          console.log(
            `Auto-jumping to step ${targetStep} (index ${targetStepIndex})`
          );
        }
        setCurrentStep(targetStepIndex);
        hasJumpedRef.current = true;
      } else {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            `Cannot auto-jump to step ${targetStep} - validation failed. Starting at step 1.`
          );
        }
        hasJumpedRef.current = true; // Mark as attempted to prevent retry
      }
    }
  }, [targetStep, steps.length, validateStepsUpTo]);

  /**
   * Validates whether a specific step is complete and valid.
   */
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
        case "conditions":
          // Forecast accuracy is required for completed sessions (log mode)
          if (mode === "log") {
            return Boolean(formState.forecastAccuracy);
          }
          return true;
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

  /**
   * Navigate to a specific step by index.
   */
  const goToStep = useCallback(
    (step: number) => {
      if (step >= 0 && step < steps.length) {
        setCurrentStep(step);
      }
    },
    [steps.length]
  );

  /**
   * Navigate to the next step if valid.
   */
  const nextStep = useCallback(() => {
    if (canGoNext) {
      setCurrentStep((prev) => prev + 1);
      // Trigger auto-save on step progression
      setAutoSaveStatus("saving");
      setTimeout(() => setAutoSaveStatus("saved"), 500);
      setTimeout(() => setAutoSaveStatus("idle"), 2000);
    }
  }, [canGoNext]);

  /**
   * Navigate to the previous step.
   */
  const prevStep = useCallback(() => {
    if (canGoPrev) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [canGoPrev]);

  return {
    currentStep,
    currentWizardStep,
    progress,
    canGoNext,
    canGoPrev,
    isLastStep,
    isFormComplete,
    isStepValid,
    goToStep,
    nextStep,
    prevStep,
    autoSaveStatus,
  };
}
