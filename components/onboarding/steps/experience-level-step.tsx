"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useTrackEvent } from "@/hooks/use-track-event";
import { cn } from "@/lib/utils";
import {
  EXPERIENCE_LEVELS,
  type ExperienceLevel,
} from "@/lib/constants/user-preferences";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { HOME_HEADER_MOTION } from "@/lib/constants/animations";

/**
 * Onboarding step 2 — asks "What kind of surfer?" and captures
 * `experienceLevel`. Previously also asked "When do you surf?"
 * (preferred_session_time) but that question was dropped per plan E2
 * (abstract-exploring-phoenix):
 *
 * - `preferred_session_time` on `profiles` is now set exclusively by
 *   Oracle's in-app `SessionTimeSelector` — the onboarding pre-fill
 *   was redundant.
 * - `pref_time_bucket` on `user_email_prefs` wrote to a dead table
 *   (verified: zero downstream reads across cron, lib, oracle).
 *
 * Shorter step → less friction on the required activation path.
 *
 * Kept `data-testid="level-and-time-step"` on the root so existing
 * E2E selectors continue to target this step without a rename; the
 * component + file renamed to reflect the new single-question scope.
 */
export function ExperienceLevelStep() {
  const { data, updateData, nextStep, prevStep, closeDialog } =
    useOnboardingStore();
  const { track } = useTrackEvent();
  const reducedMotion = useReducedMotion();

  const [selectedLevel, setSelectedLevel] = useState<ExperienceLevel | null>(
    data.experienceLevel || null,
  );

  const handleContinue = () => {
    if (selectedLevel) {
      updateData({ experienceLevel: selectedLevel });
    }
    nextStep();
  };

  // "Maybe later" — dismiss the dialog entirely (not just skip to the next step).
  // Users who want to advance without selecting a level can click Continue
  // with no selection — that already falls through to nextStep. Dismissal must
  // not set onboarding_completed_at; only saveOnboardingData completes activation.
  const handleMaybeLater = () => {
    track("onboarding_step", {
      metadata: {
        step: "dismissed",
        step_name: "dismissed",
        source_step: "experience_level",
      },
      debounceMs: 0,
    });
    closeDialog();
  };

  return (
    <div className="space-y-6" data-testid="level-and-time-step">
      <div className="space-y-3 max-w-md mx-auto">
        <div className="text-center">
          <h2 className="font-handwritten text-3xl sm:text-4xl text-white">
            What kind of surfer?
          </h2>
          <p className="text-white/60 text-sm mt-1">
            We&apos;ll match conditions to your level
          </p>
        </div>

        <div className="space-y-2">
          {EXPERIENCE_LEVELS.map((level) => {
            const isSelected = selectedLevel === level.value;

            return (
              <motion.button
                key={level.value}
                type="button"
                onClick={() => setSelectedLevel(level.value)}
                whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                animate={
                  reducedMotion ? undefined : { scale: isSelected ? 1.02 : 1 }
                }
                transition={
                  reducedMotion
                    ? undefined
                    : { type: "spring", stiffness: 300, damping: 20 }
                }
                className={cn(
                  "w-full px-4 py-3 border rounded-lg text-left transition-colors flex items-center gap-3",
                  isSelected
                    ? "border-[#F78E42] bg-[#F78E42]/10"
                    : "bg-white/[0.06] border-white/[0.12] hover:bg-white/10",
                )}
              >
                {/* Circle radio indicator */}
                <div
                  className={cn(
                    "w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors",
                    isSelected
                      ? "border-[#F78E42] bg-[#F78E42]"
                      : "border-white/30",
                  )}
                >
                  {isSelected && (
                    <motion.div
                      initial={reducedMotion ? { scale: 1 } : { scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: "spring",
                        ...HOME_HEADER_MOTION.spring,
                      }}
                      className="w-2 h-2 rounded-full bg-white"
                    />
                  )}
                </div>

                <div className="text-2xl flex-shrink-0">{level.emoji}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-white text-sm">
                    {level.label}
                  </div>
                  <div className="text-xs text-white/50">
                    {level.description}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={prevStep}
          className="flex-1 py-3 rounded-lg bg-white/[0.06] border border-white/[0.12] text-white font-semibold text-sm hover:bg-white/10 transition-colors focus-ring"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleMaybeLater}
          className="flex-1 py-3 text-white/40 hover:text-white/60 text-sm transition-colors focus-ring"
        >
          Maybe later
        </button>
        <button
          type="button"
          onClick={handleContinue}
          className="flex-1 py-3 rounded-lg bg-gradient-to-r from-[#F78E42] to-[#D57835] text-white font-semibold text-sm transition-opacity focus-ring"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
