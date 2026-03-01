"use client";

import React from "react";
import { Clock, AlertCircle } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatBeachDateTime } from "@/lib/utils/date-utils";
import { formatDiscoveryScore } from "@/lib/utils/rating-formatters";
import { formatTimeWindowCompact } from "@/lib/utils/time-formatters";
import {
  type ConditionTier,
  getConditionTier,
  getScoreColorClass,
  getConditionBadge,
  buildHeadlineText,
  isTomorrowInTimezone,
  isEveningInTimezone,
} from "@/lib/utils/condition-tier-utils";
import { HOME_HEADER_MOTION } from "@/lib/constants/animations";
import { BoardRecommendationBadge } from "@/components/recommendations/board-recommendation-badge";
import { useBoardRecommendation } from "@/hooks/use-board-recommendation";
import type {
  SurfDiscoveryRecommendation,
  PersonalizedInsights,
  TimeSlot,
} from "@/types/personalization";
import { getPersonalizationExplanation } from "@/lib/utils/personalization-messaging";

// Re-export for backwards compatibility with consumers
export {
  type ConditionTier,
  getConditionTier,
  getScoreColorClass,
  getConditionBadge,
  buildHeadlineText,
  formatTimeWindowCompact,
};

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
 * Format peak time for "Best at" badge display (e.g., "7am", "7:30am")
 * @param peakTime Peak time Date object
 * @param timezone IANA timezone
 * @returns Formatted time string
 */
