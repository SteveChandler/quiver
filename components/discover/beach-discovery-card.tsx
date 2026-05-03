"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { ConditionCharacter } from "@/lib/scoring/types";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  MapPin,
  Waves,
  Wind,
  Clock,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getBeachUrlSafe } from "@/lib/utils/beach-url-utils";
import { formatBeachTimeRange } from "@/lib/utils/date-time";
import { formatDistanceDisplay } from "@/lib/utils/distance-utils";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";
import { useBeachPersonalization } from "@/hooks/use-beach-personalization";
import { PersonalizedBadge } from "@/components/recommendations/PersonalizedBadge";
import { MatchScoreTeaser } from "@/components/recommendations/match-score-teaser";
import { track } from "@/lib/analytics";
import { useTrackEvent } from "@/hooks/use-track-event";
import { FavoriteButton } from "@/components/favorite-button";
import { useAuth } from "@/context/auth-context";


interface BeachDiscoveryCardProps {
  recommendation: SurfDiscoveryRecommendation;
  rank: number;
  onLogSession: (beachId: string) => void;
  /** Optional personalized board-wave matching feedback from matchBoardToWaves() */
  boardReasoning?: string;
}

/**
 * MVP Beach Discovery Card
 *
 * Compact card showing ranked surf recommendation with match quality,
 * score, conditions summary, and key reasons.
 */
export function BeachDiscoveryCard({
  recommendation,
  rank,
  onLogSession,
  boardReasoning,
}: BeachDiscoveryCardProps) {
  const {
    beach,
    score,
    matchQuality,
    summary,
    reasons,
    warnings,
    window,
    distanceMiles,
    forecast,
    character,
  } = recommendation;

  const { user } = useAuth();
  const { track: trackEvent } = useTrackEvent();

  // Fetch personalized score for this beach
  const personalization = useBeachPersonalization({
    beachId: beach.id,
    baseScore: score,
    forecast,
  });

  // Track when personalized score is shown
  useEffect(() => {
    if (personalization?.data?.personalized) {
      track("personalized_score_shown", {
        beach_id: beach.id,
        score: personalization.data.score,
      });
    }
  }, [personalization?.data?.personalized, beach.id, personalization?.data?.score]);

  const displayScore = Number.isFinite(score) ? Math.round(score) : 0;
  const waveSourceLabel =
    window.dataSource === "CDIP" || window.dataSource === "NOAA_BUOY"
      ? "Live"
      : "Forecast";
  const waveSourceBadgeClass =
    waveSourceLabel === "Live"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : "bg-slate-50 text-slate-700 border-slate-200";

  // Generate URL for SEO-friendly linking with discovery tracking
  const baseUrl = getBeachUrlSafe({
    id: beach.id,
    slug: beach.slug,
    city: beach.city,
    state: beach.state,
  }) || `/beach/${beach.id}`;
  const beachUrl = baseUrl.includes("?")
    ? `${baseUrl}&from=surf_discovery`
    : `${baseUrl}?from=surf_discovery`;

  // Match quality colors — includes 'minimal' from updated MatchQuality type
  const matchQualityColors: Record<typeof matchQuality, string> = {
    perfect: "bg-green-500 text-white",
    excellent: "bg-blue-500 text-white",
    good: "bg-yellow-500 text-white",
    fair: "bg-gray-500 text-white",
    minimal: "bg-stone-400 text-white",
  };

  return (
    <Card
      className={cn(
        "w-full hover:shadow-lg transition-shadow",
        rank === 1 && "border-2 border-blue-500"
      )}
      data-testid={`discovery-card-${beach.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {rank === 1 && (
                <Badge variant="default" className="bg-blue-600">
                  Top Pick
                </Badge>
              )}
              {rank <= 3 && rank !== 1 && (
                <Badge variant="outline">#{rank}</Badge>
              )}
              <Badge
                variant="outline"
                className={cn("text-xs", waveSourceBadgeClass)}
              >
                {waveSourceLabel}
              </Badge>
              <Badge className={matchQualityColors[matchQuality]}>
                {matchQuality.charAt(0).toUpperCase() + matchQuality.slice(1)}
              </Badge>
              {user && personalization?.data?.personalized ? (
                <PersonalizedBadge
                  personalized={personalization.data.personalized}
                  score={personalization.data.score}
                  breakdown={personalization.data.breakdown}
                  size="sm"
                  // Pass character from discovery data when available.
                  // Cast is safe: SurfDiscoveryRecommendation.character uses the
                  // same shape as ConditionCharacter — category is a string union.
                  character={character as ConditionCharacter | undefined}
                />
              ) : !user ? (
                <MatchScoreTeaser beachId={beach.id} beachName={beach.name} />
              ) : null}
              <FavoriteButton
                beachId={beach.id}
                beachName={beach.name}
                variant="ghost"
                size="sm"
                className="ml-auto"
              />
            </div>
            <CardTitle className="text-xl flex items-center gap-2">
              <MapPin className="h-5 w-5 text-gray-500" />
              {beach.name}
            </CardTitle>
            {formatDistanceDisplay(distanceMiles, "full") && (
              <p className="text-sm text-gray-600 mt-1">
                {formatDistanceDisplay(distanceMiles, "full")}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600">
              {displayScore}
            </div>
            <div className="text-xs text-gray-500">match score</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary */}
        <p className="text-sm text-gray-700">{summary}</p>

        {/* Board-Wave Match Reasoning */}
        {boardReasoning && (
          <div className="mt-2 flex items-center gap-2 text-xs font-medium text-blue-700 bg-blue-50 px-3 py-1.5 rounded-md border border-blue-100">
            <span className="text-base">🏄</span>
            {boardReasoning}
          </div>
        )}

        {/* Best Window - formatted in beach local timezone */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock className="h-4 w-4" />
          <span>
            {formatBeachTimeRange(window.start, window.end, window.timezone)}
          </span>
        </div>

        {/* Conditions */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Waves className="h-4 w-4 text-blue-500" />
            <span>{window.waveHeight}</span>
          </div>
          <div className="flex items-center gap-2">
            <Wind className="h-4 w-4 text-gray-500" />
            <span>{window.wind}</span>
          </div>
        </div>

        {/* Reasons */}
        {reasons.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm font-medium text-gray-700">
              <TrendingUp className="h-4 w-4" />
              Why this spot:
            </div>
            <ul className="text-sm text-gray-600 space-y-1 pl-5">
              {reasons.slice(0, 3).map((reason, i) => (
                <li key={i} className="list-disc">
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm font-medium text-yellow-700">
              <AlertTriangle className="h-4 w-4" />
              Heads up:
            </div>
            <ul className="text-sm text-yellow-600 space-y-1 pl-5">
              {warnings.map((warning, i) => (
                <li key={i} className="list-disc">
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={() => {
              trackEvent("discovery_click", {
                beachId: beach.id,
                metadata: {
                  position: rank,
                  score_shown: displayScore,
                  action: "log_session",
                  match_quality: matchQuality,
                },
              });
              onLogSession(beach.id);
            }}
          >
            Log Session
          </Button>
          <Link
            href={beachUrl}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "flex-1 text-center"
            )}
            onClick={() => {
              trackEvent("discovery_click", {
                beachId: beach.id,
                metadata: {
                  position: rank,
                  score_shown: displayScore,
                  action: "view_beach",
                  match_quality: matchQuality,
                },
              });
            }}
          >
            View Beach
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
