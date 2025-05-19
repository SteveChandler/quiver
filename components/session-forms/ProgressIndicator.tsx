"use client";

import { Check } from "lucide-react";
import { SessionFormMode } from "@/hooks/use-session-form";

interface ProgressIndicatorProps {
  currentStep: number;
  mode: SessionFormMode;
}

export function ProgressIndicator({
  currentStep,
  mode,
}: ProgressIndicatorProps) {
  const isPlanning = mode === "plan";
  const totalSteps = isPlanning ? 4 : 10;

  return (
    <div className="container px-4 py-4">
      <div className="flex items-center justify-between">
        {Array.from({ length: Math.min(5, totalSteps) }).map((_, i) => (
          <div key={i} className="flex items-center">
            <div
              className={`rounded-full h-8 w-8 flex items-center justify-center ${
                currentStep >= i + 1
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {currentStep > i + 1 ? <Check className="h-5 w-5" /> : i + 1}
            </div>
            {i < Math.min(5, totalSteps) - 1 && (
              <div
                className={`h-1 w-6 ${
                  currentStep > i + 1 ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
