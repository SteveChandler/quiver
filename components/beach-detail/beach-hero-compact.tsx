"use client";

import { Star, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PersonalizedBadge } from "@/components/recommendations/PersonalizedBadge";
import { BoardRecommendationBadge } from "@/components/recommendations/board-recommendation-badge";
import { useBoardRecommendation } from "@/hooks/use-board-recommendation";
import type { Beach } from "@/types/database";
import type { PersonalizedScore } from "@/lib/services/personalized-scoring-service";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { getBeachLocation } from "@/lib/utils/beach-card-utils";

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
}

export function BeachHeroCompact({
  beach,
  personalizationScore,
  affinityData,
  baseScore,
  isLoadingPersonalization,
  currentForecast,
  className
}: BeachHeroCompactProps) {
  const rating = beach.average_rating || 0;
  const reviewCount = beach.review_count || 0;
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

  return (
    <div className={`bg-white py-6 border-b border-gray-200 ${className || ""}`}>
      {/* Phase 4 Spec: Beach Name - 36px Roboto, 700 weight, 44px line-height, 8px margin-bottom */}
      <h1 className="text-4xl font-roboto font-bold leading-[44px] text-gray-900 mb-2">
        {beach.name}
      </h1>

      {/* Personalization Badge - Show after title for authenticated users */}
      {isLoadingPersonalization && (
        <div className="flex items-center gap-2 text-muted-foreground mb-3">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Calculating your match...</span>
        </div>
      )}
      {personalizationScore && personalizationScore.personalized && (
        <div className="mb-3">
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
        </div>
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
              <span className="text-sm text-gray-600 ml-2">
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
        <span className="text-gray-900 font-medium text-sm">{breakType}</span>

        <span className="text-gray-400">·</span>

        {/* Location */}
        <span className="text-gray-600 text-sm">{location}</span>
      </div>
    </div>
  );
}
