"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useOnboardingStore, ONBOARDING_STEP_NAMES } from "@/store/onboarding-store";
import { HomeBeachStep } from "./steps/home-beach-step";
import { LevelAndTimeStep } from "./steps/level-and-time-step";
import { PayoffStep } from "./steps/payoff-step";
import { OnboardingProgress } from "./onboarding-progress";
import { HeroImageSlot } from "./hero-image-slot";
import { FloatingParticles } from "./floating-particles";
import { useAuth } from "@/context/auth-context";
import { useProfileContext } from "@/context/profile-context";
import { useOnboardingTracking } from "@/hooks/use-onboarding-tracking";
import { useTrackEvent } from "@/hooks/use-track-event";
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

/** Check if profile has enough data to skip onboarding (e.g., filled via Edit Profile) */
function isProfileSubstantiallyComplete(
  profile: Profile | null
): profile is Profile {
  return Boolean(profile && profile.home_beach_id);
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

  // Dialog lifecycle instrumentation (Fix 6). Reuses the 'onboarding_step' event
  // type because the user_events CHECK constraint doesn't include dedicated
  // dialog-lifecycle event types. Distinguished via metadata.step.
  // See project_onboarding_payoff_step_bug.md for why observability matters here.
  const { track } = useTrackEvent();

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

  // Telemetry: fire 'dialog_opened' exactly once when isOpen flips to true.
  // This lets analytics count how many users actually saw the dialog (distinct
  // from how many users the open-effect ATTEMPTED to open — the latter can fail
  // silently due to render races and was the reason we couldn't detect Bug B).
  const dialogOpenedFiredRef = useRef(false);
  useEffect(() => {
    if (isOpen && !dialogOpenedFiredRef.current) {
      dialogOpenedFiredRef.current = true;
      track("onboarding_step", {
        metadata: {
          step: "dialog_opened",
          step_name: "dialog_opened",
        },
        debounceMs: 0,
      });
    }
    if (!isOpen) {
      dialogOpenedFiredRef.current = false;
    }
  }, [isOpen, track]);

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

    // Show onboarding if:
    // 1. No profile exists yet (brand new user)
    // 2. Profile exists but onboarding not completed AND profile is not already complete
    //
    // Users who previously tapped "Maybe later" have `onboarding_completed_at` set
    // via skipOnboarding() — they won't re-enter this flow automatically. They can
    // re-open the dialog explicitly from /profile via the "Set up your home break" CTA.
    // (No more localStorage-based snooze ladder — the previous escalating snooze was
    // invisible to users and effectively the same permanent lockout as the X button.)
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
  //
  // IMPORTANT: do NOT fire this effect while the user is on PayoffStep. When
  // PayoffStep calls saveOnboardingData → updateProfile, hasCompletedOnboarding
  // flips to true and shouldRender flips to false — but we need the dialog to
  // stay visible so the user can see the celebration UI and actively dismiss via
  // handleFinish. The completeOnboarding() store action handles closing the
  // dialog explicitly; this effect must not race it. See
  // `project_onboarding_payoff_step_bug.md` for the full diagnosis.
  useEffect(() => {
    if (isOpen && !shouldRender && currentStep !== STEPS.length - 1) {
      // Fire telemetry before closing so we can distinguish stale-close from
      // intentional dismiss (which fires 'maybe_later_clicked' from the step).
      track("onboarding_step", {
        metadata: {
          step: "auto_closed",
          step_name: "auto_closed",
          current_step: currentStep,
          current_step_name: ONBOARDING_STEP_NAMES[currentStep] ?? `step_${currentStep}`,
        },
        debounceMs: 0,
      });
      closeDialog();
    }
  }, [isOpen, shouldRender, closeDialog, currentStep, track]);

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Set up your surf profile"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-4 sm:py-8 formgrid-onboarding"
    >
      <h2 className="sr-only">Set up your surf profile</h2>

      {/* Dark overlay background */}
      <div className="absolute inset-0 bg-black/65" />

      {/* Card: cream border frame */}
      <div className="relative z-10 w-full max-w-2xl mx-4">
        <div className="bg-[#F5F0E8] rounded-2xl p-2 sm:p-3 md:p-4">
          {/* Inner dark card */}
          <div className="relative rounded-xl overflow-hidden">
            {/* Floating spray particles across the whole card */}
            <FloatingParticles />
            {/* Hero image — persistent across steps */}
            <HeroImageSlot className="h-[20vh] sm:h-[25vh] lg:h-[30vh]" />

            {/* Progress dots — overlaid at the bottom of the hero */}
            <div className="relative -mt-8 z-10 pb-2">
              <OnboardingProgress
                currentStep={currentStep}
                totalSteps={STEPS.length}
              />
            </div>

            {/* Form body — dark blue-teal gradient */}
            <div
              className="relative px-4 pb-4 pt-2 sm:px-6 sm:pb-6 md:px-8 md:pb-8"
              style={{
                background: "linear-gradient(to bottom, #2C4A5E, #1A3A5C)",
              }}
            >
              {/* Noise texture overlay */}
              <div
                className="pointer-events-none absolute inset-0 z-0 opacity-[0.03]"
                style={{
                  backgroundImage: "url('/textures/noise.png')",
                  backgroundRepeat: "repeat",
                }}
              />

              {/* Step content with slide transitions
                  NOTE: the old absolute-positioned X button was removed because it
                  was a reflex-tap magnet in the top-right corner — ~33% of new users
                  were reflex-tapping it within ~6 seconds of the dialog appearing
                  and getting permanently locked out. Dismissal now lives inside each
                  step as an explicit "Maybe later" button with clear intent.
                  See project_onboarding_payoff_step_bug.md. */}
              <div className="relative z-10">
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
      </div>
    </div>
  );
}
