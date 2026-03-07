"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { useOnboardingStore } from "@/store/onboarding-store";
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
  const { data, updateData, nextStep, prevStep } = useOnboardingStore();
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

  const handleSkip = () => {
    nextStep();
  };

  return (
    <div className="space-y-8" data-testid="level-and-time-step">
      {/* Section A - Experience Level */}
      <div className="space-y-4">
        <div>
          <h2 className="text-white font-roboto text-2xl font-bold">What kind of surfer are you?</h2>
          <p className="text-white/60 mt-1">
            We&apos;ll match conditions to your level
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
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
                    : isSelected
                    ? { scale: [1, 1.03, 1] }
                    : { scale: 1 }
                }
                transition={
                  reducedMotion
                    ? undefined
                    : { type: "spring", ...HOME_HEADER_MOTION.spring }
                }
                className={cn(
                  "p-3 border rounded-lg text-left transition-colors flex flex-col items-center gap-2",
                  isSelected
                    ? "border-[#F78E42] bg-[#F78E42]/10"
                    : "bg-white/10 border-white/20 hover:bg-white/15"
                )}
              >
                <div className="text-2xl flex-shrink-0">{level.emoji}</div>
                <div className="w-full text-center">
                  <div className="font-semibold text-white flex items-center justify-center gap-2">
                    {level.label}
                    {isSelected && (
                      <motion.span
                        initial={reducedMotion ? { scale: 1 } : { scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", ...HOME_HEADER_MOTION.spring }}
                      >
                        <CheckCircle2 className="w-4 h-4 text-[#F78E42] flex-shrink-0" />
                      </motion.span>
                    )}
                  </div>
                  <div className="text-xs text-white/60 mt-1">{level.description}</div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Section B - When Do You Surf */}
      <div className="space-y-4">
        <div>
          <h2 className="text-white font-roboto text-2xl font-bold">When do you surf?</h2>
          <p className="text-white/60 mt-1">
            We&apos;ll highlight the best times for you
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    : isSelected
                    ? { scale: [1, 1.03, 1] }
                    : { scale: 1 }
                }
                transition={
                  reducedMotion
                    ? undefined
                    : { type: "spring", ...HOME_HEADER_MOTION.spring }
                }
                className={cn(
                  "w-full p-4 border rounded-lg text-left transition-colors flex items-center gap-4",
                  isSelected
                    ? "border-[#F78E42] bg-[#F78E42]/10"
                    : "bg-white/10 border-white/20 hover:bg-white/15"
                )}
              >
                <div className="text-3xl flex-shrink-0">{time.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white">{time.label}</div>
                  <div className="text-sm text-white/60">{time.description}</div>
                </div>
                {isSelected && (
                  <motion.span
                    initial={reducedMotion ? { scale: 1 } : { scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", ...HOME_HEADER_MOTION.spring }}
                  >
                    <CheckCircle2 className="w-6 h-6 text-[#F78E42] flex-shrink-0" />
                  </motion.span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={prevStep}
          className="flex-1 py-3 rounded-lg bg-white/10 border border-white/20 text-white font-semibold text-sm hover:bg-white/15 transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleSkip}
          className="flex-1 py-3 text-white/50 hover:text-white/70 text-sm transition-colors"
        >
          Skip
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
