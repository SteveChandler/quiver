"use client";

import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { WIZARD_MOTION } from "@/lib/constants/animations";

interface ProgressBarProps {
  progress: number; // 0-100
  completedSteps: number;
  totalSteps: number;
  currentStep: number;
  onStepClick?: (step: number) => void;
  isStepValid?: (step: number) => boolean;
  className?: string;
}

export function ProgressBar({
  progress,
  completedSteps,
  totalSteps,
  currentStep,
  onStepClick,
  isStepValid,
  className,
}: ProgressBarProps) {
  
  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  // Use simplified animations for users who prefer reduced motion
  const progressMotion = prefersReducedMotion ? {
    initial: { scaleX: 0 },
    animate: { scaleX: progress / 100 },
    transition: { duration: 0.2 }
  } : {
    ...WIZARD_MOTION.progress,
    animate: { scaleX: progress / 100 },
  };

  const stepMotion = prefersReducedMotion ? {
    transition: { duration: 0.15 }
  } : {
    transition: { duration: 0.24, type: "spring", damping: 20 }
  };

  return (
    <div className={cn("w-full space-y-4", className)}>
      
      {/* Progress Statistics */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>{completedSteps} of {totalSteps} steps completed</span>
        <span>{Math.round(progress)}% complete</span>
      </div>

      {/* Main Progress Bar */}
      <div className="relative">
        {/* Background Track */}
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          {/* Animated Progress Fill */}
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full origin-left"
            initial={progressMotion.initial}
            animate={progressMotion.animate}
            transition={progressMotion.transition}
            data-testid="progress-fill"
          />
        </div>

        {/* Step Indicators */}
        <div className="absolute top-0 left-0 w-full h-2 flex items-center justify-between">
          {Array.from({ length: totalSteps }, (_, index) => {
            const stepNumber = index;
            const isCompleted = isStepValid ? isStepValid(stepNumber) : false;
            const isCurrent = stepNumber === currentStep;
            const isClickable = onStepClick && stepNumber <= currentStep;
            
            return (
              <motion.button
                key={stepNumber}
                onClick={isClickable ? () => onStepClick(stepNumber) : undefined}
                disabled={!isClickable}
                className={cn(
                  "relative flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                  isCompleted 
                    ? "bg-green-500 border-green-500 text-white" 
                    : isCurrent 
                      ? "bg-blue-500 border-blue-500 text-white" 
                      : "bg-white border-gray-300 text-gray-500",
                  isClickable && "hover:scale-110 cursor-pointer",
                  !isClickable && "cursor-default"
                )}
                whileHover={isClickable && !prefersReducedMotion ? { scale: 1.1 } : undefined}
                whileTap={isClickable && !prefersReducedMotion ? { scale: 0.95 } : undefined}
                transition={stepMotion.transition}
                data-testid={`step-indicator-${stepNumber}`}
                aria-label={`Step ${stepNumber + 1}${isCompleted ? ' - Completed' : isCurrent ? ' - Current' : ''}`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : isCurrent ? (
                  <motion.div
                    className="w-2 h-2 bg-white rounded-full"
                    animate={prefersReducedMotion ? {} : {
                      scale: [1, 1.2, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                ) : (
                  <Circle className="w-3 h-3" />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Optional Step Labels (shown on larger screens) */}
      <div className="hidden md:flex items-center justify-between text-xs text-gray-500 mt-2">
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1;
          const isCurrent = index === currentStep;
          
          return (
            <div
              key={index}
              className={cn(
                "text-center transition-colors",
                isCurrent && "text-blue-600 font-medium"
              )}
            >
              Step {stepNumber}
            </div>
          );
        })}
      </div>

      {/* Accessibility: Screen reader progress announcement */}
      <div 
        className="sr-only" 
        aria-live="polite" 
        aria-atomic="true"
        data-testid="progress-announcement"
      >
        Step {currentStep + 1} of {totalSteps}. {Math.round(progress)}% complete.
        {completedSteps > 0 && ` ${completedSteps} steps completed.`}
      </div>
    </div>
  );
}