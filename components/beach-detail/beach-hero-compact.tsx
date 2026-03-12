"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Star, Loader2, Sparkles, Waves, Wind, Anchor } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PersonalizedBadge } from "@/components/recommendations/PersonalizedBadge";
import { MatchScoreEducation } from "@/components/recommendations/match-score-education";
import { BoardRecommendationBadge } from "@/components/recommendations/board-recommendation-badge";
import { useBoardRecommendation } from "@/hooks/use-board-recommendation";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { track } from "@/lib/analytics";
import { trackAuthModalOpened } from "@/lib/analytics/auth-events";
import type { Beach } from "@/types/database";
import type { PersonalizedScore } from "@/lib/services/personalized-scoring-service";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { getBeachLocation } from "@/lib/utils/beach-card-utils";
import { slugify } from "@/lib/utils/text-utils";
import { getScoreColorClasses } from "@/lib/utils/score-color-utils";

interface BeachHeroCompactProps {
  beach: Beach & {
    average_rating?: number;
    review_count?: number;
  };
  personalizationScore?: PersonalizedScore | null;
  affinityData?: { sessionCount: number; lastSurfed: Date } | null;
  baseScore?: number;
  isLoadingPersonalization?: boolean;
  /** Current forecast data for board recommendations */
  currentForecast?: EnhancedForecastEntity | null;
  className?: string;
  publicMode?: boolean;
  /** When true, renders transparent over video — hides h1, uses white text */
  overlayMode?: boolean;
}

