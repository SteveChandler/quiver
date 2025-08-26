"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WIZARD_MOTION } from "@/lib/constants/animations";

interface WizardStepProps {
  children: React.ReactNode;
  stepId: string;
  isActive: boolean;
  motion?: typeof WIZARD_MOTION.step;
  className?: string;
}

export function WizardStep({ 
  children, 
  stepId, 
  isActive, 
  motion = WIZARD_MOTION.step,
  className 
}: WizardStepProps) {
  
  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  // Use simplified animations for users who prefer reduced motion
  const stepMotion = prefersReducedMotion ? {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.15 }
  } : motion;

  return (
    <AnimatePresence mode="wait">
      {isActive && (
        <motion.div
          key={stepId}
          initial={stepMotion.initial}
          animate={stepMotion.animate}
          exit={stepMotion.exit}
          transition={stepMotion.transition}
          className={className}
          data-testid={`wizard-step-${stepId}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}