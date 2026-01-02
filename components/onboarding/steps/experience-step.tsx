"use client";

import { useState } from "react";
import { useOnboardingStore } from "@/store/onboarding-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EXPERIENCE_LEVELS } from "@/lib/constants/user-preferences";
import { CheckCircle2 } from "lucide-react";

export function ExperienceStep() {
  const { data, updateData, nextStep, prevStep } = useOnboardingStore();
  const [selectedLevel, setSelectedLevel] = useState<string | undefined>(
    data.experienceLevel
  );

  const handleSelect = (value: string) => {
    setSelectedLevel(value);
  };

  const handleContinue = () => {
    if (selectedLevel) {
      updateData({
        experienceLevel: selectedLevel as
          | "beginner"
          | "intermediate"
          | "advanced"
          | "expert",
      });
      nextStep();
    }
  };

  const handleSkip = () => {
    nextStep();
  };

  return (
    <div className="space-y-6" data-testid="experience-step">
      <div>
        <h2 className="text-2xl font-bold mb-2">What&apos;s your experience?</h2>
        <p className="text-muted-foreground text-sm">
          This helps us recommend the right spots and conditions for you
        </p>
      </div>

      {/* Experience Level Cards */}
      <div className="space-y-3">
        {EXPERIENCE_LEVELS.map((level) => {
          const isSelected = selectedLevel === level.value;
          return (
            <button
              key={level.value}
              type="button"
              onClick={() => handleSelect(level.value)}
              className={cn(
                "w-full p-4 border-2 rounded-lg text-left transition-all flex items-center gap-4",
                isSelected
                  ? "border-ocean-blue bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
              data-testid={`experience-${level.value}`}
            >
              <div className="text-3xl flex-shrink-0">{level.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground">
                  {level.label}
                </div>
                <div className="text-sm text-muted-foreground">
                  {level.description}
                </div>
              </div>
              {isSelected && (
                <CheckCircle2 className="w-6 h-6 text-ocean-blue flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={prevStep}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={handleSkip}
          className="flex-1"
        >
          Skip for now
        </Button>
        <Button
          type="button"
          onClick={handleContinue}
          className="flex-1"
          disabled={!selectedLevel}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
