"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Star, Loader2, CalendarDays, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PersonalizedBadge } from "@/components/recommendations/PersonalizedBadge";
import { MatchScoreEducation } from "@/components/recommendations/match-score-education";
import { BoardRecommendationBadge } from "@/components/recommendations/board-recommendation-badge";
import { useBoardRecommendation } from "@/hooks/use-board-recommendation";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { track } from "@/lib/analytics";
import { trackAuthModalOpened } from "@/lib/analytics/auth-events";
import { trackSignupCtaClick, trackSignupCtaView } from "@/lib/analytics/signup-conversion-tracking";
import type { Beach } from "@/types/database";
import type { PersonalizedScore } from "@/lib/services/personalized-scoring-service";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { getBeachLocation } from "@/lib/utils/beach-card-utils";
import { slugify } from "@/lib/utils/text-utils";

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
  /** First day beyond the 3-day public horizon — used to build data-driven teaser copy */
  firstHiddenDayName?: string | null;
  /** Peak wave height in the gated forecast window (days 4-12) */
  peakHiddenWaveHeight?: number | null;
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
  firstHiddenDayName,
  peakHiddenWaveHeight,
}: BeachHeroCompactProps) {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [showGhostAuthModal, setShowGhostAuthModal] = useState(false);
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
    trackSignupCtaClick({
      source: "match-score-teaser",
      cta_title: "forecast-teaser",
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
          trackSignupCtaView({ source: "match-score-teaser", cta_title: "forecast-teaser" });
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [publicMode, personalizationScore, isLoadingPersonalization, beach.name]);

  // Build data-driven teaser copy for anonymous users.
  // Prefer concrete forecast data (wave height on a named upcoming day),
  // fall back to a compelling static message about the 12-day window.
  const teaserHeadline = useMemo(() => {
    if (firstHiddenDayName && peakHiddenWaveHeight && peakHiddenWaveHeight >= 2) {
      return `${firstHiddenDayName}'s swell hits ${peakHiddenWaveHeight.toFixed(0)}ft — see the 12-day outlook`;
    }
    if (firstHiddenDayName) {
      return `See what's coming ${firstHiddenDayName} — full 12-day outlook`;
    }
    return "Best window tomorrow: sign up for alerts";
  }, [firstHiddenDayName, peakHiddenWaveHeight]);

  const teaserSubtext = useMemo(() => {
    if (firstHiddenDayName && peakHiddenWaveHeight && peakHiddenWaveHeight >= 2) {
      return "Free — takes 30 seconds";
    }
    return "Free — no credit card needed";
  }, [firstHiddenDayName, peakHiddenWaveHeight]);

  return (
    <div
      className={`${overlayMode ? "" : "bg-white border-b border-gray-200"} py-6 ${className || ""}`}
    >
      {/* Phase 4 Spec: Beach Name - 36px Space Grotesk, 700 weight, 44px line-height, 8px margin-bottom */}
      {/* Hidden in overlayMode — title is rendered separately in the hero overlay above */}
      {!overlayMode && (
        <h1 className="text-4xl font-heading font-bold leading-[44px] text-gray-900 mb-2">
          {beach.name} Surf Report
        </h1>
      )}

      {/* Personalization Badge - Show after title for authenticated users */}
      {isLoadingPersonalization && (
        <div className={`flex items-center gap-2 mb-3 ${overlayMode ? "text-medium" : "text-muted-foreground"}`}>
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

      {/* Forecast Teaser - Show for anonymous users with data-driven copy */}
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
              <CalendarDays className="h-5 w-5 text-ocean-blue" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-gray-900">
                {teaserHeadline}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{teaserSubtext}</p>
            </div>
            <div className="flex-shrink-0 text-sm font-semibold text-ocean-blue
              group-hover:translate-x-0.5 transition-transform">
              Unlock →
            </div>
          </button>
        </motion.div>
      )}

      {/* Ghost Match Score — blurred/locked score to create curiosity */}
      {publicMode && !personalizationScore && !isLoadingPersonalization && (
        <div className="mb-3">
          <button
            onClick={() => {
              trackSignupCtaClick({
                source: "ghost-match-score",
                cta_type: "ghost_score",
                cta_text: "Your Match",
              });
              trackAuthModalOpened({
                mode: "signup",
                source: "ghost-match-score",
              });
              setShowGhostAuthModal(true);
            }}
            className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/20 hover:bg-white/20 transition-colors"
            aria-label="See your personalized match score — sign up free"
          >
            <div className="relative flex items-center justify-center w-6 h-6">
              <span className="text-sm font-bold text-white/30 blur-[2px] select-none" aria-hidden="true">87</span>
              <Lock className="absolute h-3 w-3 text-white/80" />
            </div>
            <span className="text-xs text-white/80 font-medium">Your Match</span>
          </button>
          {showGhostAuthModal && (
            <UnifiedAuthModal
              isOpen={showGhostAuthModal}
              onClose={() => setShowGhostAuthModal(false)}
              mode="signup"
              contextMessage={{
                title: "See Your Match Score",
                description: `Get a personalized conditions match for ${beach.name} based on your skill level and preferences`,
              }}
              source="ghost-match-score"
            />
          )}
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
      <div
        className="flex flex-wrap items-center gap-2 my-3"
        style={overlayMode ? { textShadow: "0 1px 8px rgba(0,0,0,0.5)" } : undefined}
      >
        {/* Phase 4 Spec: Rating Component - 8px gap, 12px vertical margin */}
        {rating > 0 && (
          <>
            <div className="inline-flex items-center gap-2">
              {/* Phase 4 Spec: Star Icons - 20×20px */}
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              {/* Phase 4 Spec: Rating Text - 18px, 600 weight */}
              <span className={`text-lg font-semibold ${overlayMode ? "text-white" : "text-gray-900"}`}>{rating.toFixed(1)}</span>
            </div>
            {/* Phase 4 Spec: Review Count - 14px, gray-600, 8px margin-left */}
            {reviewCount > 0 && (
              <span className={`text-sm ml-2 ${overlayMode ? "text-medium" : "text-gray-600"}`}>
                ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
              </span>
            )}
            <span className={overlayMode ? "text-white/40" : "text-gray-400"}>·</span>
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
            <span className={overlayMode ? "text-white/40" : "text-gray-400"}>·</span>
          </>
        )}

        {/* Break Type */}
        <span className={`font-medium text-sm ${overlayMode ? "text-white" : "text-gray-900"}`}>{breakType}</span>

        <span className={overlayMode ? "text-white/40" : "text-gray-400"}>·</span>

        {/* Location */}
        <span className={`text-sm ${overlayMode ? "text-medium" : "text-gray-600"}`}>{location}</span>
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
