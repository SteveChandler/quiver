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
  
  if (!isActive) return null;
  
  return (
    <div className={className} data-testid={`wizard-step-${stepId}`}>
      {children}
    </div>
  );
}