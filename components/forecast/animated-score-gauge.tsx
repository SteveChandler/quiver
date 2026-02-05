"use client";

/**
 * Animated Score Gauge Component
 *
 * Radial progress gauge for displaying surf condition scores.
 * Features animated arc fill, count-up number, and glow effects.
 *
 * @module components/forecast/animated-score-gauge
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";
import {
  getScoreColorClasses,
  SCORE_THRESHOLDS,
} from "@/lib/utils/score-color-utils";

/**
 * Props for the AnimatedScoreGauge component
 */
export interface AnimatedScoreGaugeProps {
  /** Score value from 0-100 */
  score: number;
  /** Size variant */
  size?: "sm" | "md" | "lg" | "xl";
  /** Whether to show the quality label below the gauge */
  showLabel?: boolean;
  /** Animation duration in milliseconds (default: 1200) */
  duration?: number;
  /** Whether to enable glow effect on high scores (default: true) */
  enableGlow?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Size configurations
 */
const SIZE_CONFIG = {
  sm: {
    size: 48,
    strokeWidth: 4,
    fontSize: "text-sm",
    labelSize: "text-xs",
  },
  md: {
    size: 64,
    strokeWidth: 5,
    fontSize: "text-lg",
    labelSize: "text-xs",
  },
  lg: {
    size: 96,
    strokeWidth: 6,
    fontSize: "text-2xl",
    labelSize: "text-sm",
  },
  xl: {
    size: 128,
    strokeWidth: 8,
    fontSize: "text-4xl",
    labelSize: "text-base",
  },
} as const;

/**
 * Get stroke color based on score
 */
function getStrokeColor(score: number): string {
  if (score >= SCORE_THRESHOLDS.EPIC) return "#22c55e"; // green-500
  if (score >= SCORE_THRESHOLDS.GOOD) return "#3b82f6"; // blue-500
  if (score >= SCORE_THRESHOLDS.FAIR) return "#eab308"; // yellow-500
  return "#9ca3af"; // gray-400
}

/**
 * Get glow color based on score
 */
function getGlowColor(score: number): string {
  if (score >= SCORE_THRESHOLDS.EPIC) return "rgba(34, 197, 94, 0.4)";
  if (score >= SCORE_THRESHOLDS.GOOD) return "rgba(59, 130, 246, 0.3)";
  return "transparent";
}

/**
 * Easing function for smooth animation
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * AnimatedScoreGauge Component
 *
 * Displays a score as an animated radial gauge with color-coded
 * fill based on quality thresholds. High scores (80+) feature
 * a subtle glow effect.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <AnimatedScoreGauge score={85} />
 *
 * // Large gauge with label
 * <AnimatedScoreGauge score={72} size="lg" showLabel />
 *
 * // Extra large hero gauge
 * <AnimatedScoreGauge score={90} size="xl" showLabel />
 * ```
 */
export function AnimatedScoreGauge({
  score,
  size = "md",
  showLabel = false,
  duration = 1200,
  enableGlow = true,
  className,
}: AnimatedScoreGaugeProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const [arcOffset, setArcOffset] = useState(100);
  const [hasAnimated, setHasAnimated] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const reducedMotion = useReducedMotion();

  const config = SIZE_CONFIG[size];
  const radius = (config.size - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeColor = getStrokeColor(score);
  const glowColor = getGlowColor(score);
  const scoreColors = getScoreColorClasses(score);

  // Calculate target offset (0 = full, circumference = empty)
  const targetOffset = circumference * (1 - score / 100);

  // Animation function
  const animate = useCallback(() => {
    if (reducedMotion) {
      setDisplayScore(score);
      setArcOffset(targetOffset);
      setHasAnimated(true);
      return;
    }

    const startTime = performance.now();

    const updateAnimation = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);

      // Animate score number
      setDisplayScore(Math.round(score * easedProgress));

      // Animate arc offset (from full empty to target)
      const currentOffset =
        circumference - (circumference - targetOffset) * easedProgress;
      setArcOffset(currentOffset);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(updateAnimation);
      } else {
        setDisplayScore(score);
        setArcOffset(targetOffset);
        setHasAnimated(true);
      }
    };

    animationRef.current = requestAnimationFrame(updateAnimation);
  }, [score, duration, targetOffset, circumference, reducedMotion]);

  // Intersection observer for scroll-triggered animation
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            animate();
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate, hasAnimated]);

  // Should show glow effect
  const showGlow = enableGlow && score >= SCORE_THRESHOLDS.GOOD && hasAnimated;

  return (
    <div
      ref={elementRef}
      className={cn("flex flex-col items-center gap-2", className)}
    >
      {/* Gauge SVG */}
      <div
        className={cn(
          "relative",
          showGlow && "animate-pulse-glow"
        )}
        style={{
          width: config.size,
          height: config.size,
          filter: showGlow ? `drop-shadow(0 0 10px ${glowColor})` : undefined,
        }}
      >
        <svg
          width={config.size}
          height={config.size}
          viewBox={`0 0 ${config.size} ${config.size}`}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            className="text-gray-200 dark:text-gray-700"
          />

          {/* Animated progress arc */}
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={arcOffset}
            className="transition-colors duration-300"
          />
        </svg>

        {/* Score number overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "font-bold tabular-nums",
              config.fontSize,
              scoreColors.text
            )}
          >
            {displayScore}
          </span>
        </div>
      </div>

      {/* Quality label */}
      {showLabel && (
        <span
          className={cn(
            "font-medium",
            config.labelSize,
            scoreColors.text,
            !hasAnimated && !reducedMotion && "opacity-0",
            hasAnimated && "animate-fade-in"
          )}
        >
          {scoreColors.label}
        </span>
      )}
    </div>
  );
}
