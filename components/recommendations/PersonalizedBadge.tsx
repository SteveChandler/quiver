"use client";

import React, { memo, useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type {
  ConditionCharacter,
  ConditionCharacterCategory,
} from "@/lib/scoring/types";

export interface PersonalizedBadgeProps {
  /** Whether the recommendation is personalized */
  personalized: boolean;

  /** Breakdown of score components */
  breakdown?: {
    base: number;
    onboardingPrefs: number;
    learnedPrefs: number;
    affinity: number;
    multiplier: number;
  };

  /** User's affinity data for this beach */
  affinityData?: {
    sessionCount: number;
    lastSurfed: Date;
  };

  /** Total personalization score (0-100) - REQUIRED for score display */
  score?: number;

  /** Display mode for the badge */
  displayMode?: "compact" | "score" | "detailed";

  /** Size variant */
  size?: "sm" | "md" | "lg";

  /** Show improvement delta ("+13 for you") */
  showDelta?: boolean;

  /** Base score before personalization (for delta calculation) */
  baseScore?: number;

  /**
   * Condition character from the scoring system.
   * When provided, shows the qualitative character label below the score.
   */
  character?: ConditionCharacter;

  /** Additional CSS classes */
  className?: string;
}

// ------------------------------------------------------------------
// Character category helpers
// ------------------------------------------------------------------

/**
 * Abbreviated one or two-word label for compact mode.
 * Keeps it terse — these show on beach cards where space is tight.
 */
function getCompactCharacterLabel(
  category: ConditionCharacterCategory
): string {
  switch (category) {
    case "flat":
      return "Flat";
    case "small-weak":
      return "Weak";
    case "small-quality":
      return "Powerful";
    case "small-clean":
      return "Clean";
    case "medium-clean":
      return "Dialed";
    case "medium-mixed":
      return "Mixed";
    case "large-clean":
      return "Firing";
    case "large-rough":
      return "Rough";
    case "skip":
      return "Skip";
    default:
      return "";
  }
}

/**
 * Border / accent color classes derived from condition character category.
 * These are subtle — they accent, not overwhelm.
 * Colors are inline Tailwind classes that exist in the design system.
 */
function getCharacterAccentClasses(category: ConditionCharacterCategory): {
  border: string;
  labelColor: string;
} {
  switch (category) {
    case "small-quality":
      // Long-period small wave — warm amber, Charming Orange family
      return {
        border: "border-amber-400/60",
        labelColor: "text-amber-600 dark:text-amber-400",
      };
    case "small-clean":
      // Clean small day — softer golden
      return {
        border: "border-yellow-400/50",
        labelColor: "text-yellow-600 dark:text-yellow-400",
      };
    case "medium-clean":
      // Primary blue — solid conditions
      return {
        border: "border-blue-500/60",
        labelColor: "text-blue-600 dark:text-blue-400",
      };
    case "medium-mixed":
      // Muted blue
      return {
        border: "border-blue-400/40",
        labelColor: "text-blue-500 dark:text-blue-400",
      };
    case "large-clean":
      // Primary blue with a hint of glow in the label
      return {
        border: "border-blue-500/70",
        labelColor: "text-blue-700 dark:text-blue-300",
      };
    case "large-rough":
      // Orange warning — still surfable but rowdy
      return {
        border: "border-orange-400/60",
        labelColor: "text-orange-600 dark:text-orange-400",
      };
    case "flat":
    case "small-weak":
      // Muted — don't draw the eye here
      return {
        border: "border-gray-300/50 dark:border-gray-600/50",
        labelColor: "text-gray-500 dark:text-gray-400",
      };
    case "skip":
    default:
      // Outline only, desaturated
      return {
        border: "border-gray-300/40 dark:border-gray-700/40",
        labelColor: "text-gray-400 dark:text-gray-500",
      };
  }
}

/**
 * PersonalizedBadge Component
 *
 * Displays visual indicators when beach recommendations are personalized for the user.
 * Enhanced version with:
 * - Numeric score display with color coding
 * - Condition character label (sticker-style, inline with the score)
 * - Mobile-responsive interactions (tooltip on desktop, collapsible on mobile)
 * - Multiple display modes and size variants
 * - Optional delta indicator showing improvement over base score
 * - Full accessibility support
 *
 * @example Score mode with character
 * ```tsx
 * <PersonalizedBadge
 *   personalized={true}
 *   score={52}
 *   character={{ label: "Small but powerful — long-period energy", category: "small-quality" }}
 *   breakdown={{ base: 48, onboardingPrefs: 4, learnedPrefs: 0, affinity: 0, multiplier: 1 }}
 * />
 * ```
 *
 * @example Compact mode
 * ```tsx
 * <PersonalizedBadge
 *   personalized={true}
 *   displayMode="compact"
 *   character={{ label: "Small but powerful — long-period energy", category: "small-quality" }}
 * />
 * ```
 */
function PersonalizedBadgeComponent({
  personalized,
  score,
  breakdown,
  affinityData,
  displayMode = "score",
  size = "md",
  showDelta = false,
  baseScore,
  character,
  className,
}: PersonalizedBadgeProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);

  // Early return: Don't show badge if not personalized
  if (!personalized) {
    return null;
  }

  /**
   * Determine badge variant based on score ranges
   * Score >= 85: Primary brand blue with subtle glow
   * Score 70-84: Ocean blue variant
   * Score 50-69: Secondary/muted
   * Score < 50: Outline only
   */
  const getScoreVariant = (s?: number) => {
    if (!s) return "secondary";
    if (s >= 85) return "default"; // Primary variant
    if (s >= 70) return "blue";
    if (s >= 50) return "secondary";
    return "outline";
  };

  const variant = getScoreVariant(score);

  // Size classes for different badge sizes
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 gap-1",
    md: "text-sm px-3 py-1 gap-1.5",
    lg: "text-base px-4 py-1.5 gap-2",
  };

  // Icon sizes corresponding to badge sizes
  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  // Character label font sizes
  const characterLabelSizes = {
    sm: "text-xs",
    md: "text-xs",
    lg: "text-sm",
  };

  // Helper to format breakdown items (hide zero values)
  const getBreakdownItems = () => {
    if (!breakdown) return [];

    const items = [
      { label: "Base Score", value: breakdown.base, key: "base" },
      {
        label: "Your Preferences",
        value: breakdown.onboardingPrefs,
        key: "onboarding",
      },
      {
        label: "Learned Behavior",
        value: breakdown.learnedPrefs,
        key: "learned",
      },
      { label: "Beach Affinity", value: breakdown.affinity, key: "affinity" },
    ];

    // Only show non-zero values
    return items.filter((item) => item.value > 0);
  };

  const breakdownItems = getBreakdownItems();
  const showAffinityBadge = affinityData && affinityData.sessionCount > 0;

  // Calculate delta if requested
  const delta =
    showDelta && score !== undefined && baseScore !== undefined
      ? score - baseScore
      : null;

  // Character accent classes for border/label coloring
  const characterAccent = character
    ? getCharacterAccentClasses(character.category)
    : null;

  // Construct badge text based on display mode
  const getBadgeText = () => {
    if (displayMode === "compact") {
      return "Personalized";
    }

    if (score !== undefined) {
      return `${Math.round(score)}% Match`;
    }

    return "Personalized for you";
  };

  const badgeText = getBadgeText();

  // Accessibility: Screen reader text for score breakdown
  const getAriaLabel = () => {
    const base =
      score !== undefined
        ? `${Math.round(score)}% personalization match`
        : "This recommendation is personalized for you";

    if (character) {
      return `${base}. Condition character: ${character.label}`;
    }
    return base;
  };

  const getBreakdownAriaDescription = () => {
    if (!breakdown) return "";

    const parts = [
      breakdown.base > 0 ? `Base score: ${breakdown.base}` : null,
      breakdown.onboardingPrefs > 0
        ? `Your preferences: ${breakdown.onboardingPrefs}`
        : null,
      breakdown.learnedPrefs > 0
        ? `Learned behavior: ${breakdown.learnedPrefs}`
        : null,
      breakdown.affinity > 0 ? `Beach affinity: ${breakdown.affinity}` : null,
    ].filter(Boolean);

    return parts.join(", ");
  };

  /**
   * Render the breakdown content (shared between tooltip and collapsible)
   */
  const BreakdownContent = () => (
    <div className="space-y-1.5">
      <p className="font-semibold text-xs mb-2">Score Breakdown</p>
      {breakdownItems.map((item) => (
        <div
          key={item.key}
          className="flex justify-between gap-4 text-xs"
          data-testid={`breakdown-item-${item.key}`}
        >
          <span className="text-muted-foreground">{item.label}:</span>
          <span className="font-medium">+{item.value.toFixed(0)}</span>
        </div>
      ))}
      {delta !== null && delta > 0 && (
        <div className="pt-2 mt-2 border-t border-border">
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-muted-foreground">Improvement:</span>
            <span className="font-medium text-primary">+{delta.toFixed(0)}</span>
          </div>
        </div>
      )}
    </div>
  );

  /**
   * Render compact mode (just icon + text, no score)
   * When a character is provided, show the abbreviated keyword below.
   */
  if (displayMode === "compact") {
    return (
      <div className={className} data-testid="personalized-badge-container">
        <div className="flex flex-col items-start gap-0.5">
          <Badge
            variant={variant}
            className={cn(
              sizeClasses[size],
              characterAccent && `border ${characterAccent.border}`,
              className
            )}
            data-testid="personalized-badge"
            role="status"
            aria-label={getAriaLabel()}
          >
            <Sparkles className={iconSizes[size]} aria-hidden="true" />
            <span>{badgeText}</span>
          </Badge>
          {character && (
            <span
              className={cn(
                "font-mono leading-tight tracking-tight",
                characterLabelSizes[size],
                characterAccent?.labelColor ?? "text-muted-foreground"
              )}
              aria-hidden="true"
            >
              {getCompactCharacterLabel(character.category)}
            </span>
          )}
        </div>
      </div>
    );
  }

  /**
   * Render score mode with mobile-responsive interactions
   * Desktop: Tooltip
   * Mobile: Collapsible
   *
   * Character label renders below the badge as a sticker-style tag line.
   * It uses Space Mono (font-mono) for that technical-but-surf-culture feel.
   */
  const ScoreBadge = () => {
    // Add glow effect for high scores (>= 85)
    const glowClass =
      score !== undefined && score >= 85
        ? "shadow-sm shadow-primary/50"
        : "";

    return (
      <Badge
        variant={variant}
        className={cn(
          sizeClasses[size],
          glowClass,
          characterAccent && `border ${characterAccent.border}`,
          isMobile && breakdownItems.length > 0 && "cursor-pointer",
          !isMobile && breakdownItems.length > 0 && "cursor-help",
          className
        )}
        data-testid="personalized-badge"
        role="status"
        aria-label={getAriaLabel()}
        aria-describedby={
          breakdownItems.length > 0 ? "match-breakdown" : undefined
        }
      >
        <Sparkles className={iconSizes[size]} aria-hidden="true" />
        <span>{badgeText}</span>
        {delta !== null && delta > 0 && !isMobile && (
          <span className="text-xs opacity-75 ml-1">
            +{delta.toFixed(0)} for you
          </span>
        )}
        {isMobile && breakdownItems.length > 0 && (
          <ChevronDown
            className={cn(
              "h-3 w-3 ml-0.5 motion-safe:transition-transform",
              isOpen && "rotate-180"
            )}
            aria-hidden="true"
          />
        )}
        {/* Screen reader only breakdown */}
        {breakdownItems.length > 0 && (
          <div id="match-breakdown" className="sr-only">
            {getBreakdownAriaDescription()}
          </div>
        )}
      </Badge>
    );
  };

  /**
   * Character label renders beneath the badge in score/detailed mode.
   * Sticker aesthetic: Space Mono font, slight informal vibe.
   * The detailed displayMode shows the full label; score mode shows it too
   * (both are non-compact).
   */
  const CharacterLabel = () => {
    if (!character) return null;

    const fullLabel =
      displayMode === "detailed"
        ? character.label
        : // In score mode, show full label — it's concise enough already
          character.label;

    return (
      <p
        className={cn(
          "font-mono leading-snug tracking-tight mt-0.5",
          characterLabelSizes[size],
          characterAccent?.labelColor ?? "text-muted-foreground"
        )}
        aria-hidden="true"
      >
        {fullLabel}
      </p>
    );
  };

  return (
    <div className={className} data-testid="personalized-badge-container">
      <div className="flex flex-wrap items-start gap-2">
        {/* Mobile: Collapsible */}
        {isMobile && breakdownItems.length > 0 ? (
          <div className="flex flex-col items-start">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
              <CollapsibleTrigger asChild>
                <div>{ScoreBadge()}</div>
              </CollapsibleTrigger>
              <CharacterLabel />
              <CollapsibleContent className="mt-2">
                <div
                  className="rounded-lg border border-border bg-card p-3 shadow-sm"
                  data-testid="personalized-breakdown-mobile"
                >
                  <BreakdownContent />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        ) : breakdownItems.length > 0 ? (
          /* Desktop: Tooltip */
          <div className="flex flex-col items-start">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>{ScoreBadge()}</div>
                </TooltipTrigger>
                <TooltipContent
                  className="max-w-xs"
                  data-testid="personalized-tooltip"
                >
                  <BreakdownContent />
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <CharacterLabel />
          </div>
        ) : (
          /* No breakdown available */
          <div className="flex flex-col items-start">
            {ScoreBadge()}
            <CharacterLabel />
          </div>
        )}

        {/* Affinity Badge (if user has surfed here before) */}
        {showAffinityBadge && (
          <Badge
            variant="outline"
            className={cn(sizeClasses[size])}
            data-testid="affinity-badge"
            aria-label={`You've surfed here ${affinityData.sessionCount} ${
              affinityData.sessionCount === 1 ? "time" : "times"
            }`}
          >
            <span className="text-base" aria-hidden="true">
              🏄
            </span>
            <span>You&apos;ve surfed here {affinityData.sessionCount}×</span>
          </Badge>
        )}
      </div>
    </div>
  );
}