function formatPeakTime(peakTime: Date, timezone: string): string {
  const minutesStr = formatBeachDateTime(peakTime, timezone, "m");
  const minutes = parseInt(minutesStr, 10);
  if (minutes === 0) {
    return formatBeachDateTime(peakTime, timezone, "ha").toLowerCase();
  }
  // Use "h:mm a" format and remove space for compact display (e.g., "7:30am")
  return formatBeachDateTime(peakTime, timezone, "h:mm a").replace(/ /g, "").toLowerCase();
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

  // Board recommendation based on current conditions
  // Hook must be called unconditionally before any early returns
  // Parse wave_height and wind_speed from strings to numbers
  const waveHeightNum = recommendation?.forecast?.wave_height
    ? parseFloat(String(recommendation.forecast.wave_height))
    : null;
  const windSpeedNum = recommendation?.forecast?.wind_speed
    ? parseFloat(String(recommendation.forecast.wind_speed))
    : null;

  const { recommendation: boardRecommendation } = useBoardRecommendation({
    waveHeight: Number.isFinite(waveHeightNum) ? waveHeightNum : null,
    windSpeed: Number.isFinite(windSpeedNum) ? windSpeedNum : null,
    beachId: recommendation?.beach?.id ?? null,
    enabled: !!recommendation?.forecast,
  });

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

  const { beach, score, window, matchQuality, recommendationLabel, message, conditionBadges, waveHeightBadge, subscores } = recommendation;
  const formattedScore = formatDiscoveryScore(score);
  const timeWindow = formatTimeWindowCompact(
    window.start,
    window.end,
    window.timezone
  );

  // Calculate tier and score color
  const tier = getConditionTier(score);
  const scoreColorClass = getScoreColorClass(tier);

  // Determine if showing tomorrow's forecast
  const timezone = window.timezone || beach.timezone || "America/Los_Angeles";
  const isTomorrow = (() => {
    const now = new Date();
    const dateFormatter = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: timezone,
    });
    const todayStr = dateFormatter.format(now);
    const startDayStr = dateFormatter.format(window.start);
    return todayStr !== startDayStr && window.start > now;
  })();

  const isEvening = isEveningInTimezone(timezone);
  const headline = buildHeadlineText(beach.name, tier, isTomorrow, timeSlot, isEvening);

  return (
    <div className="space-y-4 px-4 sm:px-1" data-testid="hero-recommendation">
      {/* Main headline */}
      <h1 className="text-2xl xs:text-3xl sm:text-4xl font-roboto font-bold tracking-tight text-white leading-tight">
        {headline.prefix}
        <button
          onClick={() => onViewBeach(beach.id)}
          className="hover:text-ocean-blue focus-visible:text-ocean-blue focus-visible:outline-none focus-visible:underline transition-colors text-left min-h-[44px] inline"
          aria-label={`View details for ${beach.name}`}
        >
          {headline.beachPart}
        </button>{" "}
        {headline.connector}{" "}
        <motion.span
          className={cn(
            scoreColorClass,
            score >= 85 && "motion-safe:animate-heartbeat inline-block"
          )}
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
        <p className="text-sm sm:text-base text-white/80 leading-relaxed" data-testid="hero-message">
          {message}
        </p>
      )}

      {/* Personalization context line - subtle explanation when recommendation is personalized */}
      {insights && insights.state !== "onboarding" && (
        <p className="text-xs text-white/50" data-testid="hero-personalization-context">
          {getPersonalizationExplanation({
            base: 0,
            onboardingPrefs: insights.state === "degraded" ? 1 : 0,
            learnedPrefs: insights.state === "ready" ? insights.matchPercent : 0,
            affinity: subscores?.affinityBonus ?? 0,
          })}
        </p>
      )}

      {/* Time window and condition badges */}
      <motion.div
        className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 sm:-mx-1 sm:px-1 pb-1 scrollbar-hide"
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
        <motion.div variants={shouldReduceMotion ? {} : HOME_HEADER_MOTION.hero.badge} className="flex-shrink-0">
          <Badge
            variant="outline"
            className="text-xs sm:text-sm font-medium bg-white/10 text-white border-white/20 py-1.5 px-2.5"
          >
            <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" />
            {timeWindow}
          </Badge>
        </motion.div>

        {/* Peak time badge */}
        {window.peakTime && (
          <motion.div variants={shouldReduceMotion ? {} : HOME_HEADER_MOTION.hero.badge} className="flex-shrink-0">
            <Badge
              variant="outline"
              className="text-xs sm:text-sm font-medium bg-white/10 text-white border-white/20 py-1.5 px-2.5"
            >
              Best at {formatPeakTime(window.peakTime, window.timezone)}
            </Badge>
          </motion.div>
        )}

        {/* Wave height badge */}
        {waveHeightBadge && (
          <motion.div variants={shouldReduceMotion ? {} : HOME_HEADER_MOTION.hero.badge} className="flex-shrink-0">
            <Badge
              variant="outline"
              className="text-xs sm:text-sm font-medium py-1.5 px-2.5 bg-white/10 text-white border-white/20"
            >
              {waveHeightBadge}
            </Badge>
          </motion.div>
        )}

        {/* Tier-based condition badge */}
        {(() => {
          const conditionBadge = getConditionBadge(tier);
          if (!conditionBadge) return null;
          return (
            <motion.div variants={shouldReduceMotion ? {} : HOME_HEADER_MOTION.hero.badge} className="flex-shrink-0">
              <Badge
                variant="outline"
                className={`text-xs sm:text-sm font-medium py-1.5 px-2.5 ${conditionBadge.className}`}
              >
                {conditionBadge.label}
              </Badge>
            </motion.div>
          );
        })()}

        {/* Condition badges (hidden for marginal tier) */}
        {tier !== 'marginal' && conditionBadges?.slice(0, 3).map((badge) => (
          <motion.div
            key={badge.label}
            variants={shouldReduceMotion ? {} : HOME_HEADER_MOTION.hero.badge}
            className="flex-shrink-0"
          >
            <Badge
              variant="outline"
              className="text-xs sm:text-sm font-medium py-1.5 px-2.5 bg-white/10 text-white border-white/20"
            >
              {badge.label}
            </Badge>
          </motion.div>
        ))}

        {/* Board Recommendation Badge - only show when confident */}
        {boardRecommendation && (
          <motion.div
            variants={shouldReduceMotion ? {} : HOME_HEADER_MOTION.hero.badge}
            className="flex-shrink-0"
          >
            <BoardRecommendationBadge
              boardName={boardRecommendation.boardName}
              boardType={boardRecommendation.boardType}
              size="sm"
              className="bg-amber-500/20 text-amber-200 border-amber-400/30"
            />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
});

export default HeroRecommendation;
