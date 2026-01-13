"use client";

import React from "react";
import { Plus, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";

/**
 * Props for PrimaryActions component
 */
export interface PrimaryActionsProps {
  /** Top surf spot recommendation data (used for context) */
  topRecommendation: SurfDiscoveryRecommendation | null;
  /** Callback when user clicks "I'm at the beach" */
  onAtBeach: () => void;
  /** Callback when user clicks "Plan Weekend" */
  onPlanWeekend: () => void;
  /** Whether buttons should be disabled */
  disabled?: boolean;
}

/**
 * Loading skeleton for PrimaryActions
 */
export function PrimaryActionsSkeleton() {
  return (
    <div
      className="flex flex-col xs:flex-row gap-3 px-4 sm:px-1"
      data-testid="primary-actions-loading"
    >
      <div className="flex-1 h-12 sm:h-14 bg-white/20 rounded-full animate-pulse" />
      <div className="flex-1 h-12 sm:h-14 bg-white/20 rounded-full animate-pulse" />
    </div>
  );
}

/**
 * PrimaryActions displays the two main action buttons below the hero recommendation
 * on the home screen.
 *
 * Features:
 * - "I'm at the beach" - Primary orange button for logging current session
 * - "Plan Weekend" - Secondary outline button for trip planning
 * - Responsive layout with equal-width buttons
 * - Proper touch targets for mobile (min 44px)
 * - Disabled state support
 *
 * @example
 * ```tsx
 * <PrimaryActions
 *   topRecommendation={recommendation}
 *   onAtBeach={() => openSessionLogger()}
 *   onPlanWeekend={() => openWeekendPlanner()}
 * />
 * ```
 */
export const PrimaryActions = React.memo(function PrimaryActions({
  topRecommendation,
  onAtBeach,
  onPlanWeekend,
  disabled = false,
}: PrimaryActionsProps) {
  return (
    <div
      className="flex flex-col xs:flex-row gap-3 px-4 sm:px-1"
      data-testid="primary-actions"
    >
      {/* Primary action: I'm at the beach */}
      <Button
        onClick={onAtBeach}
        disabled={disabled}
        className={cn(
          "flex-1 h-12 sm:h-14 min-h-[44px] rounded-full",
          "bg-orange-500 hover:bg-orange-600 active:bg-orange-700",
          "text-white font-semibold text-sm sm:text-base",
          "shadow-sm hover:shadow-md",
          "transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-orange-500 disabled:hover:shadow-sm"
        )}
        aria-label="Log that you are at the beach"
        data-testid="at-beach-button"
      >
        <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-1.5 shrink-0" />
        <span className="truncate">I&apos;m at the beach</span>
      </Button>

      {/* Secondary action: Plan Weekend */}
      <Button
        onClick={onPlanWeekend}
        disabled={disabled}
        variant="outline"
        className={cn(
          "flex-1 h-12 sm:h-14 min-h-[44px] rounded-full",
          "bg-white/10 hover:bg-white/20 active:bg-white/30",
          "text-white font-semibold text-sm sm:text-base",
          "border border-white/20 hover:border-white/30",
          "shadow-sm hover:shadow-md",
          "transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-header-end",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/10 disabled:hover:shadow-sm"
        )}
        aria-label="Plan your weekend surf trip"
        data-testid="plan-weekend-button"
      >
        <Calendar className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-1.5 shrink-0" />
        <span className="truncate">Plan Weekend</span>
      </Button>
    </div>
  );
});

export default PrimaryActions;
