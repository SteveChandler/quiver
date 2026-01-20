"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface AnimatedWaveIconProps {
  className?: string;
  /** Size in pixels (default: 14) */
  size?: number;
  /** Animation duration in seconds (default: 1.5) */
  duration?: number;
}

/**
 * AnimatedWaveIcon - A flowing wave SVG animation
 *
 * Displays a smooth sine wave that appears to flow horizontally,
 * creating an ocean-like movement effect. Respects user's reduced
 * motion preferences by showing a static wave.
 *
 * @example
 * ```tsx
 * <AnimatedWaveIcon className="text-blue-400" size={16} />
 * ```
 */
export function AnimatedWaveIcon({
  className,
  size = 14,
  duration = 1.5,
}: AnimatedWaveIconProps) {
  const id = useId();
  const clipId = `wave-clip-${id}`;
  const reducedMotion = useReducedMotion();

  // Static wave for users who prefer reduced motion
  if (reducedMotion) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={cn("overflow-visible", className)}
        aria-hidden="true"
      >
        <path
          d="M0 12 Q3 6, 6 12 T12 12 T18 12 T24 12"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn("overflow-visible", className)}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width="24" height="24" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {/* Animated wave path - moves left to create flow effect */}
        <path
          d="M-12 12 Q-9 6, -6 12 T0 12 T6 12 T12 12 T18 12 T24 12 T30 12 T36 12"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          style={{
            animation: `wave-flow ${duration}s linear infinite`,
          }}
        />
      </g>
      <style>{`
        @keyframes wave-flow {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-12px);
          }
        }
      `}</style>
    </svg>
  );
}

export default AnimatedWaveIcon;
