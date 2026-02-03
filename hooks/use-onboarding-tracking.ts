"use client";

/**
 * useOnboardingTracking Hook
 *
 * Connects the onboarding store to event tracking.
 * Tracks when users complete each onboarding step.
 *
 * @see docs/plans/user-engagement-tracking.md
 */

import { useEffect } from "react";
import { useOnboardingStore, ONBOARDING_COMPLETION_SIGNAL } from "@/store/onboarding-store";
import { useTrackEvent } from "@/hooks/use-track-event";

/**
 * Hook that sets up onboarding step tracking.
 * Should be called in the OnboardingDialog component.
 */
export function useOnboardingTracking() {
  const { setOnStepChange } = useOnboardingStore();
  const { track } = useTrackEvent();

  useEffect(() => {
    // Set up the callback to track step changes
    setOnStepChange((fromStep, toStep, stepName) => {
      const isCompletion = toStep === ONBOARDING_COMPLETION_SIGNAL;

      track("onboarding_step", {
        metadata: {
          step: fromStep + 1, // 1-indexed for human readability
          step_name: stepName,
          completed: true,
        },
        debounceMs: 100, // Short debounce for step tracking
      });

      // Also track final completion as a separate event
      if (isCompletion) {
        track("onboarding_step", {
          metadata: {
            step: 6, // Final step
            step_name: "completed",
            completed: true,
          },
          debounceMs: 100,
        });
      }
    });

    // Cleanup: remove callback on unmount
    return () => {
      setOnStepChange(null);
    };
  }, [setOnStepChange, track]);
}
