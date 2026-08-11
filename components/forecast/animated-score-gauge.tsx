"use client";

/**
 * Animated Score Gauge Component
 *
 * Radial progress gauge for displaying surf condition scores.
 * Features animated arc fill, count-up number, and glow effects.
 *
 * Score color thresholds align with MatchQuality from the scoring system:
 *   ≥85  perfect  → green
 *   ≥70  excellent → blue
 *   ≥55  good     → teal/cyan
 *   ≥40  fair     → amber/yellow
 *   ≥30  minimal  → warm gray  (NEW — replaces previous single gray bucket)
 *   <30  skip     → cool gray
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
import type { ConditionCharacter } from "@/lib/scoring/types";

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
  /**
   * Optional condition character to show below the gauge number.
   * Only rendered when size is "lg" or "xl" and showLabel is true.
   */
  character?: ConditionCharacter;
  /** Animation duration in milliseconds (default: 1200) */
  duration?: number;
  /** Whether to enable glow effect on high scores (default: true) */
  enableGlow?: boolean;
  /** Color variant: "default" for light backgrounds, "hero" for dark blue hero cards */
  variant?: "default" | "hero";
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
    showCharacter: false,
  },
  md: {
    size: 64,
    strokeWidth: 5,
    fontSize: "text-lg",
    labelSize: "text-xs",
    showCharacter: false,
  },
  lg: {
    size: 96,
    strokeWidth: 6,
    fontSize: "text-2xl",
    labelSize: "text-sm",
    showCharacter: true,
  },
  xl: {
    size: 128,
    strokeWidth: 8,
    fontSize: "text-4xl",
    labelSize: "text-base",
    showCharacter: true,
  },
} as const;

/**
 * Extended score thresholds that include the new 'minimal' band (30-39).
 *
 * The existing SCORE_THRESHOLDS from score-color-utils uses the five-state
 * condition vocabulary. The gauge uses a finer 6-bucket system
 * that maps directly to MatchQuality values from the scoring engine.
 */
const GAUGE_THRESHOLDS = {
  PERFECT: 85,    // green
  EXCELLENT: 70,  // blue
  GOOD: 55,       // teal/cyan
  FAIR: 40,       // amber/yellow
  MINIMAL: 30,    // warm gray (new)
  // below 30 → skip → cool gray
} as const;

/**
 * Get stroke color based on score, using the fine-grained gauge thresholds.
 */
function getStrokeColor(score: number): string {
  if (score >= GAUGE_THRESHOLDS.PERFECT)   return "#22c55e"; // green-500
  if (score >= GAUGE_THRESHOLDS.EXCELLENT) return "#3b82f6"; // blue-500
  if (score >= GAUGE_THRESHOLDS.GOOD)      return "#14b8a6"; // teal-500
  if (score >= GAUGE_THRESHOLDS.FAIR)      return "#f59e0b"; // amber-500
  if (score >= GAUGE_THRESHOLDS.MINIMAL)   return "#a8a29e"; // warm stone-400
  return "#9ca3af";                                          // cool gray-400
}

/**
 * Get glow color based on score.
 * Only high-quality scores get a glow — sparse accents hit harder.
 */
function getGlowColor(score: number): string {
  if (score >= GAUGE_THRESHOLDS.PERFECT)   return "rgba(34, 197, 94, 0.4)";  // green glow
  if (score >= GAUGE_THRESHOLDS.EXCELLENT) return "rgba(59, 130, 246, 0.3)"; // blue glow
  if (score >= GAUGE_THRESHOLDS.GOOD)      return "rgba(20, 184, 166, 0.25)"; // teal glow
  return "transparent";
}

/**
 * Quality label that maps to MatchQuality names from the scoring engine.
 * Used when showLabel is true and no character is provided.
 */
function getQualityLabel(score: number): string {
  if (score >= GAUGE_THRESHOLDS.PERFECT)   return "Perfect";
  if (score >= GAUGE_THRESHOLDS.EXCELLENT) return "Excellent";
  if (score >= GAUGE_THRESHOLDS.GOOD)      return "Good";
  if (score >= GAUGE_THRESHOLDS.FAIR)      return "Fair";
  if (score >= GAUGE_THRESHOLDS.MINIMAL)   return "Minimal";
  return "Skip";
}

/**
 * Text color class for the quality label, matching the stroke color palette.
 */
