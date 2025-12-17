"use client";

import React, { useEffect } from "react";
import { format } from "date-fns";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiTile } from "@/components/ui/kpi-tile";
import {
  Target,
  MapPin,
  Clock,
  Wind,
  Waves,
  Users,
  CheckCircle,
  Calendar,
  Ruler,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PersonalizedForecastRecommendation, PersonalizedInsights } from "@/types/personalization";

/**
 * Props for PersonalizedForecastCard component
 */
interface PersonalizedForecastCardProps {
  /** Personalized forecast recommendation data */
  recommendation: PersonalizedForecastRecommendation | null;
  /** Personalized insights from session history */
  insights?: PersonalizedInsights | null;
  /** Loading state for insights */
  insightsLoading?: boolean;
  /** Loading state indicator */
  loading?: boolean;
  /** Error object if fetch failed */
  error?: Error | null;
  /** Callback when user clicks "Plan Session" */
  onPlanSession: () => void;
  /** Callback when user clicks "View Beach Details" */
  onViewBeach: (beachId: string) => void;
  /** Callback when user clicks "View Similar Sessions" */
  onViewSimilarSessions?: () => void;
}

/**
 * Loading skeleton for PersonalizedForecastCard
 * Matches the structure of the main component for smooth transitions
 */
function PersonalizedForecastCardSkeleton() {
  return (
    <Card className="w-full" data-testid="personalized-forecast-card-loading">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="animate-pulse space-y-2 flex-1">
            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          </div>
          <div className="h-6 w-16 bg-gray-200 rounded-full"></div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Beach details skeleton */}
        <div className="animate-pulse space-y-2">
          <div className="h-5 bg-gray-200 rounded w-2/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>

        {/* Best window skeleton */}
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>

        {/* KPI tiles skeleton */}
        <div className="grid grid-cols-3 gap-3">
          <div className="h-24 bg-gray-200 rounded-xl animate-pulse"></div>
          <div className="h-24 bg-gray-200 rounded-xl animate-pulse"></div>
          <div className="h-24 bg-gray-200 rounded-xl animate-pulse"></div>
        </div>

        {/* Summary skeleton */}
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex gap-3 w-full animate-pulse">
          <div className="h-10 bg-gray-200 rounded flex-1"></div>
          <div className="h-10 bg-gray-200 rounded flex-1"></div>
        </div>
      </CardFooter>
    </Card>
  );
}

/**
 * Error state for PersonalizedForecastCard
 */
