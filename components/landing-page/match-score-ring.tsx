"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { getScoreColorClasses } from "@/lib/utils/score-color-utils";

const EASE_OUT_QUART: [number, number, number, number] = [0.25, 1, 0.5, 1];
const RING_DRAW_DURATION_MS = 1200;
const RING_DRAW_DELAY_MS = 200;

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

  const targetOffset = circumference * (1 - clampedScore / 100);

  const { label } = getScoreColorClasses(clampedScore);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(wrapperRef, { once: true, amount: 0.25 });
  const shouldReduceMotion = useReducedMotion() ?? false;

  const [displayScore, setDisplayScore] = useState(
    shouldReduceMotion || !animated ? clampedScore : 0
  );

  useEffect(() => {
    if (!animated || shouldReduceMotion || !isInView) return;

    const totalDuration = RING_DRAW_DURATION_MS + RING_DRAW_DELAY_MS;
    const startTime = performance.now() + RING_DRAW_DELAY_MS;

    let frameId: number;

    function tick(now: number) {
      const elapsed = Math.max(0, now - startTime);
      const progress = Math.min(elapsed / totalDuration, 1);

      // Apply ease-out-quart: 1 - (1 - t)^4
      const t = 1 - progress;
      const eased = 1 - t * t * t * t;

      setDisplayScore(Math.round(eased * clampedScore));

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        setDisplayScore(clampedScore);
      }
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [animated, shouldReduceMotion, isInView, clampedScore]);

  const shouldAnimate = animated && !shouldReduceMotion && isInView;

  return (
    <div
      ref={wrapperRef}
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
        {shouldAnimate ? (
          <motion.circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#FF6B2B"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: targetOffset }}
            transition={{
              duration: RING_DRAW_DURATION_MS / 1000,
              ease: EASE_OUT_QUART,
              delay: RING_DRAW_DELAY_MS / 1000,
            }}
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
          {displayScore}
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