function getLabelTextClass(score: number, isHero: boolean): string {
  if (isHero) return "text-white";
  if (score >= GAUGE_THRESHOLDS.PERFECT)   return "text-green-700 dark:text-green-400";
  if (score >= GAUGE_THRESHOLDS.EXCELLENT) return "text-blue-700 dark:text-blue-400";
  if (score >= GAUGE_THRESHOLDS.GOOD)      return "text-teal-600 dark:text-teal-400";
  if (score >= GAUGE_THRESHOLDS.FAIR)      return "text-amber-600 dark:text-amber-400";
  if (score >= GAUGE_THRESHOLDS.MINIMAL)   return "text-stone-500 dark:text-stone-400";
  return "text-gray-500 dark:text-gray-400";
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
 * fill based on quality thresholds. High scores (≥70) feature
 * a subtle glow effect.
 *
 * On lg/xl sizes with showLabel=true, also renders the condition
 * character label below the quality label for richer context.
 *
 * @example Basic usage
 * ```tsx
 * <AnimatedScoreGauge score={85} />
 * ```
 *
 * @example Large gauge with label and character
 * ```tsx
 * <AnimatedScoreGauge
 *   score={52}
 *   size="lg"
 *   showLabel
 *   character={{ label: "Small but powerful — long-period energy", category: "small-quality" }}
 * />
 * ```
 *
 * @example Extra large hero gauge
 * ```tsx
 * <AnimatedScoreGauge score={90} size="xl" showLabel />
 * ```
 */
export function AnimatedScoreGauge({
  score,
  size = "md",
  showLabel = false,
  character,
  duration = 1200,
  enableGlow = true,
  variant = "default",
  className,
}: AnimatedScoreGaugeProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const [arcOffset, setArcOffset] = useState(100);
  const [hasAnimated, setHasAnimated] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const reducedMotion = useReducedMotion();

  const isHero = variant === "hero";
  const config = SIZE_CONFIG[size];
  const radius = (config.size - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeColor = isHero ? "#ffffff" : getStrokeColor(score);
  const glowColor = isHero ? "rgba(255,255,255,0.3)" : getGlowColor(score);
  // Shared condition colors are used for the numeric text; the gauge label remains MatchQuality.
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

  // Show glow only for excellent+ scores to keep accents sparse
  const showGlow = enableGlow && score >= GAUGE_THRESHOLDS.EXCELLENT && hasAnimated;

  // Whether to show character — only on detail-page-sized gauges
  const shouldShowCharacter =
    showLabel && character && config.showCharacter && !isHero;

  const labelTextClass = getLabelTextClass(score, isHero);

  return (
    <div
      ref={elementRef}
      className={cn("flex flex-col items-center gap-2", className)}
    >
      {/* Gauge SVG */}
      <div
        className={cn(
          "relative",
          showGlow && !reducedMotion && "animate-pulse-glow"
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
          aria-hidden="true"
        >
          {/* Background circle */}
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            stroke={isHero ? "rgba(255,255,255,0.25)" : "currentColor"}
            strokeWidth={config.strokeWidth}
            className={isHero ? undefined : "text-gray-200 dark:text-gray-700"}
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
              isHero ? "text-white" : scoreColors.text
            )}
            aria-label={`Score: ${score}`}
          >
            {displayScore}
          </span>
        </div>
      </div>

      {/* Quality label — always shows when showLabel is true */}
      {showLabel && (
        <div className="flex flex-col items-center gap-0.5">
          <span
            className={cn(
              "font-medium",
              config.labelSize,
              labelTextClass,
              !hasAnimated && !reducedMotion && "opacity-0",
              hasAnimated && "motion-safe:animate-fade-in"
            )}
          >
            {getQualityLabel(score)}
          </span>

          {/*
           * Condition character label — lg/xl sizes only, non-hero variant.
           * Uses font-mono for that surf-shop-window sticker look.
           * Fades in after the quality label so it doesn't compete.
           */}
          {shouldShowCharacter && (
            <span
              className={cn(
                "font-mono text-center leading-snug tracking-tight",
                size === "xl" ? "text-sm" : "text-xs",
                labelTextClass,
                "opacity-80", // slightly recede behind the quality label
                !hasAnimated && !reducedMotion && "opacity-0",
                hasAnimated && "motion-safe:animate-fade-in"
              )}
            >
              {character!.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
