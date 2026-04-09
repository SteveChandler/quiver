"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useAuth } from "@/context/auth-context";
import { skipOnboarding } from "@/actions/onboarding-actions";
import { useTrackEvent } from "@/hooks/use-track-event";
import { cn } from "@/lib/utils";
import {
  EXPERIENCE_LEVELS,
  TIME_PREFERENCES,
  type ExperienceLevel,
  type TimePreference,
} from "@/lib/constants/user-preferences";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { HOME_HEADER_MOTION } from "@/lib/constants/animations";

export function LevelAndTimeStep() {
  const { data, updateData, nextStep, prevStep, closeDialog } = useOnboardingStore();
  const { user } = useAuth();
  const { track } = useTrackEvent();
  const reducedMotion = useReducedMotion();

  const [selectedLevel, setSelectedLevel] = useState<ExperienceLevel | null>(
    data.experienceLevel || null
  );
  const [selectedTime, setSelectedTime] = useState<TimePreference | null>(
    data.preferredTime || null
  );

  const handleContinue = () => {
    if (selectedLevel || selectedTime) {
      updateData({
        experienceLevel: selectedLevel || undefined,
        preferredTime: selectedTime || undefined,
      });
    }
    nextStep();
  };

  // "Maybe later" — dismiss the dialog entirely (not just skip to the next step).
  // Users who want to advance without selecting level/time can click Continue
  // with no selection — that already falls through to nextStep.
  const handleMaybeLater = () => {
    track("onboarding_step", {
      metadata: {
        step: "maybe_later_clicked",
        step_name: "maybe_later_clicked",
        source_step: "level_and_time",
      },
      debounceMs: 0,
    });
    if (user?.id) {
      skipOnboarding(); // fire and forget — sets onboarding_completed_at
    }
    closeDialog();
  };

  return (
    <div className="space-y-6" data-testid="level-and-time-step">
      {/* Two-column layout on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
        {/* Column A - Experience Level */}
        <div className="space-y-3">
          <div>
            <h2 className="font-handwritten text-3xl sm:text-4xl text-white">What kind of surfer?</h2>
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
                    reducedMotion
                      ? undefined
                      : { scale: isSelected ? 1.02 : 1 }
                  }
                  transition={
                    reducedMotion
                      ? undefined
                      : { type: "spring", stiffness: 300, damping: 20 }
                  }
                  className={cn(
                    "w-full px-3 py-2.5 border rounded-lg text-left transition-colors flex items-center gap-3",
                    isSelected
                      ? "border-[#F78E42] bg-[#F78E42]/10"
                      : "bg-white/[0.06] border-white/[0.12] hover:bg-white/10"
                  )}
                >
                  {/* Circle radio indicator */}
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors",
                      isSelected
                        ? "border-[#F78E42] bg-[#F78E42]"
                        : "border-white/30"
                    )}
                  >
                    {isSelected && (
                      <motion.div
                        initial={reducedMotion ? { scale: 1 } : { scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", ...HOME_HEADER_MOTION.spring }}
                        className="w-2 h-2 rounded-full bg-white"
                      />
                    )}
                  </div>

                  <div className="text-xl flex-shrink-0">{level.emoji}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white text-sm">{level.label}</div>
                    <div className="text-xs text-white/50">{level.description}</div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Column B - When Do You Surf */}
        <div className="space-y-3">
          <div>
            <h2 className="font-handwritten text-3xl sm:text-4xl text-white">When do you surf?</h2>
            <p className="text-white/60 text-sm mt-1">
              We&apos;ll highlight the best times
            </p>
          </div>

          <div className="space-y-2">
            {TIME_PREFERENCES.map((time) => {
              const isSelected = selectedTime === time.value;

              return (
                <motion.button
                  key={time.value}
                  type="button"
                  onClick={() => setSelectedTime(time.value)}
                  whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                  animate={
                    reducedMotion
                      ? undefined
                      : { scale: isSelected ? 1.02 : 1 }
                  }
                  transition={
                    reducedMotion
                      ? undefined
                      : { type: "spring", stiffness: 300, damping: 20 }
                  }
                  className={cn(
                    "w-full px-3 py-2.5 border rounded-lg text-left transition-colors flex items-center gap-3",
                    isSelected
                      ? "border-[#F78E42] bg-[#F78E42]/10"
                      : "bg-white/[0.06] border-white/[0.12] hover:bg-white/10"
                  )}
                >
                  {/* Circle radio indicator */}
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors",
                      isSelected
                        ? "border-[#F78E42] bg-[#F78E42]"
                        : "border-white/30"
                    )}
                  >
                    {isSelected && (
                      <motion.div
                        initial={reducedMotion ? { scale: 1 } : { scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", ...HOME_HEADER_MOTION.spring }}
                        className="w-2 h-2 rounded-full bg-white"
                      />
                    )}
                  </div>

                  <div className="text-2xl flex-shrink-0">{time.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-sm">{time.label}</div>
                    <div className="text-xs text-white/50">{time.description}</div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={prevStep}
          className="flex-1 py-3 rounded-lg bg-white/[0.06] border border-white/[0.12] text-white font-semibold text-sm hover:bg-white/10 transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleMaybeLater}
          className="flex-1 py-3 text-white/40 hover:text-white/60 text-sm transition-colors"
        >
          Maybe later
        </button>
        <button
          type="button"
          onClick={handleContinue}
          className="flex-1 py-3 rounded-lg bg-gradient-to-r from-[#F78E42] to-[#D57835] text-white font-semibold text-sm transition-opacity"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
