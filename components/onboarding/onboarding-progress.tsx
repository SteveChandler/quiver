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
    <div className={cn("flex items-center justify-center gap-2", className)}>
      {Array.from({ length: totalSteps }).map((_, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isUpcoming = index > currentStep;

        // Connecting line between dots (skip after last dot)
        const showLine = index < totalSteps - 1;

        return (
          <div key={index} className="flex items-center">
            {/* Dot */}
            <motion.div
              animate={
                reducedMotion
                  ? {}
                  : {
                      scale: isCurrent ? 1.3 : 1,
                      boxShadow: isCurrent
                        ? "0 0 8px rgba(247, 142, 66, 0.8)"
                        : "none",
                    }
              }
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={cn(
                "rounded-full border-2 transition-colors duration-300",
                // Size
                isCurrent ? "h-3 w-3" : "h-2.5 w-2.5",
                // Fill & border
                isCompleted && "border-white bg-white",
                isCurrent && "border-[#F78E42] bg-[#F78E42]",
                isUpcoming && "border-white/30 bg-transparent"
              )}
            />

            {/* Connecting line */}
            {showLine && (
              <div className="relative mx-1 h-px w-6 bg-white/20">
                <div
                  className="absolute inset-y-0 left-0 bg-white/60 transition-all duration-300"
                  style={{ width: isCompleted ? "100%" : "0%" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
