"use client";

/**
 * Client-side animation wrappers for the /vs/surfline comparison page.
 *
 * Uses CSS transitions + Intersection Observer (no framer-motion) to keep
 * the bundle lean for this SEO-oriented page. All animations respect
 * prefers-reduced-motion via CSS media queries.
 */

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// Shared Intersection Observer hook
// ---------------------------------------------------------------------------

function useInView(threshold = 0.15): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(el);
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, inView];
}

// ---------------------------------------------------------------------------
// FadeInSection
// ---------------------------------------------------------------------------

interface FadeInSectionProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

/**
 * Scroll-triggered fade-up with configurable delay.
 * Uses CSS transitions only — no JS animation frames.
 */
export function FadeInSection({
  children,
  delay = 0,
  className = "",
}: FadeInSectionProps) {
  const [ref, inView] = useInView(0.1);

  return (
    <div
      ref={ref}
      className={`vs-fade-in ${inView ? "vs-fade-in--visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AnimatedStickerBadge
// ---------------------------------------------------------------------------

interface AnimatedStickerBadgeProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wraps a sticker badge with scale-in + slight rotation on scroll entry.
 */
export function AnimatedStickerBadge({
  children,
  className = "",
}: AnimatedStickerBadgeProps) {
  const [ref, inView] = useInView(0.2);

  return (
    <span
      ref={ref}
      className={`vs-sticker ${inView ? "vs-sticker--visible" : ""} ${className}`}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// AnimatedFeatureRow
// ---------------------------------------------------------------------------

interface AnimatedFeatureRowProps {
  children: ReactNode;
  index: number;
  className?: string;
}

/**
 * Wraps a comparison table row with stagger delay based on index.
 */
export function AnimatedFeatureRow({
  children,
  index,
  className = "",
}: AnimatedFeatureRowProps) {
  const [ref, inView] = useInView(0.05);

  return (
    <div
      ref={ref}
      className={`vs-fade-in ${inView ? "vs-fade-in--visible" : ""} ${className}`}
      style={{ transitionDelay: `${index * 50}ms` }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PriceCountUp
// ---------------------------------------------------------------------------

interface PriceCountUpProps {
  target: number;
  prefix?: string;
  className?: string;
}

/**
 * Animates a price counting up from $0 on scroll entry.
 * Uses requestAnimationFrame for smooth 60fps counting.
 */
export function PriceCountUp({
  target,
  prefix = "$",
  className = "",
}: PriceCountUpProps) {
  const [ref, inView] = useInView(0.3);
  const [value, setValue] = useState(0);
  const animationRef = useRef<number | null>(null);

  // Check reduced motion preference
  const prefersReduced = useRef(false);
  useEffect(() => {
    prefersReduced.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
  }, []);

  useEffect(() => {
    if (!inView) return;

    // If reduced motion, jump to final value
    if (prefersReduced.current) {
      setValue(target);
      return;
    }

    const duration = 1200; // ms
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out quart: 1 - (1 - t)^4
      const eased = 1 - Math.pow(1 - progress, 4);
      setValue(eased * target);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(tick);
      }
    }

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [inView, target]);

  // Format to 2 decimal places for price display
  const formatted = value >= target ? target.toFixed(2) : value.toFixed(2);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
    </span>
  );
}

// ---------------------------------------------------------------------------
// HeroPulse
// ---------------------------------------------------------------------------

interface HeroPulseProps {
  children: ReactNode;
  className?: string;
}

/**
 * Adds a subtle pulsing ring animation behind its children.
 * Used behind the "$0" price card for emphasis.
 */
export function HeroPulse({ children, className = "" }: HeroPulseProps) {
  return (
    <div className={`vs-hero-pulse ${className}`}>
      <div className="vs-hero-pulse__ring" aria-hidden="true" />
      <div className="relative">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Global Styles (injected once)
// ---------------------------------------------------------------------------

export function VsAnimationStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          /* FadeInSection + AnimatedFeatureRow */
          .vs-fade-in {
            opacity: 0;
            transform: translateY(16px);
            transition: opacity 0.4s cubic-bezier(0.25, 1, 0.5, 1),
                        transform 0.4s cubic-bezier(0.25, 1, 0.5, 1);
          }
          .vs-fade-in--visible {
            opacity: 1;
            transform: translateY(0);
          }

          /* AnimatedStickerBadge */
          .vs-sticker {
            display: inline-block;
            opacity: 0;
            transform: scale(0.85) rotate(-3deg);
            transition: opacity 0.35s cubic-bezier(0.25, 1, 0.5, 1),
                        transform 0.35s cubic-bezier(0.25, 1, 0.5, 1);
          }
          .vs-sticker--visible {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }

          /* HeroPulse ring */
          .vs-hero-pulse {
            position: relative;
          }
          .vs-hero-pulse__ring {
            position: absolute;
            inset: -4px;
            border-radius: 0.75rem;
            border: 2px solid rgba(52, 211, 153, 0.3);
            animation: vsPulseRing 2.5s ease-in-out infinite;
          }
          @keyframes vsPulseRing {
            0%, 100% {
              opacity: 0;
              transform: scale(1);
            }
            50% {
              opacity: 1;
              transform: scale(1.04);
            }
          }

          /* Respect reduced motion for ALL animations */
          @media (prefers-reduced-motion: reduce) {
            .vs-fade-in {
              opacity: 1 !important;
              transform: none !important;
              transition: none !important;
            }
            .vs-sticker {
              opacity: 1 !important;
              transform: none !important;
              transition: none !important;
            }
            .vs-hero-pulse__ring {
              animation: none !important;
              opacity: 0 !important;
            }
          }
        `,
      }}
    />
  );
}
