"use client";

/**
 * Score Badge Component
 *
 * Shared component for displaying condition scores with color-coded styling.
 * Used by BestDaysSection, BeachConditionsGrid, and other forecast components.
 *
 * @module components/forecast/score-badge
 */

import { cn } from "@/lib/utils";
import { getScoreColorClasses } from "@/lib/utils/score-color-utils";

/**
 * Props for the ScoreBadge component
 */
export interface ScoreBadgeProps {
  /** Score value from 0-100 */
  score: number;
  /** Badge size variant */
  size?: "sm" | "md" | "lg";
  /** Whether to show the quality label below the score */
  showLabel?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Size configuration for badge variants
 */
const SIZE_STYLES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-xl",
} as const;

/**
 * ScoreBadge Component
 *
 * Displays a numeric score in a color-coded circular badge.
 * Colors are determined by score thresholds:
 * - 80-100: Green (Epic)
 * - 60-79: Blue (Good)
 * - 40-59: Yellow (Fair)
 * - 0-39: Gray (Poor)
 *
 * @example
 * ```tsx
 * // Basic usage
 * <ScoreBadge score={85} />
 *
 * // Large badge with label
 * <ScoreBadge score={85} size="lg" showLabel />
 *
 * // Small badge for compact displays
 * <ScoreBadge score={45} size="sm" />
 * ```
 */
export function ScoreBadge({
  score,
  size = "md",
  showLabel = false,
  className,
}: ScoreBadgeProps) {
  const colors = getScoreColorClasses(score);

  if (showLabel) {
    return (
      <div className={cn("flex flex-col items-center gap-2", className)}>
        <div
          className={cn(
            "flex items-center justify-center rounded-full font-bold text-white",
            colors.bg,
            SIZE_STYLES[size]
          )}
        >
          {score}
        </div>
        <span className={cn("text-sm font-medium", colors.text)}>
          {colors.label}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-bold text-white",
        colors.bg,
        SIZE_STYLES[size],
        className
      )}
    >
      {score}
    </div>
  );
}
