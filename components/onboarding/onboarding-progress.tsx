"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  className?: string;
}

export function OnboardingProgress({
  currentStep,
  totalSteps,
  className,
}: OnboardingProgressProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div className={cn("flex items-center justify-center gap-3", className)}>
      {Array.from({ length: totalSteps }).map((_, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <motion.div
            key={index}
            animate={
              reducedMotion
                ? {}
                : {
                    scale: isCurrent ? 1.3 : 1,
                    boxShadow: isCurrent
                      ? "0 0 10px rgba(247, 142, 66, 0.6)"
                      : "none",
                  }
            }
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={cn(
              "rounded-full transition-colors duration-300",
              // Sizes
              isCurrent ? "h-3 w-3" : "h-2.5 w-2.5",
              // Fill & border
              isCompleted && "bg-white",
              isCurrent && "bg-[#F78E42]",
              !isCompleted && !isCurrent && "border-2 border-white/30 bg-transparent"
            )}
          />
        );
      })}
    </div>
  );
}
