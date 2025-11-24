"use client";

import { useEffect, useState } from "react";

/**
 * Hook to detect user's reduced motion preference
 * Respects prefers-reduced-motion media query for accessibility
 * 
 * @returns boolean indicating if user prefers reduced motion
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // Check if running on client-side
    if (typeof window === "undefined") {
      return;
    }

    // Check for reduced motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    
    // Set initial state
    setReducedMotion(mediaQuery.matches);

    // Listen for changes
    const handleChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }

    // Cleanup
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  return reducedMotion;
}

/**
 * Get motion-safe animation variants for Framer Motion
 * Returns reduced variants when user prefers reduced motion
 */
export function useMotionVariants(
  fullVariants: Record<string, any>,
  reducedVariants?: Record<string, any>
) {
  const reducedMotion = useReducedMotion();
  
  if (reducedMotion && reducedVariants) {
    return reducedVariants;
  }
  
  if (reducedMotion) {
    // Default reduced motion - remove or minimize animations
    const reduced: Record<string, any> = {};
    
    Object.keys(fullVariants).forEach(key => {
      const variant = fullVariants[key];
      if (typeof variant === "object") {
        reduced[key] = {
          ...variant,
          transition: { duration: 0.01 }, // Nearly instant
          scale: 1, // Remove scale animations
          rotate: 0, // Remove rotation
          x: 0,
          y: 0,
        };
      } else {
        reduced[key] = variant;
      }
    });
    
    return reduced;
  }
  
  return fullVariants;
}
