"use client";

import { Button } from "@/components/ui/button";
import { SessionFormMode } from "@/hooks/use-session-form";

interface FormNavigationProps {
  step: number;
  totalSteps: number;
  loading: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  isComplete: boolean;
}

export function FormNavigation({
  step,
  totalSteps,
  loading,
  onBack,
  onNext,
  onSubmit,
  isComplete,
}: FormNavigationProps) {
  const isFirstStep = step === 1;
  const isLastStep = step === totalSteps;

  return (
    <div className="flex justify-between mt-4 pb-6">
      <Button
        variant="outline"
        onClick={onBack}
        disabled={isFirstStep || loading}
      >
        Back
      </Button>

      {isLastStep ? (
        <Button onClick={onSubmit} disabled={loading || !isComplete}>
          {loading ? "Saving..." : "Submit"}
        </Button>
      ) : (
        <Button onClick={onNext} disabled={loading}>
          Next
        </Button>
      )}
    </div>
  );
}
