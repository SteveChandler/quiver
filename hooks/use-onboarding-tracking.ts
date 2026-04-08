"use client";

/**
 * useOnboardingTracking Hook
 *
 * Connects the onboarding store to event tracking.
 * Tracks when users complete each onboarding step.
 *
 * @see docs/plans/user-engagement-tracking.md
 */

import { useEffect, useRef } from "react";
import { useOnboardingStore, ONBOARDING_COMPLETION_SIGNAL } from "@/store/onboarding-store";
import { useTrackEvent } from "@/hooks/use-track-event";

/**
 * Hook that sets up onboarding step tracking.
 * Should be called in the OnboardingDialog component.
 */
export function useOnboardingTracking() {
  const { setOnStepChange } = useOnboardingStore();
  const { track } = useTrackEvent();
  // Tracks the last step the user entered and when, so we can compute time_on_step_ms
  // without changing the store's callback signature. Initialized lazily inside the effect
  // to avoid consuming Date.now() on every render.
  const stepEntryRef = useRef<{ step: number; enteredAt: number } | null>(null);

  useEffect(() => {
    if (stepEntryRef.current === null) {
      stepEntryRef.current = { step: 0, enteredAt: Date.now() };
    }

    // Set up the callback to track step changes
    setOnStepChange((fromStep, toStep, stepName) => {
      const isCompletion = toStep === ONBOARDING_COMPLETION_SIGNAL;
      const now = Date.now();
      const entry = stepEntryRef.current;
      const timeOnStepMs = entry && entry.step === fromStep
        ? now - entry.enteredAt
        : undefined;

      track("onboarding_step", {
        metadata: {
          step: stepName, // Named identifier (e.g. 'home_beach', 'level_and_time', 'payoff')
          step_name: stepName,
          completed: true,
          direction: isCompletion ? "forward" : toStep > fromStep ? "forward" : "back",
          ...(timeOnStepMs !== undefined && { time_on_step_ms: timeOnStepMs }),
        },
        debounceMs: 100, // Short debounce for step tracking
      });

      // Also track final completion as a separate event
      if (isCompletion) {
        track("onboarding_step", {
          metadata: {
            step: "completed",
            step_name: "completed",
            completed: true,
            direction: "forward",
            ...(timeOnStepMs !== undefined && { time_on_step_ms: timeOnStepMs }),
          },
          debounceMs: 0, // Must be 0 — fires right after payoff step event with same debounce key
        });
      }

      // Mark entry into the destination step (skip on completion — there's no next step)
      if (!isCompletion) {
        stepEntryRef.current = { step: toStep, enteredAt: now };
      }
    });

    // Cleanup: remove callback on unmount
    return () => {
      setOnStepChange(null);
    };
  }, [setOnStepChange, track]);
}
