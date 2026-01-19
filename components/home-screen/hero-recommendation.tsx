"use client";

import React from "react";
import { Clock, AlertCircle } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { formatBeachDateTime } from "@/lib/utils/date-utils";
import { formatDiscoveryScore } from "@/lib/utils/rating-formatters";
import { HOME_HEADER_MOTION } from "@/lib/constants/animations";
import type {
  SurfDiscoveryRecommendation,
  PersonalizedInsights,
  TimeSlot,
} from "@/types/personalization";

/**
 * Condition tier based on score thresholds
 */
export type ConditionTier = "great" | "good" | "fair" | "marginal";

/**
 * Get condition tier based on score thresholds
 * @param score Score value (0-100)
 * @returns ConditionTier - 'great' (80+), 'good' (60-79), 'fair' (40-59), 'marginal' (<40)
 */
export function getConditionTier(score: number): ConditionTier {
  if (score >= 80) return "great";
  if (score >= 60) return "good";
  if (score >= 40) return "fair";
  return "marginal";
}

/**
 * Get Tailwind color class for score display based on condition tier
 * @param tier Condition tier
 * @returns Tailwind color class
 */
export function getScoreColorClass(tier: ConditionTier): string {
  switch (tier) {
    case "great":
    case "good":
      return "text-accent-orange";
    case "fair":
      return "text-amber-400";
    case "marginal":
      return "text-white/60";
  }
}

/**
 * Get condition badge configuration based on tier
 * @param tier Condition tier
 * @returns Badge config with label and className, or null for 'good' tier
 */
export function getConditionBadge(
  tier: ConditionTier
): { label: string; className: string } | null {
  switch (tier) {
    case "great":
      return {
        label: "Great Conditions",
        className: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
      };
    case "good":
      return null;
    case "fair":
      return {
        label: "Fair Conditions",
        className: "bg-amber-500/20 text-amber-300 border-amber-400/30",
      };
    case "marginal":
      return {
        label: "Marginal",
        className: "bg-white/10 text-white/60 border-white/20",
      };
  }
}

/**
 * Props for HeroRecommendation component
 */
export interface HeroRecommendationProps {
  /** Top surf spot recommendation data */
  recommendation: SurfDiscoveryRecommendation | null;
  /** Personalized insights from session history */
  insights?: PersonalizedInsights | null;
  /** Loading state indicator */
  loading?: boolean;
  /** Error object if fetch failed */
  error?: Error | null;
  /** Callback when user clicks "Plan Session" */
  onPlanSession: () => void;
  /** Callback when user clicks on the beach name/card */
  onViewBeach: (beachId: string) => void;
  /** Callback to enable reminder notifications */
  onEnableReminder?: (beachId: string, beachName: string) => Promise<boolean>;
  /** Whether forecast alerts are already enabled */
  forecastAlertsEnabled?: boolean;
  /** User's current home beach ID */
  homeBeachId?: string | null;
  /** Selected time slot filter */
  timeSlot?: TimeSlot;
}

/**
 * Format time range compactly for badge display (e.g., "7-10am", "7am-1pm")
 * @param start Start date
 * @param end End date
 * @param timezone IANA timezone
 * @returns Compact time range string
 */
