"use client";

/**
 * Scroll Reveal Component
 *
 * Scroll-triggered animation wrapper for reveal effects.
 * Supports multiple animation variants with stagger capability.
 *
 * @module components/ui/scroll-reveal
 */

import React, { useEffect, useState, useRef, Children, cloneElement, isValidElement, ReactElement } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

/**
 * Animation variant types
 */
export type ScrollRevealVariant =
  | "fadeUp"
  | "fadeIn"
  | "slideLeft"
  | "slideRight"
  | "scale"
  | "none";

/**
 * Props for the ScrollReveal component
 */
export interface ScrollRevealProps {
  /** Child elements to animate */
  children: React.ReactNode;
  /** Animation variant (default: "fadeUp") */
  variant?: ScrollRevealVariant;
  /** Animation duration in milliseconds (default: 500) */
  duration?: number;
  /** Delay before animation starts in milliseconds (default: 0) */
  delay?: number;
  /** Intersection observer threshold (default: 0.2) */
  threshold?: number;
  /** Whether to animate only once or every time element enters view (default: true) */
  once?: boolean;
  /** Enable stagger animation for child elements (default: false) */
  stagger?: boolean;
  /** Stagger delay between children in milliseconds (default: 100) */
  staggerDelay?: number;
  /** Additional CSS classes for the wrapper */
  className?: string;
}

/**
 * CSS classes for each animation variant
 */
const VARIANT_INITIAL_STYLES: Record<ScrollRevealVariant, string> = {
  fadeUp: "opacity-0 translate-y-5",
  fadeIn: "opacity-0",
  slideLeft: "opacity-0 -translate-x-5",
  slideRight: "opacity-0 translate-x-5",
  scale: "opacity-0 scale-95",
  none: "",
};

const VARIANT_ANIMATED_STYLES: Record<ScrollRevealVariant, string> = {
  fadeUp: "opacity-100 translate-y-0",
  fadeIn: "opacity-100",
  slideLeft: "opacity-100 translate-x-0",
  slideRight: "opacity-100 translate-x-0",
  scale: "opacity-100 scale-100",
  none: "",
};

/**
 * ScrollReveal Component
 *
 * Wraps child elements and animates them when they scroll into view.
 * Supports various animation variants and staggered animations for lists.
 *
 * @example
 * ```tsx
 * // Basic usage - single element
 * <ScrollReveal>
 *   <div>Content to reveal</div>
 * </ScrollReveal>
 *
 * // With variant
 * <ScrollReveal variant="slideLeft" delay={200}>
 *   <Card>Slide in from left</Card>
 * </ScrollReveal>
 *
 * // Staggered list animation
 * <ScrollReveal stagger staggerDelay={100}>
 *   <div>Item 1</div>
 *   <div>Item 2</div>
 *   <div>Item 3</div>
 * </ScrollReveal>
 * ```
 */
export function ScrollReveal({
  children,
  variant = "fadeUp",
  duration = 500,
  delay = 0,
  threshold = 0.2,
  once = true,
  stagger = false,
  staggerDelay = 100,
  className,
}: ScrollRevealProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Skip animation setup for reduced motion
    if (reducedMotion) {
      setIsVisible(true);
      setHasAnimated(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Add delay before triggering animation
            setTimeout(() => {
              setIsVisible(true);
              setHasAnimated(true);
            }, delay);

            if (once) {
              observer.unobserve(element);
            }
          } else if (!once && hasAnimated) {
            setIsVisible(false);
          }
        });
      },
      { threshold }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [delay, once, threshold, hasAnimated, reducedMotion]);

  // For reduced motion, render immediately without animation
  if (reducedMotion) {
    return (
      <div ref={elementRef} className={className}>
        {children}
      </div>
    );
  }

  // Render with stagger support
  if (stagger) {
    const childArray = Children.toArray(children);

    return (
      <div ref={elementRef} className={className}>
        {childArray.map((child, index) => {
          if (!isValidElement(child)) return child;

          const childDelay = index * staggerDelay;
          const childStyle: React.CSSProperties = {
            transitionProperty: "opacity, transform",
            transitionDuration: `${duration}ms`,
            transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
            transitionDelay: isVisible ? `${childDelay}ms` : "0ms",
          };

          // Type assertion for the child element
          const element = child as ReactElement<{ className?: string; style?: React.CSSProperties }>;

          return cloneElement(element, {
            className: cn(
              element.props.className,
              "transition-[opacity,transform]",
              isVisible
                ? VARIANT_ANIMATED_STYLES[variant]
                : VARIANT_INITIAL_STYLES[variant]
            ),
            style: { ...element.props.style, ...childStyle },
          });
        })}
      </div>
    );
  }

  // Single element animation
  const transitionStyle: React.CSSProperties = {
    transitionProperty: "opacity, transform",
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
  };

  return (
    <div
      ref={elementRef}
      className={cn(
        className,
        "transition-[opacity,transform]",
        isVisible
          ? VARIANT_ANIMATED_STYLES[variant]
          : VARIANT_INITIAL_STYLES[variant]
      )}
      style={transitionStyle}
    >
      {children}
    </div>
  );
}

/**
 * Utility hook to check if an element is in view
 * Useful for custom animation implementations
 */
export function useInView(
  threshold = 0.2,
  once = true
): [React.RefObject<HTMLDivElement | null>, boolean] {
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            setHasAnimated(true);
            if (once) {
              observer.unobserve(element);
            }
          } else if (!once && hasAnimated) {
            setIsVisible(false);
          }
        });
      },
      { threshold }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [once, threshold, hasAnimated]);

  return [ref, isVisible];
}
