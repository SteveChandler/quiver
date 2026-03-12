"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useOnboardingStore } from "@/store/onboarding-store";
import { HomeBeachStep } from "./steps/home-beach-step";
import { LevelAndTimeStep } from "./steps/level-and-time-step";
import { PayoffStep } from "./steps/payoff-step";
import { OnboardingProgress } from "./onboarding-progress";
import { useAuth } from "@/context/auth-context";
import { useProfileContext } from "@/context/profile-context";
import { skipOnboarding } from "@/actions/onboarding-actions";
import { useOnboardingTracking } from "@/hooks/use-onboarding-tracking";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { Profile } from "@/types/database";

const STEPS = [
  HomeBeachStep,
  LevelAndTimeStep,
  PayoffStep,
];

// Delays for dialog opening (ms)
const DIALOG_OPEN_DELAY = 500; // Let page settle before showing onboarding
const TESTING_OPEN_DELAY = 100; // Shorter delay for test mode

// Gradient backgrounds per step
const STEP_GRADIENTS = [
  "linear-gradient(to bottom, #0B1D3A, #1A3A5C)", // Step 0: dark navy
  "linear-gradient(to bottom, #1A2744, #8B3A2A)", // Step 1: warm dusk
  "linear-gradient(to bottom, #0B2E4A, #0077B6)", // Step 2: open ocean
];

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
    isCompleted,
    currentStep,
    setCurrentStep,
    openDialog,
    closeDialog,
    reset,
    checkUserId,
  } = useOnboardingStore();

  const reducedMotion = useReducedMotion();

  // Set up step tracking for engagement analytics
  useOnboardingTracking();

  const isTesting = searchParams?.get("showOnboarding") === "1";
  const hasCompletedOnboarding = !!profile?.onboarding_completed_at;
  const substantiallyComplete = isProfileSubstantiallyComplete(profile);

  // Ensure we only render if user is logged in (unless testing)
  // This prevents showing the dialog on the landing page after logout
  const shouldRender =
    isOpen &&
    !isCompleted &&
    (isTesting || (user && !hasCompletedOnboarding && !substantiallyComplete));

  // Track direction for slide animations by comparing to previous step
  const prevStepRef = useRef(currentStep);
  const [direction, setDirection] = useState<1 | -1>(1);

  useEffect(() => {
    if (currentStep !== prevStepRef.current) {
      setDirection(currentStep > prevStepRef.current ? 1 : -1);
      prevStepRef.current = currentStep;
    }
  }, [currentStep]);

  // Focus trap: set inert on <main> when overlay is open
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;

    if (shouldRender) {
      main.setAttribute("inert", "");
    } else {
      main.removeAttribute("inert");
    }

    return () => {
      main.removeAttribute("inert");
    };
  }, [shouldRender]);

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

    // If the user just completed onboarding in this session, avoid re-opening
    // while the profile context refreshes `onboarding_completed_at`.
    if (isCompleted) return;

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
  }, [user, profile, profileLoading, profileError, isCompleted, openDialog]);

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

  if (!CurrentStepComponent || !shouldRender) {
    return null;
  }

  function handleSkip() {
    if (user?.id && !isTesting) {
      skipOnboarding(); // Fire and forget - persists to database
    }
    closeDialog();
  }

  const slideVariants = {
    enter: (dir: number) => ({
      x: reducedMotion ? 0 : dir * 250,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: reducedMotion ? 0 : dir * -250,
      opacity: 0,
    }),
  };

  const safeStep = Math.min(Math.max(currentStep, 0), STEP_GRADIENTS.length - 1);
  const isPayoffStep = currentStep === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Set up your surf profile"
      className="fixed inset-0 z-50 overflow-y-auto"
    >
      <h2 className="sr-only">Set up your surf profile</h2>

      {/* Gradient background layers — crossfade between steps */}
      <div className="absolute inset-0">
        {STEP_GRADIENTS.map((gradient, index) => (
          <motion.div
            key={index}
            className="absolute inset-0"
            animate={{ opacity: index === safeStep ? 1 : 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.5 }}
            style={{ background: gradient }}
          />
        ))}
      </div>

      {/* Grain texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.04]"
        style={{
          backgroundImage: "url('/textures/noise.png')",
          backgroundRepeat: "repeat",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Top bar: skip button + dots */}
        <div className="relative flex items-center justify-center px-4 pt-6 pb-2">
          <OnboardingProgress
            currentStep={currentStep}
            totalSteps={STEPS.length}
          />

          {/* X skip button — hidden on payoff step */}
          {!isPayoffStep && (
            <button
              onClick={handleSkip}
              aria-label="Skip onboarding"
              className="absolute right-4 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition-colors hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Step content with slide transitions */}
        <div className="flex flex-1 flex-col items-center px-4">
          <div className="w-full max-w-lg">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentStep}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <CurrentStepComponent />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
