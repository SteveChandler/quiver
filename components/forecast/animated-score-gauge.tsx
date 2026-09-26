"use client";

/**
 * Animated Score Gauge Component
 *
 * Radial progress gauge for displaying surf condition scores.
 * Server-renders the finished score and arc; a CSS keyframe animates the
 * arc filling in when motion is allowed. Glow effects for EPIC scores.
 *
 * Score colors and labels come from the canonical score-color utility so this
 * shared component cannot drift from the rest of the forecast surfaces.
 *
 * @module components/forecast/animated-score-gauge
 */

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { getScoreColorClasses } from "@/lib/utils/score-color-utils";
import type { ConditionCharacter } from "@/lib/scoring/types";
import { getScoreCall } from "./score-band-call";

/**
 * Props for the AnimatedScoreGauge component
 */
interface AnimatedScoreGaugeProps {
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
  const isHero = variant === "hero";
  const config = SIZE_CONFIG[size];
  const radius = (config.size - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const scoreCall = getScoreCall(score);
  const scoreColors = getScoreColorClasses(score);
  const labelTextClass = isHero ? "text-white" : scoreColors.text;

  // Calculate target offset (0 = full, circumference = empty)
  const targetOffset = circumference * (1 - score / 100);

  // Keep the accent sparse while still deriving the band from the canonical utility.
  const showGlow = enableGlow && scoreCall.label === "EPIC";

  // Whether to show character — only on detail-page-sized gauges
  const shouldShowCharacter =
    showLabel && character && config.showCharacter && !isHero;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {/* Gauge SVG */}
      <div
        className={cn(
          "relative",
          showGlow && "motion-safe:animate-pulse-glow"
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
            strokeDashoffset={targetOffset}
            // The arc renders finished on the server; the keyframe only
            // animates it in from empty when motion is allowed.
            style={{ "--gauge-empty": circumference, animationDuration: `${duration}ms` } as CSSProperties}
            className={cn(
              "transition-colors duration-300 motion-safe:animate-gauge-fill",
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
            {score}
          </span>
        </div>
      </div>

      {/* Quality label — always shows when showLabel is true */}
      {showLabel && (
        <div className="flex flex-col items-center gap-0.5">
          <span
            className={cn("font-medium", config.labelSize, labelTextClass)}
          >
            {scoreCall.label}
          </span>
          {showAction && (
            <span
              className={cn("font-medium", config.labelSize, labelTextClass)}
            >
              {scoreCall.action}
            </span>
          )}

          {/*
           * Condition character label — lg/xl sizes only, non-hero variant.
           * Uses font-mono for that surf-shop-window sticker look.
           */}
          {shouldShowCharacter && (
            <span
              className={cn(
                "font-mono text-center leading-snug tracking-tight",
                size === "xl" ? "text-sm" : "text-xs",
                labelTextClass,
                "opacity-80" // slightly recede behind the quality label
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
