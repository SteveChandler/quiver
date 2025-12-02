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
import { Stepper } from "./stepper";
import { WelcomeStep } from "./steps/welcome-step";
import { ProfileStep } from "./steps/profile-step";
import { HomeBeachStep } from "./steps/home-beach-step";
import { PreferencesStep } from "./steps/preferences-step";
import { NotificationsStep } from "./steps/notifications-step";
import { CompletionStep } from "./steps/completion-step";
import { useAuth } from "@/context/auth-context";
import { useProfileContext } from "@/context/profile-context";

const STEPS = [
  WelcomeStep,
  ProfileStep,
  HomeBeachStep,
  PreferencesStep,
  NotificationsStep,
  CompletionStep,
];

export function OnboardingDialog() {
  const { user } = useAuth();
  const {
    profile,
    isLoading: profileLoading,
    error: profileError,
  } = useProfileContext();
  const searchParams = useSearchParams();
  const { isOpen, currentStep, openDialog, reset, checkUserId } =
    useOnboardingStore();

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

    const dismissedKey = `onboarding_dismissed_${user.id}`;
    const isDismissed = localStorage.getItem(dismissedKey);
    if (isDismissed) return;

    // Show onboarding if:
    // 1. No profile exists yet (brand new user)
    // 2. Profile exists but onboarding not completed
    const needsOnboarding = !profile || !profile.onboarding_completed_at;

    if (needsOnboarding) {
      // Small delay to let page settle
      setTimeout(() => openDialog(), 500);
    }
  }, [user, profile, profileLoading, profileError, openDialog]);

  // Allow forcing the dialog with query param for testing
  useEffect(() => {
    if (searchParams?.get("showOnboarding") === "1") {
      // Reset store to clear state for testing
      reset();
      // Small delay to ensure state update propagates
      setTimeout(() => openDialog(), 100);
    }
  }, [openDialog, reset, searchParams]);

  const CurrentStepComponent = STEPS[currentStep];

  if (!CurrentStepComponent) {
    return null;
  }

  // Determine if we should render based on profile completion status
  const isTesting = searchParams?.get("showOnboarding") === "1";
  const hasCompletedOnboarding = !!profile?.onboarding_completed_at;
  const shouldRender = isOpen && (!hasCompletedOnboarding || isTesting);

  return (
    <Dialog open={shouldRender}>
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
          <Stepper currentStep={currentStep} totalSteps={STEPS.length} />
          <CurrentStepComponent />
        </div>
      </DialogContent>
    </Dialog>
  );
}