function formatTimeWindowCompact(
  start: Date,
  end: Date,
  timezone: string
): string {
  // Check if tomorrow
  const now = new Date();

  // Create date objects in the beach timezone to compare "days" accurately
  // (Using simple string comparison of YYYY-MM-DD in the target timezone)
  const todayStr = formatBeachDateTime(now, timezone, "EEE, MMM d");
  const startDayStr = formatBeachDateTime(start, timezone, "EEE, MMM d");

  // Calculate day difference roughly to determine "Tomorrow"
  // (Or just use the strings if todayStr != startDayStr)
  // A more robust way using timestamps:
  const isTomorrow = (() => {
    // Get "Midnight tonight" in the beach timezone
    // check if start is > midnight tonight and < midnight tomorrow+1
    // Simplest proxy: if the day string is different, valid for "Tomorrow"
    // (assuming we don't recommend 2 days out in this specific component context)
    if (todayStr === startDayStr) return false;

    // Verify it's not simply "later today" (covered by equality check) or "yesterday"
    // Since recommendations are future-only, inequality + future = Tomorrow (or later)
    return start > now;
  })();

  const prefix = isTomorrow ? "Tomorrow " : "";

  // Get hours to determine AM/PM
  const startHourStr = formatBeachDateTime(start, timezone, "H");
  const endHourStr = formatBeachDateTime(end, timezone, "H");
  const startHour = parseInt(startHourStr, 10);
  const endHour = parseInt(endHourStr, 10);
  const startIsPM = startHour >= 12;
  const endIsPM = endHour >= 12;

  // Format individual times
  const formatTimeCompact = (date: Date): string => {
    const minutesStr = formatBeachDateTime(date, timezone, "m");
    const minutes = parseInt(minutesStr, 10);
    if (minutes === 0) {
      return formatBeachDateTime(date, timezone, "ha").toLowerCase();
    }
    return formatBeachDateTime(date, timezone, "h:mm a")
      .replace(/ /g, "")
      .toLowerCase();
  };

  // If both in same period (AM or PM), share the suffix
  if (startIsPM === endIsPM) {
    const startMinutesStr = formatBeachDateTime(start, timezone, "m");
    const startMinutes = parseInt(startMinutesStr, 10);

    // Format start without am/pm
    const startFullTime = formatBeachDateTime(start, timezone, "h:mm a");
    const startParts = startFullTime.split(" ");
    const startTimeOnly = startParts[0];
    const startStr =
      startMinutes === 0 ? startTimeOnly.split(":")[0] : startTimeOnly;

    // Format end with am/pm
    const endStr = formatTimeCompact(end);

    return `${prefix}${startStr}-${endStr}`;
  }

  // Different periods, show both
  return `${prefix}${formatTimeCompact(start)}-${formatTimeCompact(end)}`;
}

/**
 * Loading skeleton for HeroRecommendation
 * Matches the structure of the main component for smooth transitions
 */
export function HeroRecommendationSkeleton() {
  return (
    <div
      className="space-y-3 px-4 sm:px-1"
      data-testid="hero-recommendation-loading"
    >
      {/* Main headline skeleton */}
      <div className="space-y-2">
        <div className="h-8 sm:h-10 bg-gradient-to-r from-white/10 via-white/20 to-white/10 rounded-lg w-4/5 animate-shimmer bg-[length:200%_100%]" />
        <div className="h-8 sm:h-10 bg-gradient-to-r from-white/10 via-white/20 to-white/10 rounded-lg w-2/3 animate-shimmer bg-[length:200%_100%]" />
      </div>

      {/* Time badge skeleton */}
      <div className="flex items-center gap-2 mt-4">
        <div className="h-6 w-24 bg-gradient-to-r from-white/10 via-white/20 to-white/10 rounded-full animate-shimmer bg-[length:200%_100%]" />
      </div>
    </div>
  );
}

/**
 * Error state for HeroRecommendation
 */
