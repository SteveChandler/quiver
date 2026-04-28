"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useOnboardingStore, ONBOARDING_STEP_NAMES } from "@/store/onboarding-store";
import { HomeBeachStep } from "./steps/home-beach-step";
import { ExperienceLevelStep } from "./steps/experience-level-step";
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
  ExperienceLevelStep,
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
  const { profile, isLoading: profileLoading } = useProfileContext();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const {
    isOpen,
    isCompleted,
    currentStep,
    setCurrentStep,
    openDialog,
    closeDialog,
    reset,
    reopenFresh,
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

  // Both `?showOnboarding=1` (testing) and `?onboarding=required`
  // (new-signup post-auth redirect from /auth/callback) act as
  // "force-open" signals that bypass the substantiallyComplete /
  // onboarding_completed_at gates below. This is deliberate — the
  // query param carries the server-side authorization to show the
  // dialog, and double-gating on client-side profile state caused a
  // race where fresh signups whose profile row hadn't materialized yet
  // saw nothing.
  //
  // `forceOpenLatched` persists the force-open state across the
  // param-strip that the effect below runs (router.replace removes
  // the param so refresh doesn't re-trigger). Without the latch, the
  // sequence was: effect calls openDialog → param strips → next
  // render isForceOpenParam=false → shouldRender drops to false
  // (when the user's profile has a home_beach_id) → auto-close effect
  // fires and undoes openDialog before the dialog ever painted.
  const isForceOpenParamCurrent =
    searchParams?.get("showOnboarding") === "1" ||
    searchParams?.get("onboarding") === "required";
  const [forceOpenLatched, setForceOpenLatched] = useState(false);
  useEffect(() => {
    if (isForceOpenParamCurrent) setForceOpenLatched(true);
  }, [isForceOpenParamCurrent]);
  const isForceOpen = isForceOpenParamCurrent || forceOpenLatched;

  // Release the latch once the profile confirms completion — stale welcome-email
  // links for already-onboarded users must not keep the dialog force-open after
  // the param is stripped. Analytics (2026-04-24) showed a user re-opening the
  // dialog 4 s after completion because this latch never released.
  useEffect(() => {
    if (!profileLoading && profile?.onboarding_completed_at && forceOpenLatched) {
      setForceOpenLatched(false);
    }
  }, [profileLoading, profile?.onboarding_completed_at, forceOpenLatched]);

  const hasCompletedOnboarding = !!profile?.onboarding_completed_at;
  const substantiallyComplete = isProfileSubstantiallyComplete(profile);

  // Ensure we only render if user is logged in (unless force-opened via
  // a URL param). This prevents showing the dialog on the landing page
  // after logout.
  const shouldRender =
    isOpen &&
    !isCompleted &&
    (isForceOpen || (user && !hasCompletedOnboarding && !substantiallyComplete));

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

  // Focus management: capture the element that triggered the dialog so we
  // can restore focus when it closes; move focus into the dialog on open.
  const triggerRef = useRef<Element | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (shouldRender) {
      // Capture the currently-focused element so we can restore on close.
      triggerRef.current = document.activeElement;

      // Move focus into the first focusable element inside the dialog.
      // setTimeout defers until after the framer-motion enter animation
      // has started, ensuring the dialog is in the DOM.
      const id = setTimeout(() => {
        if (!dialogRef.current) return;
        const focusable = dialogRef.current.querySelector<HTMLElement>(
          'input, button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        focusable?.focus();
      }, 50);
      return () => clearTimeout(id);
    } else {
      // Restore focus to the trigger element when the dialog closes.
      if (triggerRef.current && triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
        triggerRef.current = null;
      }
    }
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
  // We intentionally do NOT re-check `profile.home_beach_id` client-side
  // before opening. The server-side gate at /auth/callback is the source
  // of truth for "is this user unactivated" — that check has already
  // happened by the time the redirect lands us here. A client-side
  // re-check introduces a race: if the profile row hasn't been created
  // yet (common for fresh signups — the handle_new_user trigger may lag
  // the session exchange by a tick), `useProfileContext` returns null
  // and the effect bails forever.
  //
  // The `shouldRender` gate below still acts as a belt-and-suspenders
  // check — if the profile eventually loads and shows the user is
  // activated, the auto-close effect closes the dialog.
  //
  // Plan: abstract-exploring-phoenix (Commit B, with live fix from a
  // test run that found the profile-race bailout).
  const hasProcessedRequiredParam = useRef(false);
  useEffect(() => {
    if (hasProcessedRequiredParam.current) return;
    if (searchParams?.get("onboarding") !== "required") return;
    if (!user) return;
    // Wait for the profile fetch to settle before locking in the decision.
    // Without this guard, a mount-time race with user loaded but profile still
    // null takes the `reopenFresh` branch, then the one-shot ref prevents the
    // defense from firing when profile eventually resolves with
    // onboarding_completed_at set — the re-open loop observed in analytics.
    if (profileLoading) return;

    // Bypass router.replace entirely — Next 16's router silently re-writes
    // history with the original `?onboarding=required` URL when called during
    // the initial RSC streaming window (confirmed via stack-traced replaceState
    // calls on dev: both originated from Next router internals, never from our
    // stripParam — see CHANGELOG entry for 2026-04-27 strip fix iteration 2).
    // We read pathname/search from Next router state (usePathname /
    // useSearchParams) to keep the implementation lint-clean — direct
    // `window.location` reads are banned by `no-restricted-properties`. The
    // write still goes through the native History API (`history.replaceState`),
    // not Next's router, to preserve the deterministic-write invariant.
    const stripParam = () => {
      if (typeof history === "undefined") return;
      const next = new URLSearchParams(searchParams?.toString() ?? "");
      next.delete("onboarding");
      const qs = next.toString();
      const newUrl = qs ? `${pathname}?${qs}` : pathname;
      history.replaceState(null, "", newUrl);
    };

    // Defense-in-depth against stale welcome-email links, bookmarks, and
    // browser autocomplete: if the profile has loaded and already shows
    // onboarding_completed_at, do NOT force-reopen the dialog. Still strip
    // the param so refreshes settle on a clean URL. The profile-race case
    // (profile still null for a fresh signup) falls through to reopenFresh.
    if (profile?.onboarding_completed_at) {
      hasProcessedRequiredParam.current = true;
      stripParam();
      return;
    }

    hasProcessedRequiredParam.current = true;

    // Use `reopenFresh` instead of `reset() + openDialog()`. `reset()`
    // nulls `userId` in the store, which makes the next strict-mode
    // pass of the `checkUserId` effect see state.userId !== user.id
    // → the effect force-resets the store (including isOpen=false),
    // silently undoing our openDialog before the first paint. See the
    // store action's JSDoc and plan abstract-exploring-phoenix E1.
    reopenFresh(user.id);

    stripParam();
  }, [searchParams, pathname, user, profile, profileLoading, reopenFresh]);

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
      ref={dialogRef}
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
