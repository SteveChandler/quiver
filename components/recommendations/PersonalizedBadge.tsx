"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sparkles } from "lucide-react";

export interface PersonalizedBadgeProps {
  personalized: boolean;
  breakdown?: {
    base: number;
    onboardingPrefs: number;
    learnedPrefs: number;
    affinity: number;
  };
  affinityData?: {
    sessionCount: number;
    lastSurfed: Date;
  };
  className?: string;
}

/**
 * PersonalizedBadge Component
 *
 * Displays visual indicators when beach recommendations are personalized for the user.
 * Shows:
 * - "✨ Personalized for you" badge with score breakdown tooltip
 * - "🏄 You've surfed here X×" badge when user has beach history
 *
 * Returns null when personalized=false (no badge shown).
 *
 * @example
 * ```tsx
 * <PersonalizedBadge
 *   personalized={true}
 *   breakdown={{ base: 75, onboardingPrefs: 10, learnedPrefs: 5, affinity: 10 }}
 *   affinityData={{ sessionCount: 15, lastSurfed: new Date() }}
 * />
 * ```
 */
export function PersonalizedBadge({
  personalized,
  breakdown,
  affinityData,
  className,
}: PersonalizedBadgeProps) {
  // Early return: Don't show badge if not personalized
  if (!personalized) {
    return null;
  }

  // Helper to format breakdown items (hide zero values)
  const getBreakdownItems = () => {
    if (!breakdown) return [];

    const items = [
      { label: "Base Score", value: breakdown.base },
      { label: "Your Preferences", value: breakdown.onboardingPrefs },
      { label: "Learned Behavior", value: breakdown.learnedPrefs },
      { label: "Beach Affinity", value: breakdown.affinity },
    ];

    // Only show non-zero values
    return items.filter((item) => item.value > 0);
  };

  const breakdownItems = getBreakdownItems();
  const showAffinityBadge =
    affinityData && affinityData.sessionCount > 0;

  return (
    <div className={className} data-testid="personalized-badge-container">
      <div className="flex flex-wrap items-center gap-2">
        {/* Personalized Badge with Tooltip */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                className="gap-1 cursor-help"
                data-testid="personalized-badge"
                aria-label="This recommendation is personalized for you"
              >
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                <span>Personalized for you</span>
              </Badge>
            </TooltipTrigger>
            {breakdownItems.length > 0 && (
              <TooltipContent
                className="max-w-xs"
                data-testid="personalized-tooltip"
              >
                <div className="space-y-1.5">
                  <p className="font-semibold text-xs mb-2">
                    Score Breakdown
                  </p>
                  {breakdownItems.map((item) => (
                    <div
                      key={item.label}
                      className="flex justify-between gap-4 text-xs"
                      data-testid={`breakdown-item-${item.label
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                    >
                      <span className="text-muted-foreground">
                        {item.label}:
                      </span>
                      <span className="font-medium">
                        +{item.value.toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        {/* Affinity Badge (if user has surfed here before) */}
        {showAffinityBadge && (
          <Badge
            variant="outline"
            className="gap-1"
            data-testid="affinity-badge"
            aria-label={`You've surfed here ${affinityData.sessionCount} ${
              affinityData.sessionCount === 1 ? "time" : "times"
            }`}
          >
            <span className="text-base" aria-hidden="true">
              🏄
            </span>
            <span>
              You've surfed here {affinityData.sessionCount}×
            </span>
          </Badge>
        )}
      </div>
    </div>
  );
}
