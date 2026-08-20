"use client";

/**
 * Animated Score Gauge Component
 *
 * Radial progress gauge for displaying surf condition scores.
 * Features animated arc fill, count-up number, and glow effects.
 *
 * Score colors and labels come from the canonical score-color utility so this
 * shared component cannot drift from the rest of the forecast surfaces.
 *
 * @module components/forecast/animated-score-gauge
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";
import { getScoreColorClasses } from "@/lib/utils/score-color-utils";
import type { ConditionCharacter } from "@/lib/scoring/types";
import { getScoreCall } from "./score-band-call";

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
   * Whether to show the immediate-action phrase ("Go now!" etc.) under the
   * quality label. Must be false for future-day/ranking contexts, where
   * immediate-action copy is wrong (#569).
   */
  showAction?: boolean;
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
 * Easing function for smooth animation
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * AnimatedScoreGauge Component
 *
 * Displays a score as an animated radial gauge with color-coded
 * fill based on the canonical score bands. EPIC scores can feature
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
  showAction = true,
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
  const scoreCall = getScoreCall(score);
  const scoreColors = getScoreColorClasses(score);
  const labelTextClass = isHero ? "text-white" : scoreColors.text;

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

  // Keep the accent sparse while still deriving the band from the canonical utility.
  const showGlow = enableGlow && scoreCall.label === "EPIC" && hasAnimated;

  // Whether to show character — only on detail-page-sized gauges
  const shouldShowCharacter =
    showLabel && character && config.showCharacter && !isHero;

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
          filter: showGlow
            ? "drop-shadow(0 0 10px rgba(17,16,13,0.18))"
            : undefined,
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
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={arcOffset}
            className={cn(
              "transition-colors duration-300",
              isHero ? "text-white" : scoreColors.text
            )}
          />
        </svg>

        {/* Score number overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "font-bold tabular-nums",
              config.fontSize,
              labelTextClass
            )}
            aria-label={
              showAction
                ? `Score: ${score}, ${scoreCall.label}. ${scoreCall.action}`
                : `Score: ${score}, ${scoreCall.label}`
            }
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
            {scoreCall.label}
          </span>
          {showAction && (
            <span
              className={cn(
                "font-medium",
                config.labelSize,
                labelTextClass,
                !hasAnimated && !reducedMotion && "opacity-0",
                hasAnimated && "motion-safe:animate-fade-in"
              )}
            >
              {scoreCall.action}
            </span>
          )}

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