function PersonalizedForecastCardError({ error }: { error: Error }) {
  return (
    <Card
      className="w-full border-red-200"
      data-testid="personalized-forecast-card-error"
    >
      <CardContent className="p-6">
        <div className="text-center space-y-3">
          <div className="text-red-600 font-medium">
            Unable to Load Recommendation
          </div>
          <div className="text-sm text-gray-600">
            {error.message ||
              "An error occurred while fetching your personalized forecast."}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Format time from Date object to readable string
 */
function formatTime(date: Date): string {
  return format(date, "h:mm a");
}

/**
 * Format date range for display
 */
function formatTimeRange(start: Date, end: Date): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

/**
 * Get confidence level indicator with color
 */
function getConfidenceIndicator(confidence: number): {
  label: string;
  color: string;
  bgColor: string;
} {
  if (confidence >= 80) {
    return {
      label: "High",
      color: "text-green-600",
      bgColor: "bg-green-50",
    };
  }
  if (confidence >= 60) {
    return {
      label: "Good",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    };
  }
  if (confidence >= 40) {
    return {
      label: "Fair",
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    };
  }
  return {
    label: "Low",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  };
}

/**
 * PersonalizedForecastCard displays a personalized surf forecast recommendation
 * with optimal time window, conditions, and action buttons.
 *
 * Features:
 * - Loading skeleton state
 * - Error handling with clear messaging
 * - Personalized recommendation badge
 * - Best surf window with conditions
 * - KPI tiles for key metrics (Waves, Crowd, Match)
 * - Summary with personalization reasons
 * - Action buttons for session planning
 *
 * Memoized to prevent unnecessary re-renders when props haven't changed.
 */
export const PersonalizedForecastCard = React.memo(
  function PersonalizedForecastCard({
    recommendation,
    insights,
    insightsLoading = false,
    loading = false,
    error = null,
    onPlanSession,
    onViewBeach,
    onViewSimilarSessions,
  }: PersonalizedForecastCardProps) {
    // Handle loading state
    if (loading) {
      return <PersonalizedForecastCardSkeleton />;
    }

    // Handle error state
    if (error) {
      return <PersonalizedForecastCardError error={error} />;
    }

    // Handle no data state - don't render anything
    if (!recommendation) {
      return null;
    }

    const { beach, window, score, breakdown, summary, reasons } =
      recommendation;
    const confidenceIndicator = getConfidenceIndicator(window.confidence);

    // Calculate personalization boost (how much better than base score)
    const personalizationBoost =
      breakdown.onboardingPrefs + breakdown.learnedPrefs + breakdown.affinity;
    const boostLabel =
      personalizationBoost >= 20
        ? "Perfect"
        : personalizationBoost >= 10
        ? "Great"
        : personalizationBoost >= 5
        ? "Good"
        : "Standard";

    return (
      <Card className="w-full" data-testid="personalized-forecast-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-xl sm:text-2xl flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                Your Best Spot Today
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(window.start, "EEEE, MMM d")}
              </p>
            </div>
            <Badge
              variant="blue"
              className="shrink-0"
              data-testid="personalization-badge"
            >
              For You
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Beach Details Section */}
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  {beach.name}
                </h3>
                {beach.lat && beach.lon && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {beach.region || "California"}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewBeach(beach.id)}
              >
                Details
              </Button>
            </div>
          </div>

          {/* Best Window Section */}
          <div className="space-y-3" data-testid="best-window">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Best Window
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-blue-600 font-medium mb-1">
                      Time
                    </div>
                    <div className="text-sm font-semibold text-blue-700">
                      {formatTimeRange(window.start, window.end)}
                    </div>
                  </div>
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-cyan-50 border border-cyan-100">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-cyan-600 font-medium mb-1">
                      Tide
                    </div>
                    <div className="text-sm font-semibold text-cyan-700">
                      {window.tide}
                    </div>
                  </div>
                  <Waves className="h-5 w-5 text-cyan-500" />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-green-50 border border-green-100">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-green-600 font-medium mb-1">
                      Wind
                    </div>
                    <div className="text-sm font-semibold text-green-700">
                      {window.wind}
                    </div>
                  </div>
                  <Wind className="h-5 w-5 text-green-500" />
                </div>
              </div>

              <div
                className={cn(
                  "p-3 rounded-lg border",
                  confidenceIndicator.bgColor
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div
                      className={cn(
                        "text-xs font-medium mb-1",
                        confidenceIndicator.color
                      )}
                    >
                      Confidence
                    </div>
                    <div
                      className={cn(
                        "text-sm font-semibold",
                        confidenceIndicator.color
                      )}
                    >
                      {window.confidence}% {confidenceIndicator.label}
                    </div>
                  </div>
                  <CheckCircle
                    className={cn("h-5 w-5", confidenceIndicator.color)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* KPI Tiles Grid */}
          <div className="grid grid-cols-3 gap-3">
            <KpiTile
              value={window.waveHeight}
              label={
                <div className="space-y-0.5">
                  <div>Waves</div>
                  <div className="text-[10px] opacity-70">
                    {window.wavePeriod}
                  </div>
                </div>
              }
              className="bg-blue-50"
              valueClassName="text-blue-600"
              labelClassName="text-blue-500"
            />

            <KpiTile
              value={insights?.state === 'ready' ? insights.label : boostLabel}
              label={
                <div className="space-y-0.5">
                  <div>For You</div>
                  {insights && (
                    <div className="text-[10px] opacity-70">
                      {insights.matchPercent}% Match
                    </div>
                  )}
                </div>
              }
              className={cn(
                "bg-purple-50 transition-all",
                onViewSimilarSessions && insights?.similarSessions.length && "cursor-pointer hover:bg-purple-100"
              )}
              valueClassName="text-purple-600 text-base"
              labelClassName="text-purple-500"
              onClick={onViewSimilarSessions && insights?.similarSessions.length ? onViewSimilarSessions : undefined}
            />

            <KpiTile
              value={Math.round(score)}
              unit="%"
              label="Match"
              className="bg-green-50"
              valueClassName="text-green-600"
              labelClassName="text-green-500"
            />
          </div>

          {/* Board Tip Section */}
          {insights?.boardTip && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex items-start gap-2">
                <Ruler className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-amber-900 mb-0.5">
                    Board Recommendation
                  </p>
                  <p className="text-sm text-amber-800">
                    {insights.boardTip}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Summary Section */}
          <div className="space-y-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
            {/* Onboarding state: show first reason as helpful text */}
            {insights?.state === 'onboarding' && insights.reasonBullets.length > 0 ? (
              <div className="text-sm text-slate-700 leading-relaxed">
                <p className="font-medium mb-2">Getting to know your preferences</p>
                <p>{insights.reasonBullets[0]}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-700 leading-relaxed">{summary}</p>
            )}

            {reasons && reasons.length > 0 && (
              <ul className="space-y-1.5">
                {reasons.map((reason, index) => (
                  <li
                    key={index}
                    className="text-xs text-slate-600 flex items-start gap-2"
                  >
                    <CheckCircle className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* View Similar Sessions Link */}
            {insights?.similarSessions && insights.similarSessions.length > 0 && onViewSimilarSessions && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onViewSimilarSessions}
                className="w-full justify-between text-blue-600 hover:text-blue-700 hover:bg-blue-50 mt-2"
              >
                <span className="text-sm">
                  View {insights.similarSessions.length} similar session{insights.similarSessions.length !== 1 ? 's' : ''}
                </span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex gap-3">
          <Button
            className="flex-1"
            onClick={onPlanSession}
            data-testid="plan-session-from-personalized"
          >
            Plan Session
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onViewBeach(beach.id)}
          >
            View Forecast
          </Button>
        </CardFooter>
      </Card>
    );
  }
);
