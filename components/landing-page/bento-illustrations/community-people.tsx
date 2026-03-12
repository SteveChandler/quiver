"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface CommunityPeopleProps {
  className?: string;
}

export function CommunityPeople({ className }: CommunityPeopleProps) {
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
      {/* Center person */}
      <circle cx="60" cy="30" r="8" className="text-[#F78E42]" fill="currentColor" opacity={0.85} />
      <path
        d="M46 58 C46 48, 54 42, 60 42 C66 42, 74 48, 74 58"
        className="text-[#F78E42]"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity={0.7}
      />

      {/* Left person */}
      <g
        style={
          reducedMotion
            ? undefined
            : {
                animation: `cp-sway-${safeId} 3s ease-in-out infinite`,
                transformOrigin: "30px 50px",
              }
        }
      >
        <circle cx="30" cy="34" r="6" className="text-white" fill="currentColor" opacity={0.6} />
        <path
          d="M20 56 C20 49, 25 45, 30 45 C35 45, 40 49, 40 56"
          className="text-white"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity={0.45}
        />
      </g>

      {/* Right person */}
      <g
        style={
          reducedMotion
            ? undefined
            : {
                animation: `cp-sway-${safeId} 3s ease-in-out 1.5s infinite`,
                transformOrigin: "90px 50px",
              }
        }
      >
        <circle cx="90" cy="34" r="6" className="text-white" fill="currentColor" opacity={0.6} />
        <path
          d="M80 56 C80 49, 85 45, 90 45 C95 45, 100 49, 100 56"
          className="text-white"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity={0.45}
        />
      </g>

      {/* Connection lines */}
      <line x1="38" y1="38" x2="50" y2="34" className="text-[#F78E42]" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity={0.35} strokeDasharray="3 3" />
      <line x1="70" y1="34" x2="82" y2="38" className="text-[#F78E42]" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity={0.35} strokeDasharray="3 3" />

      {!reducedMotion && (
        <style>{`
          @keyframes cp-sway-${safeId} {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3px); }
          }
        `}</style>
      )}
    </svg>
  );
}
