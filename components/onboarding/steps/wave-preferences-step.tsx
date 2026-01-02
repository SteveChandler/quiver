"use client";

import { useState } from "react";
import { useOnboardingStore } from "@/store/onboarding-store";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  WAVE_SIZES,
  BREAK_TYPES,
  SURF_STYLES,
} from "@/lib/constants/user-preferences";

export function WavePreferencesStep() {
  const { data, updateData, nextStep, prevStep } = useOnboardingStore();

  const [waveSize, setWaveSize] = useState<string | undefined>(
    data.preferredWaveSize
  );
  const [breakType, setBreakType] = useState<string | undefined>(
    data.preferredBreakType
  );
  const [surfStyles, setSurfStyles] = useState<string[]>(
    data.surfStyles || []
  );

  const handleContinue = () => {
    if (surfStyles.length > 0) {
      updateData({
        preferredWaveSize: waveSize as
          | "small"
          | "medium"
          | "large"
          | "any"
          | undefined,
        preferredBreakType: breakType as
          | "beach"
          | "point"
          | "reef"
          | "any"
          | undefined,
        surfStyles,
      });
      nextStep();
    }
  };

  const handleSkip = () => {
    nextStep();
  };

  const toggleSurfStyle = (value: string) => {
    setSurfStyles((prev) =>
      prev.includes(value)
        ? prev.filter((s) => s !== value)
        : [...prev, value]
    );
  };

  return (
    <div className="space-y-6" data-testid="wave-preferences-step">
      <div>
        <h2 className="text-2xl font-bold mb-2">What waves do you prefer?</h2>
        <p className="text-muted-foreground text-sm">
          Help us find the best conditions for you
        </p>
      </div>

      {/* Wave Size - Segmented Buttons */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Wave Size</Label>
        <div className="grid grid-cols-4 gap-2">
          {WAVE_SIZES.map((size) => {
            const isSelected = waveSize === size.value;
            return (
              <button
                key={size.value}
                type="button"
                onClick={() => setWaveSize(size.value)}
                className={cn(
                  "flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all min-h-[72px]",
                  isSelected
                    ? "border-ocean-blue bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                )}
                data-testid={`wave-size-${size.value}`}
              >
                <span className="text-lg">{size.emoji}</span>
                <span className="text-xs font-medium mt-1">{size.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Break Type - Segmented Buttons */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Break Type</Label>
        <div className="grid grid-cols-4 gap-2">
          {BREAK_TYPES.map((type) => {
            const isSelected = breakType === type.value;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => setBreakType(type.value)}
                className={cn(
                  "flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all min-h-[72px]",
                  isSelected
                    ? "border-ocean-blue bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                )}
                data-testid={`break-type-${type.value}`}
              >
                <span className="text-lg">{type.emoji}</span>
                <span className="text-xs font-medium mt-1">{type.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Surf Styles - Multi-select Grid */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Surf Styles{" "}
          <span className="text-muted-foreground font-normal">
            (select all that apply)
          </span>
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {SURF_STYLES.map((style) => {
            const isSelected = surfStyles.includes(style.value);
            return (
              <button
                key={style.value}
                type="button"
                onClick={() => toggleSurfStyle(style.value)}
                className={cn(
                  "flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all min-h-[72px]",
                  isSelected
                    ? "border-ocean-blue bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                )}
                data-testid={`surf-style-${style.value}`}
              >
                <span className="text-2xl">{style.emoji}</span>
                <span className="text-xs font-medium mt-1">{style.label}</span>
              </button>
            );
          })}
        </div>
        {surfStyles.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Please select at least one surf style
          </p>
        )}
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
          disabled={surfStyles.length === 0}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
