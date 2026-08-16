"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Star, Loader2, CalendarDays, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PersonalizedBadge } from "@/components/recommendations/PersonalizedBadge";
import { MatchScoreEducation } from "@/components/recommendations/match-score-education";
import { BoardRecommendationBadge } from "@/components/recommendations/board-recommendation-badge";
// BeachAttributionCluster import removed — cluster is now mounted in
// beach-detail.tsx so it's visible on both cam and non-cam pages.
import { useBoardRecommendation } from "@/hooks/use-board-recommendation";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { track } from "@/lib/analytics";
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
  const prefersReducedMotion = useReducedMotion() ?? false;
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
      source: `beach-hero-match-teaser-${beach.id}`,
      surface: "beach-detail",
      cta_title: "forecast-teaser",
      beach_id: beach.id,
    });
    setAuthModalOpen(true);
  }, [beach.id, beach.name]);

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
          // Per-beach source to prevent session-level dedup from collapsing
          // views across different beach pages.
          trackSignupCtaView({
            source: `beach-hero-match-teaser-${beach.id}`,
            surface: "beach-detail",
            cta_title: "forecast-teaser",
            beach_id: beach.id,
          });
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [publicMode, personalizationScore, isLoadingPersonalization, beach.id, beach.name]);

  // Build benefit-driven teaser copy for anonymous users.
  // Focus on what surfers actually want at 5:30am: community intel and the best window.
  // Not future planning ("see 12-day outlook") — immediate value ("see if now is best").
  const teaserHeadline = useMemo(() => {
    if (firstHiddenDayName && peakHiddenWaveHeight && peakHiddenWaveHeight >= 2) {
      return `${peakHiddenWaveHeight.toFixed(0)}ft swell hits ${firstHiddenDayName} — see if now is the best time`;
    }
    if (firstHiddenDayName) {
      return `See what surfers reported this morning at ${beach.name}`;
    }
    return `See if now is the best time to paddle out`;
  }, [firstHiddenDayName, peakHiddenWaveHeight, beach.name]);

  const teaserSubtext = "Free — takes 30 seconds";

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

      {/* Attribution cluster was formerly mounted here — moved to
          `beach-detail.tsx` where it renders for every beach page
          (cam + non-cam). BeachHeroCompact is ONLY ever rendered in
          overlayMode (inside the bottom of the hero on non-cam pages)
          and is not rendered at all on cam pages, so neither user saw
          the cluster. Plan: D2 follow-up. */}

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

      {/* Forecast Teaser — the SOLE anonymous CTA on beach pages (Phase 1A/1B).
          Dark-themed so it reads as native content, not an ad banner. */}
      {publicMode && !personalizationScore && !isLoadingPersonalization && (
        <motion.div
          ref={teaserRef}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { delay: 0.3, type: "spring", stiffness: 300, damping: 25 }
          }
          className="mb-3"
        >
          <button
            data-testid="beach-hero-forecast-teaser"
            onClick={handleMatchScoreTeaserClick}
            className="group w-full sm:max-w-sm flex items-center gap-3 rounded-2xl
              border border-white/15 bg-[#252D6B]/80 backdrop-blur-sm
              p-3.5 shadow-sm
              hover:bg-[#252D6B]/95 hover:border-white/25 transition-colors duration-200"
          >
            <div className="flex-shrink-0 p-2 rounded-xl bg-[#F78E42]/20">
              <CalendarDays className="h-5 w-5 text-[#F78E42]" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-white">
                {teaserHeadline}
              </p>
              <p className="text-xs text-white/60 mt-0.5">{teaserSubtext}</p>
            </div>
            <div className="flex-shrink-0 text-sm font-semibold text-[#F78E42]
              group-hover:translate-x-0.5 transition-transform">
              See →
            </div>
          </button>
        </motion.div>
      )}

      {/* Ghost Match Score removed — single CTA strategy (Phase 1A) */}

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

        {/* Watchers badge moved to BeachAttributionCluster above (below
            beach name) alongside the share pill. Plan: D2. */}
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
