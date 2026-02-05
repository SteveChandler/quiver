"use client";

/**
 * Animated Counter Component
 *
 * Count-up animation for numbers with scroll-triggered activation.
 * Respects reduced motion preferences for accessibility.
 *
 * @module components/ui/animated-counter
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

/**
 * Props for the AnimatedCounter component
 */
export interface AnimatedCounterProps {
  /** Target value to count to */
  value: number;
  /** Duration of animation in milliseconds (default: 800) */
  duration?: number;
  /** Number of decimal places to display (default: 0) */
  decimals?: number;
  /** Prefix to display before the number (e.g., "$") */
  prefix?: string;
  /** Suffix to display after the number (e.g., "ft", "%") */
  suffix?: string;
  /** Format function for custom number display */
  formatValue?: (value: number) => string;
  /** Additional CSS classes */
  className?: string;
  /** Start animation on scroll into view (default: true) */
  animateOnView?: boolean;
  /** Intersection observer threshold (default: 0.5) */
  threshold?: number;
}

/**
 * Easing function for smooth count-up animation
 * Uses ease-out-cubic for natural deceleration
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * AnimatedCounter Component
 *
 * Displays a number that counts up from 0 to the target value
 * when scrolled into view. Supports prefixes, suffixes, and
 * custom formatting.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <AnimatedCounter value={85} />
 *
 * // With suffix
 * <AnimatedCounter value={4.5} suffix="ft" decimals={1} />
 *
 * // With prefix
 * <AnimatedCounter value={100} prefix="+" suffix="/100" />
 *
 * // Custom formatting
 * <AnimatedCounter
 *   value={1000}
 *   formatValue={(v) => v.toLocaleString()}
 * />
 * ```
 */
export function AnimatedCounter({
  value,
  duration = 800,
  decimals = 0,
  prefix = "",
  suffix = "",
  formatValue,
  className,
  animateOnView = true,
  threshold = 0.5,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const elementRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const reducedMotion = useReducedMotion();

  // Format the display value
  const formattedValue = useCallback(
    (v: number): string => {
      if (formatValue) {
        return formatValue(v);
      }
      return v.toFixed(decimals);
    },
    [formatValue, decimals]
  );

  // Animation function
  const animate = useCallback(() => {
    if (reducedMotion) {
      // Skip animation for reduced motion preference
      setDisplayValue(value);
      setHasAnimated(true);
      return;
    }

    const startTime = performance.now();
    const startValue = 0;

    const updateValue = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);

      const currentValue = startValue + (value - startValue) * easedProgress;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(updateValue);
      } else {
        setHasAnimated(true);
      }
    };

    animationRef.current = requestAnimationFrame(updateValue);
  }, [value, duration, reducedMotion]);

  // Intersection observer for scroll-triggered animation
  useEffect(() => {
    if (!animateOnView) {
      // Animate immediately if not waiting for scroll
      animate();
      return;
    }

    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            animate();
          }
        });
      },
      { threshold }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate, animateOnView, hasAnimated, threshold]);

  // Update value if prop changes after initial animation
  useEffect(() => {
    if (hasAnimated && displayValue !== value) {
      if (reducedMotion) {
        setDisplayValue(value);
      } else {
        // Animate to new value
        const startValue = displayValue;
        const startTime = performance.now();

        const updateValue = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / (duration / 2), 1);
          const easedProgress = easeOutCubic(progress);

          const currentValue =
            startValue + (value - startValue) * easedProgress;
          setDisplayValue(currentValue);

          if (progress < 1) {
            animationRef.current = requestAnimationFrame(updateValue);
          }
        };

        animationRef.current = requestAnimationFrame(updateValue);
      }
    }
  }, [value, hasAnimated, displayValue, duration, reducedMotion]);

  return (
    <span
      ref={elementRef}
      className={cn("tabular-nums", className)}
      aria-label={`${prefix}${formattedValue(value)}${suffix}`}
    >
      {prefix}
      {formattedValue(displayValue)}
      {suffix}
    </span>
  );
}
