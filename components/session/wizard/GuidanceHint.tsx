"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, CheckCircle, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { WIZARD_MOTION } from "@/lib/constants/animations";

interface GuidanceHintProps {
  hints: string[];
  isVisible: boolean;
  type?: 'help' | 'success' | 'tip';
  className?: string;
}

export function GuidanceHint({ 
  hints, 
  isVisible, 
  type = 'help', 
  className 
}: GuidanceHintProps) {
  
  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  // Use simplified animations for users who prefer reduced motion
  const hintMotion = prefersReducedMotion ? {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.15 }
  } : WIZARD_MOTION.hint;

  // Icon and styling based on type
  const getTypeConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: CheckCircle,
          iconColor: 'text-green-500',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-800'
        };
      case 'tip':
        return {
          icon: Lightbulb,
          iconColor: 'text-yellow-500',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-800'
        };
      case 'help':
      default:
        return {
          icon: HelpCircle,
          iconColor: 'text-blue-500',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-800'
        };
    }
  };

  const typeConfig = getTypeConfig();
  const Icon = typeConfig.icon;

  return (
    <AnimatePresence>
      {isVisible && hints.length > 0 && (
        <motion.div
          initial={hintMotion.initial}
          animate={hintMotion.animate}
          exit={hintMotion.exit}
          transition={hintMotion.transition}
          className={cn(
            "rounded-lg border p-4",
            typeConfig.bgColor,
            typeConfig.borderColor,
            className
          )}
          data-testid="guidance-hint"
          role="complementary"
          aria-label="Helpful guidance"
        >
          <div className="flex items-start space-x-3">
            <Icon 
              className={cn("w-5 h-5 mt-0.5 flex-shrink-0", typeConfig.iconColor)} 
              aria-hidden="true"
            />
            
            <div className="flex-1 space-y-2">
              {/* Hint Title */}
              <div className={cn("font-medium text-sm", typeConfig.textColor)}>
                {type === 'help' && 'Need help with this step?'}
                {type === 'success' && 'Great job!'}
                {type === 'tip' && 'Pro tip'}
              </div>

              {/* Hint List */}
              <ul className={cn("space-y-1 text-sm", typeConfig.textColor)}>
                {hints.map((hint, index) => (
                  <motion.li
                    key={index}
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -10 }}
                    animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                    transition={prefersReducedMotion ? 
                      { duration: 0.15, delay: index * 0.05 } : 
                      { duration: 0.22, delay: index * 0.1 }
                    }
                    className="flex items-start space-x-2"
                  >
                    <span 
                      className={cn("w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0", 
                        type === 'success' ? 'bg-green-400' :
                        type === 'tip' ? 'bg-yellow-400' :
                        'bg-blue-400'
                      )}
                      aria-hidden="true"
                    />
                    <span>{hint}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}