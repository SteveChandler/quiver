"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { getScoreColorClasses } from "@/lib/utils/score-color-utils";

interface MatchScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  animated?: boolean;
  className?: string;
}

export function MatchScoreRing({
  score,
  size = 96,
  strokeWidth = 6,
  animated = true,
  className,
}: MatchScoreRingProps) {
  const id = useId();
  const filterId = `glow-ring-${id}`;
  const clampedScore = Math.max(0, Math.min(100, score));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // dashoffset: full circumference = 0%, zero dashoffset = 100%
  const targetOffset = circumference * (1 - clampedScore / 100);

  const { label } = getScoreColorClasses(clampedScore);

  return (
    <div
      className={`relative inline-flex flex-col items-center justify-center${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        aria-label={`Match score: ${clampedScore} — ${label}`}
      >
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="#1A1F3A"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Glow filter */}
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Score arc */}
        {animated ? (
          <motion.circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#FF6B2B"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            // Start from full offset (0%) and animate to score position
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: targetOffset }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
            style={{
              transformOrigin: `${center}px ${center}px`,
              rotate: "-90deg",
              filter: `url(#${filterId})`,
            }}
          />
        ) : (
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#FF6B2B"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={targetOffset}
            style={{
              transformOrigin: `${center}px ${center}px`,
              transform: "rotate(-90deg)",
              filter: `url(#${filterId})`,
            }}
          />
        )}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-mono font-bold text-glow-orange text-white leading-none"
          style={{ fontSize: size * 0.22 }}
        >
          {clampedScore}
        </span>
        <span
          className="font-mono uppercase tracking-wider text-white/60 leading-none mt-0.5"
          style={{ fontSize: size * 0.1 }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
