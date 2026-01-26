"use client";

import React, { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface BoardRecommendationBadgeProps {
  /** The name of the recommended board */
  boardName: string;
  /** Optional board type for additional context */
  boardType?: string;
  /** Size variant for the badge */
  size?: "sm" | "md" | "lg";
  /** Additional CSS classes */
  className?: string;
}

/**
 * BoardRecommendationBadge Component
 *
 * Displays a simple inline badge recommending a specific board
 * based on current conditions.
 *
 * Format: "🏄 Bring your {boardName}"
 * Styling: Light amber background, rounded pill, small text
 *
 * @example
 * ```tsx
 * <BoardRecommendationBadge boardName="Fish" />
 * // Renders: 🏄 Bring your Fish
 * ```
 */
function BoardRecommendationBadgeComponent({
  boardName,
  boardType,
  size = "md",
  className,
}: BoardRecommendationBadgeProps) {
  // Size classes for different badge sizes
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 gap-1",
    md: "text-sm px-3 py-1 gap-1.5",
    lg: "text-base px-4 py-1.5 gap-2",
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        // Base styles - amber theme for board recommendations
        "bg-amber-50 text-amber-800 border-amber-200",
        "hover:bg-amber-100 transition-colors",
        "font-medium rounded-full",
        // Size-specific styles
        sizeClasses[size],
        className
      )}
      data-testid="board-recommendation-badge"
      role="status"
      aria-label={`Board recommendation: Bring your ${boardName}`}
    >
      <span aria-hidden="true">🏄</span>
      <span>Bring your {boardName}</span>
    </Badge>
  );
}

/**
 * Custom comparison function for memoization
 */
const areBoardRecommendationBadgePropsEqual = (
  prev: BoardRecommendationBadgeProps,
  next: BoardRecommendationBadgeProps
): boolean => {
  return (
    prev.boardName === next.boardName &&
    prev.boardType === next.boardType &&
    prev.size === next.size &&
    prev.className === next.className
  );
};

/**
 * Memoized version to prevent unnecessary re-renders
 */
export const BoardRecommendationBadge = memo(
  BoardRecommendationBadgeComponent,
  areBoardRecommendationBadgePropsEqual
);

BoardRecommendationBadge.displayName = "BoardRecommendationBadge";