export function BeachHeroCompact({
  beach,
  personalizationScore,
  affinityData,
  baseScore,
  isLoadingPersonalization,
  currentForecast,
  className,
  publicMode,
  overlayMode = false,
}: BeachHeroCompactProps) {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const rating = beach.average_rating;
  const reviewCount = beach.review_count;
  const breakType = beach.break_type || "Beach Break";
  const location = getBeachLocation(beach);

  // Board recommendation based on current conditions
  // Parse wave_height and wind_speed from strings to numbers
  const waveHeightNum = currentForecast?.wave_height
    ? parseFloat(String(currentForecast.wave_height))
    : null;
  const windSpeedNum = currentForecast?.wind_speed
    ? parseFloat(String(currentForecast.wind_speed))
    : null;

  const { recommendation: boardRecommendation } = useBoardRecommendation({
    waveHeight: Number.isFinite(waveHeightNum) ? waveHeightNum : null,
    windSpeed: Number.isFinite(windSpeedNum) ? windSpeedNum : null,
    beachId: beach.id,
    enabled: !!currentForecast,
  });

  // Phase 4 Spec: Determine difficulty/skill level badge styling
  // Easy/Beginner: blue-50/ocean-blue, Moderate: orange-50/orange-600, Hard: red-50/red-600
  const getDifficultyClasses = (level?: string | null) => {
    if (!level) return "bg-cyan-50 text-cyan-600 border-transparent";
    const lower = level.toLowerCase();
    if (lower.includes("beginner") || lower.includes("easy")) {
      return "bg-blue-50 text-ocean-blue border-transparent";
    }
    if (lower.includes("intermediate")) {
      return "bg-orange-50 text-orange-600 border-transparent";
    }
    if (lower.includes("advanced") || lower.includes("expert")) {
      return "bg-red-50 text-red-600 border-transparent";
    }
    return "bg-cyan-50 text-cyan-600 border-transparent";
  };

  const handleMatchScoreTeaserClick = useCallback(() => {
    track("match_score_teaser_click", {
      beach_slug: slugify(beach.name),
    });
    trackAuthModalOpened({
      mode: "signup",
      source: "match-score-teaser",
    });
    setAuthModalOpen(true);
  }, [beach.name]);

  const teaserRef = useRef<HTMLDivElement>(null);
  const hasTrackedView = useRef(false);

  useEffect(() => {
    if (!publicMode || personalizationScore || isLoadingPersonalization) return;
    const el = teaserRef.current;
    if (!el || hasTrackedView.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTrackedView.current) {
          hasTrackedView.current = true;
          track("match_score_teaser_view", { beach_slug: slugify(beach.name) });
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [publicMode, personalizationScore, isLoadingPersonalization, beach.name]);

  // Conditions score badge (used in overlay mode)
  const scoreColors = baseScore != null ? getScoreColorClasses(baseScore) : null;

  // Overlay mode: stripped-down conditions strip for fast scanning
  if (overlayMode) {
    return (
      <div className={`py-3 ${className || ""}`}>
        <div className="flex flex-wrap items-center gap-3">
          {/* Conditions score badge */}
          {scoreColors && baseScore != null && (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold text-white ${scoreColors.bg}`}
              style={{ textShadow: "none" }}
            >
              {baseScore}
              <span className="font-medium text-white/80 text-xs">{scoreColors.label}</span>
            </span>
          )}

          {/* Wave height */}
          {currentForecast?.wave_height && (
            <span className="inline-flex items-center gap-1.5 text-white" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>
              <Waves className="h-4 w-4 text-white/70 shrink-0" aria-hidden="true" />
              <span className="text-sm font-semibold">{currentForecast.wave_height}</span>
            </span>
          )}

          {/* Wind summary */}
          {currentForecast?.wind_speed && (
            <span className="inline-flex items-center gap-1.5 text-white" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>
              <Wind className="h-4 w-4 text-white/70 shrink-0" aria-hidden="true" />
              <span className="text-sm font-semibold">
                {currentForecast.wind_direction
                  ? `${currentForecast.wind_speed} ${currentForecast.wind_direction}`
                  : currentForecast.wind_speed}
              </span>
            </span>
          )}

          {/* Tide state */}
          {currentForecast?.tide_status && (
            <span className="inline-flex items-center gap-1.5 text-white" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>
              <Anchor className="h-4 w-4 text-white/70 shrink-0" aria-hidden="true" />
              <span className="text-sm font-semibold">{currentForecast.tide_status}</span>
            </span>
          )}
        </div>
      </div>
    );
  }

  // Default (non-overlay) mode: full metadata display
  return (
    <div
      className={`bg-white border-b border-gray-200 py-6 ${className || ""}`}
    >
      {/* Phase 4 Spec: Beach Name - 36px Space Grotesk, 700 weight, 44px line-height, 8px margin-bottom */}
      <h1 className="text-4xl font-heading font-bold leading-[44px] text-gray-900 mb-2">
        {beach.name} Surf Report
      </h1>

      {/* Personalization Badge - Show after title for authenticated users */}
      {isLoadingPersonalization && (
        <div className="flex items-center gap-2 mb-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Calculating your match...</span>
        </div>
      )}
      {personalizationScore && personalizationScore.personalized && (
        <div className="mb-3">
          <MatchScoreEducation>
            <PersonalizedBadge
              personalized={personalizationScore.personalized}
              score={personalizationScore.score}
              breakdown={personalizationScore.breakdown}
              affinityData={affinityData || undefined}
              displayMode="score"
              size="lg"
              showDelta={baseScore !== undefined}
              baseScore={baseScore}
            />
          </MatchScoreEducation>
        </div>
      )}

      {/* Match Score Teaser - Show for anonymous users */}
      {publicMode && !personalizationScore && !isLoadingPersonalization && (
        <motion.div
          ref={teaserRef}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 25 }}
          className="mb-3"
        >
          <button
            onClick={handleMatchScoreTeaserClick}
            className="group w-full sm:max-w-sm flex items-center gap-3 rounded-2xl
              border border-ocean-blue/15 bg-gradient-to-br from-ocean-blue/5 via-white to-cyan-50/80
              p-3.5 shadow-sm ring-1 ring-ocean-blue/5
              hover:shadow-md hover:border-ocean-blue/25 transition-all duration-200"
          >
            <div className="flex-shrink-0 p-2 rounded-xl bg-ocean-blue/10">
              <Sparkles className="h-5 w-5 text-ocean-blue" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-gray-900">
                How well does this spot match you?
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Takes 30 seconds</p>
            </div>
            <div className="flex-shrink-0 text-sm font-semibold text-ocean-blue
              group-hover:translate-x-0.5 transition-transform">
              See score →
            </div>
          </button>
        </motion.div>
      )}

      {/* Board Recommendation Badge - only show when confident */}
      {boardRecommendation && (
        <div className="mb-3">
          <BoardRecommendationBadge
            boardName={boardRecommendation.boardName}
            boardType={boardRecommendation.boardType}
            size="md"
          />
        </div>
      )}

      {/* Phase 4 Spec: Metadata Row - 12px margin, flex layout */}
      <div className="flex flex-wrap items-center gap-2 my-3">
        {/* Phase 4 Spec: Rating Component - 8px gap, 12px vertical margin */}
        {rating > 0 && (
          <>
            <div className="inline-flex items-center gap-2">
              {/* Phase 4 Spec: Star Icons - 20×20px */}
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              {/* Phase 4 Spec: Rating Text - 18px, 600 weight */}
              <span className="text-lg font-semibold text-gray-900">{rating.toFixed(1)}</span>
            </div>
            {/* Phase 4 Spec: Review Count - 14px, gray-600, 8px margin-left */}
            {reviewCount > 0 && (
              <span className="text-sm ml-2 text-gray-600">
                ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
              </span>
            )}
            <span className="text-gray-400">·</span>
          </>
        )}

        {/* Phase 4 Spec: Difficulty Badge - cyan-50/cyan-600 colors, 4px/12px padding, pill radius */}
        {beach.skill_level && (
          <>
            <Badge
              variant="outline"
              className={`${getDifficultyClasses(beach.skill_level)} px-3 py-1 text-xs font-semibold rounded-full`}
            >
              {beach.skill_level}
            </Badge>
            <span className="text-gray-400">·</span>
          </>
        )}

        {/* Break Type */}
        <span className="font-medium text-sm text-gray-900">{breakType}</span>

        <span className="text-gray-400">·</span>

        {/* Location */}
        <span className="text-sm text-gray-600">{location}</span>
      </div>

      {publicMode && (
        <UnifiedAuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          mode="signup"
          source="match-score-teaser"
          contextMessage={{
            title: "See Your Match Score",
            description: "We'll calculate how well this spot fits your style",
          }}
        />
      )}
    </div>
  );
}