export function HeroRecommendationError({ error }: { error: Error }) {
  return (
    <div className="px-4 sm:px-1 py-4" data-testid="hero-recommendation-error">
      <div className="flex items-start gap-3 text-red-400">
        <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-sm sm:text-base text-white">
            Unable to load recommendation
          </p>
          <p className="text-xs sm:text-sm text-red-300 mt-1">
            {error.message || "Please try again later."}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Empty state when no recommendation is available
 */
export function HeroRecommendationEmpty() {
  return (
    <div className="px-4 sm:px-1 py-4" data-testid="hero-recommendation-empty">
      <div className="text-center">
        <p className="text-base sm:text-lg text-white/80">
          No surf recommendations available
        </p>
        <p className="text-xs sm:text-sm mt-1 text-white/60">
          Check back later for updated conditions
        </p>
      </div>
    </div>
  );
}

/**
 * HeroRecommendation displays the main headline section showing
 * the top surf spot recommendation on the home screen.
 *
 * Features:
 * - Large headline with beach name and score
 * - Score displayed in accent color (blue)
 * - Time window badge showing best surf time
 * - Loading skeleton state
 * - Error and empty states
 *
 * @example
 * ```tsx
 * <HeroRecommendation
 *   recommendation={recommendation}
 *   loading={false}
 *   onPlanSession={() => navigate('/plan')}
 *   onViewBeach={(id) => navigate(`/beach/${id}`)}
 * />
 * ```
 */
export const HeroRecommendation = React.memo(function HeroRecommendation({
  recommendation,
  insights,
  loading = false,
  error = null,
  onPlanSession,
  onViewBeach,
  onEnableReminder,
  forecastAlertsEnabled = false,
  homeBeachId,
  timeSlot,
}: HeroRecommendationProps) {
  const shouldReduceMotion = useReducedMotion();

  // Handle loading state
  if (loading) {
    return <HeroRecommendationSkeleton />;
  }

  // Handle error state
  if (error) {
    return <HeroRecommendationError error={error} />;
  }

  // Handle no data state
  if (!recommendation) {
    return <HeroRecommendationEmpty />;
  }

  const { beach, score, window, matchQuality, recommendationLabel, message, conditionBadges, waveHeightBadge } = recommendation;
  const formattedScore = formatDiscoveryScore(score);
  const timeWindow = formatTimeWindowCompact(
    window.start,
    window.end,
    window.timezone
  );

  return (
    <div className="space-y-3 px-4 sm:px-1" data-testid="hero-recommendation">
      {/* Main headline */}
      <h1 className="text-2xl xs:text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
        <button
          onClick={() => onViewBeach(beach.id)}
          className="hover:text-accent-orange focus-visible:text-accent-orange focus-visible:outline-none focus-visible:underline transition-colors text-left min-h-[44px] inline"
          aria-label={`View details for ${beach.name}`}
        >
          {beach.name}
        </button>{" "}
        is your best bet at{" "}
        <motion.span
          className="text-accent-orange"
          data-testid="hero-score"
          animate={shouldReduceMotion ? undefined : {
            textShadow: [...HOME_HEADER_MOTION.hero.scoreGlow.textShadow],
            transition: HOME_HEADER_MOTION.hero.scoreGlow.transition,
          }}
        >
          {formattedScore}/10
        </motion.span>.
      </h1>

      {/* Natural language message */}
      {message && (
        <p className="text-sm sm:text-base text-white/80" data-testid="hero-message">
          {message}
        </p>
      )}

      {/* Time window and condition badges */}
      <motion.div
        className="flex flex-wrap items-center gap-2"
        data-testid="hero-badges"
        initial="initial"
        animate="animate"
        variants={shouldReduceMotion ? undefined : {
          initial: {},
          animate: {
            transition: {
              staggerChildren: HOME_HEADER_MOTION.hero.badgeStagger.staggerChildren,
              delayChildren: HOME_HEADER_MOTION.hero.badgeStagger.delayChildren,
            },
          },
        }}
      >
        <motion.div variants={shouldReduceMotion ? {} : HOME_HEADER_MOTION.hero.badge}>
          <Badge
            variant="outline"
            className="text-xs sm:text-sm font-medium bg-white/10 text-white border-white/20 py-1.5 px-2.5"
          >
            <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" />
            {timeWindow}
          </Badge>
        </motion.div>

        {/* Wave height badge */}
        {waveHeightBadge && (
          <motion.div variants={shouldReduceMotion ? {} : HOME_HEADER_MOTION.hero.badge}>
            <Badge
              variant="outline"
              className="text-xs sm:text-sm font-medium py-1.5 px-2.5 bg-white/10 text-white border-white/20"
            >
              {waveHeightBadge}
            </Badge>
          </motion.div>
        )}

        {/* Recommendation label badge (Perfect Match for high scores) */}
        {score >= 90 && (
          <motion.div variants={shouldReduceMotion ? {} : HOME_HEADER_MOTION.hero.badge}>
            <Badge
              variant="outline"
              className="text-xs sm:text-sm font-medium py-1.5 px-2.5 bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
            >
              Perfect Match
            </Badge>
          </motion.div>
        )}

        {/* Condition badges */}
        {conditionBadges?.slice(0, 3).map((badge) => (
          <motion.div
            key={badge.label}
            variants={shouldReduceMotion ? {} : HOME_HEADER_MOTION.hero.badge}
          >
            <Badge
              variant="outline"
              className="text-xs sm:text-sm font-medium py-1.5 px-2.5 bg-white/10 text-white border-white/20"
            >
              {badge.label}
            </Badge>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
});

export default HeroRecommendation;
