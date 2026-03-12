"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface CompassPinProps {
  className?: string;
}

export function CompassPin({ className }: CompassPinProps) {
  const id = useId();
  const safeId = id.replace(/:/g, "");
  const reducedMotion = useReducedMotion();

  return (
    <svg
      viewBox="0 0 120 80"
      fill="none"
      className={cn("w-full h-full", className)}
      aria-hidden="true"
    >
      {/* Map pin */}
      <g
        style={
          reducedMotion
            ? undefined
            : {
                animation: `cp-bob-${safeId} 2s ease-in-out infinite`,
              }
        }
      >
        <path
          d="M38 28 C38 18, 52 18, 52 28 C52 36, 45 44, 45 48 C45 44, 38 36, 38 28Z"
          className="text-white"
          fill="currentColor"
          opacity={0.7}
        />
        <circle cx="45" cy="27" r="4" className="text-[#252D6B]" fill="currentColor" opacity={0.6} />
      </g>

      {/* Compass circle */}
      <circle
        cx="82"
        cy="40"
        r="20"
        className="text-[#4A70D9]"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        opacity={0.6}
      />

      {/* Compass tick marks */}
      {[0, 90, 180, 270].map((deg) => (
        <line
          key={deg}
          x1="82"
          y1="22"
          x2="82"
          y2="25"
          className="text-[#4A70D9]"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity={0.7}
          transform={`rotate(${deg} 82 40)`}
        />
      ))}

      {/* Rotating needle */}
      <g
        style={
          reducedMotion
            ? undefined
            : {
                animation: `cp-spin-${safeId} 8s linear infinite`,
                transformOrigin: "82px 40px",
              }
        }
      >
        <line
          x1="82"
          y1="28"
          x2="82"
          y2="40"
          className="text-[#4A70D9]"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity={0.9}
        />
        <line
          x1="82"
          y1="40"
          x2="82"
          y2="52"
          className="text-white"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity={0.4}
        />
      </g>

      {/* Needle center pivot */}
      <circle cx="82" cy="40" r="2.5" className="text-[#4A70D9]" fill="currentColor" opacity={0.9} />

      {!reducedMotion && (
        <style>{`
          @keyframes cp-bob-${safeId} {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-4px); }
          }
          @keyframes cp-spin-${safeId} {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      )}
    </svg>
  );
}
