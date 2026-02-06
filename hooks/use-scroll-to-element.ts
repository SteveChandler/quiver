"use client";

import { useEffect, useRef } from "react";

interface UseScrollToElementOptions {
  /** Whether to trigger scroll */
  shouldScroll: boolean;
  /** Delay before scrolling (ms) - allows DOM to settle */
  delay?: number;
  /** Scroll behavior */
  behavior?: ScrollBehavior;
  /** Scroll block alignment */
  block?: ScrollLogicalPosition;
}

/**
 * Hook for scrolling to an element when a condition is met.
 * Handles timing, cleanup, and provides a ref to attach to target element.
 *
 * @example
 * const ref = useScrollToElement({ shouldScroll: isActive });
 * return <div ref={ref}>Target Section</div>
 */
export function useScrollToElement<T extends HTMLElement = HTMLDivElement>({
  shouldScroll,
  delay = 100,
  behavior = "smooth",
  block = "start",
}: UseScrollToElementOptions) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (shouldScroll && ref.current) {
      const timer = setTimeout(() => {
        ref.current?.scrollIntoView({ behavior, block });
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [shouldScroll, delay, behavior, block]);

  return ref;
}
