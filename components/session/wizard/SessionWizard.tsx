"use client";

import React from "react";
import { SessionFormMode } from "@/hooks/use-session-form";
import { AnimatedSessionWizard } from "./AnimatedSessionWizard";

interface SessionWizardProps {
  mode: SessionFormMode;
  onComplete?: (sessionData: any) => void;
  onCancel?: () => void;
  className?: string;
}

export function SessionWizard({
  mode,
  onComplete,
  onCancel,
  className,
}: SessionWizardProps) {
  return (
    <AnimatedSessionWizard
      initialMode={mode}
      onComplete={onComplete}
      onCancel={onCancel}
      className={className}
    />
  );
}