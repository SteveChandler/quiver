"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useOnboardingStore } from "@/store/onboarding-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  EXPERIENCE_LEVELS,
  TIME_PREFERENCES,
  type ExperienceLevel,
  type TimePreference,
} from "@/lib/constants/user-preferences";

export function LevelAndTimeStep() {
  const { data, updateData, nextStep, prevStep } = useOnboardingStore();

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
          <h2 className="text-2xl font-bold text-foreground">What&apos;s your experience level?</h2>
          <p className="text-muted-foreground mt-1">
            This helps us personalize your surf forecasts
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {EXPERIENCE_LEVELS.map((level) => {
            const isSelected = selectedLevel === level.value;

            return (
              <button
                key={level.value}
                type="button"
                onClick={() => setSelectedLevel(level.value)}
                className={cn(
                  "p-3 border-2 rounded-lg text-left transition-all flex flex-col items-center gap-2",
                  isSelected
                    ? "border-ocean-blue bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="text-2xl flex-shrink-0">{level.emoji}</div>
                <div className="w-full text-center">
                  <div className="font-semibold text-foreground flex items-center justify-center gap-2">
                    {level.label}
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-ocean-blue flex-shrink-0" />}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{level.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section B - When Do You Surf */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">When do you surf?</h2>
          <p className="text-muted-foreground mt-1">
            We&apos;ll highlight the best times for you
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TIME_PREFERENCES.map((time) => {
            const isSelected = selectedTime === time.value;

            return (
              <button
                key={time.value}
                type="button"
                onClick={() => setSelectedTime(time.value)}
                className={cn(
                  "w-full p-4 border-2 rounded-lg text-left transition-all flex items-center gap-4",
                  isSelected
                    ? "border-ocean-blue bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="text-3xl flex-shrink-0">{time.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground">{time.label}</div>
                  <div className="text-sm text-muted-foreground">{time.description}</div>
                </div>
                {isSelected && <CheckCircle2 className="w-6 h-6 text-ocean-blue flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-3 pt-4">
        <Button
          variant="outline"
          onClick={prevStep}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          variant="ghost"
          onClick={handleSkip}
          className="flex-1"
        >
          Skip
        </Button>
        <Button
          onClick={handleContinue}
          className="flex-1"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
