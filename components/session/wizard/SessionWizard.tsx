"use client";

import React from "react";
import { SessionFormMode, SessionFormState } from "@/hooks/use-session-form";
import { AnimatedSessionWizard } from "./AnimatedSessionWizard";

interface SessionWizardProps {
  mode: SessionFormMode;
  onComplete?: (sessionData: any) => void | Promise<void>;
  onCancel?: () => void;
  className?: string;
  /**
   * Optional initial form state for prefilling the wizard.
   * Example: { selectedBeachId: 'abc-123', selectedBeach: 'Pacific Beach', selectedDate: '2025-11-22' }
   */
  initialFormState?: Partial<SessionFormState>;
  /**
   * Optional target step to jump to after initial render (1-indexed: 1-4).
   * The wizard will validate that required fields for earlier steps are satisfied before jumping.
   * Example: targetStep={3} will jump to the Goals step if beach and date/time are prefilled.
   */
  targetStep?: number;
}

export function SessionWizard({
  mode,
  onComplete,
  onCancel,
  className,
  initialFormState,
  targetStep,
}: SessionWizardProps) {
  return (
    <AnimatedSessionWizard
      initialMode={mode}
      onComplete={onComplete}
      onCancel={onCancel}
      className={className}
      initialFormState={initialFormState}
      targetStep={targetStep}
    />
  );
}