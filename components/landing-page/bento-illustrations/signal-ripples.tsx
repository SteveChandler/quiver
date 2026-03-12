"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface SignalRipplesProps {
  className?: string;
}

export function SignalRipples({ className }: SignalRipplesProps) {
  const id = useId();
  const safeId = id.replace(/:/g, "");
  const reducedMotion = useReducedMotion();

  const rings = [
    { delay: 0, maxR: 18 },
    { delay: 0.6, maxR: 26 },
    { delay: 1.2, maxR: 34 },
  ];

  return (
    <svg
      viewBox="0 0 120 80"
      fill="none"
      className={cn("w-full h-full", className)}
      aria-hidden="true"
    >
      {/* Ripple rings */}
      {rings.map((ring, i) => (
        <circle
          key={i}
          cx="60"
          cy="40"
          r={reducedMotion ? ring.maxR * 0.7 : 6}
          className="text-green-400"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          opacity={0.7}
          style={
            reducedMotion
              ? { opacity: 0.5 - i * 0.12 }
              : {
                  animation: `sr-ripple-${safeId} 2.5s ease-out ${ring.delay}s infinite`,
                }
          }
        />
      ))}

      {/* Center dot */}
      <circle
        cx="60"
        cy="40"
        r="5"
        className="text-green-400"
        fill="currentColor"
        opacity={0.9}
      />

      {!reducedMotion && (
        <style>{`
          @keyframes sr-ripple-${safeId} {
            0% {
              r: 6;
              opacity: 0.8;
            }
            100% {
              r: 34;
              opacity: 0;
            }
          }
        `}</style>
      )}
    </svg>
  );
}
