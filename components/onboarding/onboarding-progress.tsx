"use client";

import { useEffect, useMemo, useState } from "react";
import { useMotionValue, useMotionValueEvent, useSpring } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  className?: string;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

export function OnboardingProgress({
  currentStep,
  totalSteps,
  className,
}: OnboardingProgressProps) {
  const safeTotal = Math.max(1, totalSteps);
  const safeCurrent = clamp(currentStep, 0, safeTotal - 1);

  const targetPercent = useMemo(() => {
    if (safeTotal <= 1) return 100;
    const raw = (safeCurrent / (safeTotal - 1)) * 100;
    return clamp(Math.round(raw), 0, 100);
  }, [safeCurrent, safeTotal]);

  // Animate percent changes (Motion-style) without needing to rework the base Progress component.
  const motionTarget = useMotionValue(targetPercent);
  const spring = useSpring(motionTarget, { stiffness: 180, damping: 26 });
  const [displayPercent, setDisplayPercent] = useState(targetPercent);

  useEffect(() => {
    motionTarget.set(targetPercent);
  }, [motionTarget, targetPercent]);

  useMotionValueEvent(spring, "change", (latest) => {
    setDisplayPercent(clamp(Math.round(latest), 0, 100));
  });

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Progress</span>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {displayPercent}%
        </span>
      </div>
      <Progress value={displayPercent} className="h-2 bg-muted" />
    </div>
  );
}





