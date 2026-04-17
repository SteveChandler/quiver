"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
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

// Delay for the ?showOnboarding=1 test-mode open (ms)
const TESTING_OPEN_DELAY = 100;

/** Check if profile has enough data to skip onboarding (e.g., filled via Edit Profile) */
function isProfileSubstantiallyComplete(
  profile: Profile | null
): profile is Profile {
  return Boolean(profile && profile.home_beach_id);
}

export function OnboardingDialog() {
  const { user } = useAuth();
  const { profile } = useProfileContext();
  const router = useRouter();
  const pathname = usePathname();
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

  // Onboarding is no longer auto-opened. Surfaces that need to prompt the user
  // to set a home beach open the dialog explicitly via useOnboardingStore():
  // - OracleHomeScreen's ContextualCTA (fresh signups without a home beach)
  // - /profile's SetHomeBreakCta (reopen flow via reopenOnboarding server action)
  // - The ?showOnboarding=1 URL param (testing, below)
  //
  // Prior auto-open behaviour ambushed brand-new signups with a blocking dialog
  // over a still-loading home screen, which they bailed on. See plan
  // vast-dancing-whale for the diagnosis.

  // Allow forcing the dialog with query param for testing
  useEffect(() => {
    if (searchParams?.get("showOnboarding") === "1") {
      // Reset store to clear state for testing
      reset();
      const timeoutId = setTimeout(() => openDialog(), TESTING_OPEN_DELAY);
      return () => clearTimeout(timeoutId);
    }
  }, [openDialog, reset, searchParams]);

  // `?onboarding=required` entry path — new signups redirected here from
  // /auth/callback after a successful signup when their profile has no
  // home_beach_id and no onboarding_completed_at. Opens the dialog once,
  // then strips the query param so a refresh doesn't re-trigger.
  //
  // This is deliberately NOT the removed 500ms auto-open `useEffect` from
  // plan vast-dancing-whale. Returning users never hit this path because
  // /auth/callback only sets the param on fresh signups. Existing users
  // without a home beach still open the dialog via the Oracle CTA or the
  // /profile SetHomeBreakCta — that invariant is preserved.
  //
  // Plan: abstract-exploring-phoenix (Commit B).
  const hasProcessedRequiredParam = useRef(false);
  useEffect(() => {
    if (hasProcessedRequiredParam.current) return;
    if (searchParams?.get("onboarding") !== "required") return;
    // Wait until the profile has loaded before deciding to open the dialog —
    // opening on a phantom "no home beach" when profile is still null would
    // flash the dialog for authed users who already have a home beach.
    if (!user || !profile) return;
    hasProcessedRequiredParam.current = true;

    if (!profile.home_beach_id && !profile.onboarding_completed_at) {
      reset();
      openDialog();
    }

    // Strip the query param whether or not we opened the dialog, so
    // refreshes don't re-enter this path and the URL stays clean.
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    next.delete("onboarding");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, user, profile, openDialog, reset, router, pathname]);

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
