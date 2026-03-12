"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface MatchRingIllustrationProps {
  className?: string;
}

export function MatchRingIllustration({ className }: MatchRingIllustrationProps) {
  const id = useId();
  const safeId = id.replace(/:/g, "");
  const reducedMotion = useReducedMotion();

  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const fillPercent = 0.75;
  const dashOffset = circumference * (1 - fillPercent);

  return (
    <svg
      viewBox="0 0 120 80"
      fill="none"
      className={cn("w-full h-full", className)}
      aria-hidden="true"
    >
      {/* Background track */}
      <circle
        cx="60"
        cy="40"
        r={radius}
        className="text-white/20"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />

      {/* Animated fill ring */}
      <circle
        cx="60"
        cy="40"
        r={radius}
        className="text-sunset-orange"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
        opacity={0.85}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={reducedMotion ? dashOffset : circumference}
        transform="rotate(-90 60 40)"
        style={
          reducedMotion
            ? undefined
            : {
                animation: `mri-fill-${safeId} 1.2s ease-out 0.3s forwards`,
              }
        }
      />

      {/* Star in center */}
      <g
        transform="translate(60, 40)"
        style={
          reducedMotion
            ? undefined
            : {
                animation: `mri-pulse-${safeId} 2s ease-in-out infinite`,
                transformOrigin: "0 0",
              }
        }
      >
        <path
          d="M0 -7 L1.8 -2.2 L7 -2.2 L2.8 1 L4.2 6 L0 3 L-4.2 6 L-2.8 1 L-7 -2.2 L-1.8 -2.2 Z"
          className="text-amber-400"
          fill="currentColor"
          opacity={0.9}
        />
      </g>

      {!reducedMotion && (
        <style>{`
          @keyframes mri-fill-${safeId} {
            to { stroke-dashoffset: ${dashOffset}; }
          }
          @keyframes mri-pulse-${safeId} {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.15); }
          }
        `}</style>
      )}
    </svg>
  );
}
