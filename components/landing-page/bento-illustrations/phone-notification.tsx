"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface PhoneNotificationProps {
  className?: string;
}

export function PhoneNotification({ className }: PhoneNotificationProps) {
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
      {/* Phone body — floats */}
      <g
        style={
          reducedMotion
            ? undefined
            : {
                animation: `pn-float-${safeId} 3s ease-in-out infinite`,
              }
        }
      >
        {/* Phone outline */}
        <rect
          x="42"
          y="12"
          width="36"
          height="56"
          rx="6"
          className="text-teal-400"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          opacity={0.7}
        />

        {/* Screen area */}
        <rect
          x="46"
          y="20"
          width="28"
          height="38"
          rx="2"
          className="text-teal-400"
          fill="currentColor"
          opacity={0.15}
        />

        {/* Home indicator */}
        <line
          x1="54"
          y1="63"
          x2="66"
          y2="63"
          className="text-teal-400"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity={0.5}
        />

        {/* Screen content lines */}
        <rect x="50" y="26" width="20" height="2" rx="1" className="text-teal-400" fill="currentColor" opacity={0.4} />
        <rect x="50" y="32" width="14" height="2" rx="1" className="text-teal-400" fill="currentColor" opacity={0.3} />
        <rect x="50" y="38" width="18" height="2" rx="1" className="text-teal-400" fill="currentColor" opacity={0.3} />
      </g>

      {/* Notification dot — pulses independently */}
      <circle
        cx="76"
        cy="14"
        r="5"
        className="text-teal-400"
        fill="currentColor"
        opacity={0.8}
        style={
          reducedMotion
            ? undefined
            : {
                animation: `pn-pulse-${safeId} 1.5s ease-in-out infinite`,
                transformOrigin: "76px 14px",
              }
        }
      />

      {/* Inner dot for contrast */}
      <circle
        cx="76"
        cy="14"
        r="2"
        className="text-teal-300"
        fill="currentColor"
        style={
          reducedMotion
            ? undefined
            : {
                animation: `pn-pulse-${safeId} 1.5s ease-in-out infinite`,
                transformOrigin: "76px 14px",
              }
        }
      />

      {!reducedMotion && (
        <style>{`
          @keyframes pn-float-${safeId} {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-6px); }
          }
          @keyframes pn-pulse-${safeId} {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.3); opacity: 0.5; }
          }
        `}</style>
      )}
    </svg>
  );
}
