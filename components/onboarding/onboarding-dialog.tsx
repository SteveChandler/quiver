"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useOnboardingStore } from "@/store/onboarding-store";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { WelcomeStep } from "./steps/welcome-step";
import { ProfileStep } from "./steps/profile-step";
import { ExperienceStep } from "./steps/experience-step";
import { WavePreferencesStep } from "./steps/wave-preferences-step";
import { HomeBeachStep } from "./steps/home-beach-step";
import { CompletionStep } from "./steps/completion-step";
import { OnboardingProgress } from "./onboarding-progress";
import { useAuth } from "@/context/auth-context";
import { useProfileContext } from "@/context/profile-context";
import type { Profile } from "@/types/database";

const STEPS = [
  WelcomeStep,
  HomeBeachStep,
  ProfileStep,
  ExperienceStep,
  WavePreferencesStep,
  CompletionStep,
];

// Delays for dialog opening (ms)
const DIALOG_OPEN_DELAY = 500; // Let page settle before showing onboarding
const TESTING_OPEN_DELAY = 100; // Shorter delay for test mode
const DISMISS_TTL_MS = 6 * 60 * 60 * 1000; // Re-prompt after 6 hours

/** Check if profile has enough data to skip onboarding (e.g., filled via Edit Profile) */
function isProfileSubstantiallyComplete(
  profile: Profile | null
): profile is Profile {
  return Boolean(profile && profile.home_beach_id);
}

/** Safe localStorage access - returns null on error (private browsing, quota exceeded) */
function safeGetLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Safe localStorage set - no-op on error (private browsing, quota exceeded) */
function safeSetLocalStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // no-op
  }
}

export function OnboardingDialog() {
  const { user } = useAuth();
  const {
    profile,
    isLoading: profileLoading,
    error: profileError,
  } = useProfileContext();
  const searchParams = useSearchParams();
  const {
    isOpen,
    currentStep,
    setCurrentStep,
    openDialog,
    closeDialog,
    reset,
    checkUserId,
  } = useOnboardingStore();

  const isTesting = searchParams?.get("showOnboarding") === "1";
  const hasCompletedOnboarding = !!profile?.onboarding_completed_at;
  const substantiallyComplete = isProfileSubstantiallyComplete(profile);

  // Ensure we only render if user is logged in (unless testing)
  // This prevents showing the dialog on the landing page after logout
  const shouldRender =
    isOpen &&
    (isTesting || (user && !hasCompletedOnboarding && !substantiallyComplete));

  // Guard against stale persisted step indexes from older onboarding versions.
  // If currentStep is out of bounds, clamp to step 0 so we still render reliably.
  useEffect(() => {
    if (currentStep < 0 || currentStep >= STEPS.length) {
      setCurrentStep(0);
    }
  }, [currentStep, setCurrentStep]);

  // Scope onboarding store to current user - prevents stale data from previous users
  useEffect(() => {
    if (user?.id) {
      checkUserId(user.id);
    }
  }, [user?.id, checkUserId]);

  // Auto-open for new users who haven't completed onboarding
  // Uses profile from context instead of API call
  useEffect(() => {
    // Wait for profile fetch to complete
    if (!user || profileLoading) return;

    // Don't show onboarding if profile failed to load - user may have already completed it
    // This prevents existing users from seeing onboarding when API errors occur
    if (profileError) return;

    const dismissedUntilKey = `onboarding_dismissed_until_${user.id}`;
    const dismissedUntilRaw = safeGetLocalStorage(dismissedUntilKey);
    if (dismissedUntilRaw) {
      const dismissedUntil = Number(dismissedUntilRaw);
      if (Number.isFinite(dismissedUntil) && Date.now() < dismissedUntil) {
        return;
      }
      // Expired or invalid; clear it so onboarding can show again.
      safeSetLocalStorage(dismissedUntilKey, "");
    }

    // Show onboarding if:
    // 1. No profile exists yet (brand new user)
    // 2. Profile exists but onboarding not completed AND profile is not already complete
    const needsOnboarding =
      !profile ||
      (!profile.onboarding_completed_at &&
        !isProfileSubstantiallyComplete(profile));

    if (needsOnboarding) {
      const timeoutId = setTimeout(() => openDialog(), DIALOG_OPEN_DELAY);
      // Cleanup: cancel timeout if effect re-runs (e.g., profile loads with onboarding_completed_at)
      return () => clearTimeout(timeoutId);
    }
  }, [user, profile, profileLoading, profileError, openDialog]);

  // Allow forcing the dialog with query param for testing
  useEffect(() => {
    if (searchParams?.get("showOnboarding") === "1") {
      // Reset store to clear state for testing
      reset();
      const timeoutId = setTimeout(() => openDialog(), TESTING_OPEN_DELAY);
      return () => clearTimeout(timeoutId);
    }
  }, [openDialog, reset, searchParams]);

  // Keep store/UI consistent: if the store says "open" but render conditions
  // no longer allow onboarding (e.g., profile loads as complete), close it.
  useEffect(() => {
    if (isOpen && !shouldRender) {
      closeDialog();
    }
  }, [isOpen, shouldRender, closeDialog]);

  // Ensure store is reset on logout
  useEffect(() => {
    if (!user) {
      reset();
    }
  }, [user, reset]);

  const CurrentStepComponent = STEPS[currentStep];

  if (!CurrentStepComponent) {
    return null;
  }

  return (
    <Dialog
      open={!!shouldRender}
      onOpenChange={(open) => {
        // In a controlled Radix Dialog, internal close controls (X / DialogClose)
        // only work if we sync the new open state back to our store.
        if (!open) {
          if (user?.id && !isTesting) {
            safeSetLocalStorage(
              `onboarding_dismissed_until_${user.id}`,
              String(Date.now() + DISMISS_TTL_MS)
            );
          }
          closeDialog();
        }
      }}
    >
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Onboarding Wizard</DialogTitle>
        <DialogDescription className="sr-only">
          Complete the onboarding steps to set up your profile.
        </DialogDescription>
        <div className="p-6">
          <OnboardingProgress
            currentStep={currentStep}
            totalSteps={STEPS.length}
            className="mb-6"
          />
          <CurrentStepComponent />
        </div>
      </DialogContent>
    </Dialog>
  );
}
