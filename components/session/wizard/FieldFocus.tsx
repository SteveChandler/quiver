"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { WIZARD_MOTION } from "@/lib/constants/animations";

interface FieldFocusProps {
  children: React.ReactNode;
  isValid?: boolean;
  hasError?: boolean;
  className?: string;
}

export function FieldFocus({ 
  children, 
  isValid = false, 
  hasError = false, 
  className 
}: FieldFocusProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Track focus events within the container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleFocusIn = (e: FocusEvent) => {
      setIsFocused(true);
      setHasInteracted(true);
    };

    const handleFocusOut = (e: FocusEvent) => {
      // Only blur if the new focus target is not within the container
      if (!container.contains(e.relatedTarget as Node)) {
        setIsFocused(false);
      }
    };

    const handleInput = () => {
      setHasInteracted(true);
    };

    container.addEventListener('focusin', handleFocusIn);
    container.addEventListener('focusout', handleFocusOut);
    container.addEventListener('input', handleInput);

    return () => {
      container.removeEventListener('focusin', handleFocusIn);
      container.removeEventListener('focusout', handleFocusOut);
      container.removeEventListener('input', handleInput);
    };
  }, []);

  // Determine the current state for animations
  const getCurrentState = () => {
    if (hasError && hasInteracted) return 'error';
    if (isValid && hasInteracted) return 'valid';
    if (isFocused) return 'focus';
    return 'rest';
  };

  const currentState = getCurrentState();
  const focusMotion = WIZARD_MOTION.focus;

  // Get animation properties based on current state
  const getAnimationProps = () => {
    if (prefersReducedMotion) {
      // Simplified animations for reduced motion users
      return {
        scale: 1,
        boxShadow: currentState === 'error' 
          ? "0 0 0 2px rgba(239,68,68,0.5)"
          : currentState === 'valid'
            ? "0 0 0 2px rgba(34,197,94,0.5)"  
            : currentState === 'focus'
              ? "0 0 0 2px rgba(0,119,182,0.5)"
              : "0 0 0 0px rgba(0,119,182,0)",
        transition: { duration: 0.15 }
      };
    }

    // Full animations for users without reduced motion preference
    switch (currentState) {
      case 'error':
        return {
          ...focusMotion.error,
          transition: { ...focusMotion.transition, duration: 0.4 }
        };
      case 'valid':
        return {
          ...focusMotion.valid,
          transition: focusMotion.transition
        };
      case 'focus':
        return {
          ...focusMotion.focus,
          transition: focusMotion.transition
        };
      case 'rest':
      default:
        return {
          ...focusMotion.rest,
          transition: focusMotion.transition
        };
    }
  };

  return (
    <motion.div
      ref={containerRef}
      className={cn(
        "relative transition-colors duration-200",
        // Visual state indicators
        hasError && hasInteracted && "ring-1 ring-red-200",
        isValid && hasInteracted && "ring-1 ring-green-200",
        isFocused && !hasError && "ring-1 ring-blue-200",
        className
      )}
      animate={getAnimationProps()}
      data-testid="field-focus-container"
      data-state={currentState}
    >
      {children}
      
      {/* Accessibility: State announcements */}
      {hasInteracted && (
        <div className="sr-only" aria-live="polite">
          {hasError ? "Field has errors" : isValid ? "Field is valid" : ""}
        </div>
      )}
    </motion.div>
  );
}