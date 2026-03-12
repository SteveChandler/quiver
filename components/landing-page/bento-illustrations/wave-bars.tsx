"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface WaveBarsProps {
  className?: string;
}

export function WaveBars({ className }: WaveBarsProps) {
  const id = useId();
  const clipId = `wave-bars-clip-${id}`;
  const reducedMotion = useReducedMotion();

  const barHeights = [28, 42, 34, 48, 24];
  const barX = [16, 34, 52, 70, 88];

  return (
    <svg
      viewBox="0 0 120 80"
      fill="none"
      className={cn("w-full h-full", className)}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width="120" height="80" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        {barHeights.map((h, i) => (
          <rect
            key={i}
            x={barX[i]}
            y={80 - h}
            width="10"
            rx="3"
            height={h}
            className="text-ocean-blue"
            fill="currentColor"
            opacity={0.85}
            style={
              reducedMotion
                ? undefined
                : {
                    animation: `wb-bar-${id.replace(/:/g, "")} 3s ease-in-out ${i * 0.2}s infinite`,
                  }
            }
          />
        ))}

        <path
          d="M4 30 Q20 18, 36 28 T68 22 T100 30 T116 24"
          className="text-white/60"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </g>

      {!reducedMotion && (
        <style>{`
          @keyframes wb-bar-${id.replace(/:/g, "")} {
            0%, 100% { transform: scaleY(1); transform-origin: bottom; }
            50% { transform: scaleY(0.6); transform-origin: bottom; }
          }
        `}</style>
      )}
    </svg>
  );
}
