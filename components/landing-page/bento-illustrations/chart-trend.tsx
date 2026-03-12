"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface ChartTrendProps {
  className?: string;
}

export function ChartTrend({ className }: ChartTrendProps) {
  const id = useId();
  const safeId = id.replace(/:/g, "");
  const reducedMotion = useReducedMotion();

  const bars = [
    { x: 20, h: 22 },
    { x: 38, h: 32 },
    { x: 56, h: 26 },
    { x: 74, h: 40 },
    { x: 92, h: 36 },
  ];

  const trendPathLength = 200;

  return (
    <svg
      viewBox="0 0 120 80"
      fill="none"
      className={cn("w-full h-full", className)}
      aria-hidden="true"
    >
      <g
        style={
          reducedMotion
            ? undefined
            : {
                animation: `ct-drift-${safeId} 5s ease-in-out infinite`,
              }
        }
      >
        {/* Bars growing from bottom */}
        {bars.map((bar, i) => (
          <rect
            key={i}
            x={bar.x}
            y={80 - bar.h}
            width="10"
            rx="2"
            height={bar.h}
            className="text-blue-400"
            fill="currentColor"
            opacity={0.7}
            style={
              reducedMotion
                ? undefined
                : {
                    animation: `ct-grow-${safeId} 0.6s ease-out ${i * 0.1}s both`,
                    transformOrigin: `${bar.x + 5}px 80px`,
                  }
            }
          />
        ))}

        {/* Trend line */}
        <path
          d="M25 58 L43 48 L61 54 L79 40 L97 44"
          className="text-blue-400"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={0.9}
          strokeDasharray={reducedMotion ? "none" : trendPathLength}
          strokeDashoffset={reducedMotion ? 0 : trendPathLength}
          style={
            reducedMotion
              ? undefined
              : {
                  animation: `ct-draw-${safeId} 1s ease-out 0.5s forwards`,
                }
          }
        />

        {/* Dot on trend line end */}
        <circle
          cx="97"
          cy="44"
          r="4"
          className="text-blue-400"
          fill="currentColor"
          opacity={0.9}
          style={
            reducedMotion
              ? undefined
              : {
                  opacity: 0,
                  animation: `ct-dot-${safeId} 0.3s ease-out 1.4s forwards`,
                }
          }
        />
      </g>

      {!reducedMotion && (
        <style>{`
          @keyframes ct-grow-${safeId} {
            from { transform: scaleY(0); }
            to { transform: scaleY(1); }
          }
          @keyframes ct-draw-${safeId} {
            to { stroke-dashoffset: 0; }
          }
          @keyframes ct-dot-${safeId} {
            to { opacity: 0.9; }
          }
          @keyframes ct-drift-${safeId} {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-2px); }
          }
        `}</style>
      )}
    </svg>
  );
}