/**
 * Custom comparison function for PersonalizedBadge memoization
 * Handles all props including complex objects (breakdown, affinityData, character)
 */
const arePersonalizedBadgePropsEqual = (
  prev: PersonalizedBadgeProps,
  next: PersonalizedBadgeProps
): boolean => {
  // Simple props
  if (prev.personalized !== next.personalized) return false;
  if (prev.score !== next.score) return false;
  if (prev.displayMode !== next.displayMode) return false;
  if (prev.size !== next.size) return false;
  if (prev.showDelta !== next.showDelta) return false;
  if (prev.baseScore !== next.baseScore) return false;
  if (prev.className !== next.className) return false;

  // Character object — compare shallowly (label + category are both primitives)
  if (prev.character && next.character) {
    if (
      prev.character.label !== next.character.label ||
      prev.character.category !== next.character.category
    ) {
      return false;
    }
  } else if (prev.character !== next.character) {
    return false;
  }

  // Breakdown object - compare deeply
  if (prev.breakdown && next.breakdown) {
    if (
      prev.breakdown.base !== next.breakdown.base ||
      prev.breakdown.onboardingPrefs !== next.breakdown.onboardingPrefs ||
      prev.breakdown.learnedPrefs !== next.breakdown.learnedPrefs ||
      prev.breakdown.affinity !== next.breakdown.affinity ||
      prev.breakdown.multiplier !== next.breakdown.multiplier
    ) {
      return false;
    }
  } else if (prev.breakdown !== next.breakdown) {
    // One is defined, the other isn't
    return false;
  }

  // AffinityData object - compare deeply
  if (prev.affinityData && next.affinityData) {
    if (
      prev.affinityData.sessionCount !== next.affinityData.sessionCount ||
      prev.affinityData.lastSurfed.getTime() !== next.affinityData.lastSurfed.getTime()
    ) {
      return false;
    }
  } else if (prev.affinityData !== next.affinityData) {
    // One is defined, the other isn't
    return false;
  }

  // All checks passed
  return true;
};

/**
 * Memoized version to prevent unnecessary re-renders
 * Uses custom comparison to handle all props including complex objects
 */
export const PersonalizedBadge = memo(
  PersonalizedBadgeComponent,
  arePersonalizedBadgePropsEqual
);

PersonalizedBadge.displayName = "PersonalizedBadge";
