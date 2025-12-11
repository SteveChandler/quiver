"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Waves,
  MapPin,
  Star,
  TrendingUp,
  Users,
  Info,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { AdjustedForecastDisplay } from "@/components/forecast/adjusted-forecast-display";
import { HighConfidenceIndicator } from "@/components/forecast/high-confidence-indicator";
import { KpiTile } from "@/components/ui/kpi-tile";
import { BeachIntelSection } from "@/components/intel/beach-intel-section";
import { HomeBeachBanner } from "@/components/home/HomeBeachBanner";
import { ForecastFreshnessBadge } from "@/components/ui/forecast-freshness-badge";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useForecastCalibration } from "@/hooks/use-forecast-calibration";
import { getBeaches } from "@/actions/beach/beach-query-actions";
import type { Profile, Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { ForecastDataState } from "@/types/forecast-states";
import { getForecastStateInfo } from "@/types/forecast-states";
import {
  ForecastErrorStateCard,
  ForecastLoadingSkeleton,
} from "@/components/forecast/forecast-error-state";
import { isDataStale } from "@/lib/utils/forecast-client-utils";
import { track, slugify } from "@/lib/analytics";
import { getBeachUrlSafe } from "@/lib/utils/beach-url-utils";
import { useSurfDiscovery } from "@/hooks/use-surf-discovery";
import { adaptDiscoveryResponse } from "@/lib/adapters/discovery-to-personalized";
import { PersonalizedForecastCard } from "@/components/home-screen/personalized-forecast-card";
import { BeachDiscoveryList } from "@/components/discover/beach-discovery-list";

interface ForecastTabProps {
  profile: Profile | null;
  homeBeach?: Beach | null;
  overrideBeach?: Beach | null;
}

export function ForecastTab({
  profile,
  homeBeach,
  overrideBeach,
}: ForecastTabProps) {
  const router = useRouter();

  // Fetch surf discovery with maxResults=3 to serve both PersonalizedForecastCard
  // and BeachDiscoveryList from a single API call (avoids duplicate requests)
  const {
    discovery,
    loading: discoveryLoading,
    error: discoveryError,
    hasRecommendations,
  } = useSurfDiscovery({
    maxResults: 3, // Fetch 3 recommendations - first goes to personalized card, all to list
    enabled: !!profile, // Only fetch when user has profile
    immediate: true, // Fetch on mount
  });

  // Adapt first discovery result to personalized format for PersonalizedForecastCard
  const recommendation = discovery ? adaptDiscoveryResponse(discovery) : null;
  const personalizedLoading = discoveryLoading;
  const personalizedError = discoveryError;
  const hasRecommendation = hasRecommendations;

  const [showAdjusted, setShowAdjusted] = useState(false);
  const [forecastState, setForecastState] =
    useState<ForecastDataState>("loading");
  const [forecastError, setForecastError] = useState<Error | null>(null);

  // When no home beach is set, pick a popular beach to display instead
  const fetchPopularBeach = useCallback(async () => {
    if (homeBeach?.id) {
      return null;
    }

    const result = await getBeaches();
    if (!result.success || !result.data) return null;

    const beaches = result.data as Beach[];
    // Prefer a popular SD beach; fall back progressively, then first result
    const preferredNames = [
      "Pacific Beach",
      "Ocean Beach",
      "Mission Beach",
      "La Jolla Shores",
    ];

    const byExact = preferredNames
      .map((n) => beaches.find((b) => b.name === n))
      .find(Boolean);
    if (byExact) return byExact as Beach;

    const byIncludes = preferredNames
      .map((n) =>
        beaches.find((b) => b.name.toLowerCase().includes(n.toLowerCase()))
      )
      .find(Boolean);
    return (byIncludes as Beach) || beaches[0] || null;
  }, [homeBeach?.id]);

  const { data: popularBeach, loading: popularLoading } = useDataFetcher(
    fetchPopularBeach,
    { skip: !!homeBeach?.id, initialData: null }
  );

  const effectiveBeach = (overrideBeach ||
    homeBeach ||
    popularBeach) as Beach | null;
  const isFallback = !homeBeach && !!popularBeach;
  const shouldShowHomeBeachBanner = !homeBeach && !!effectiveBeach?.id;

  // Get forecast for effective beach using the same API endpoint as beach detail page
  const fetchTodaysForecast = useCallback(async () => {
    if (!effectiveBeach?.id) {
      setForecastState("unavailable");
      return null;
    }

    setForecastState("loading");
    setForecastError(null);

    console.log(
      `🏠 Home page fetching forecast for beach: ${effectiveBeach.name} (${effectiveBeach.id})`
    );

    try {
      // Use the same API endpoint as beach detail page for consistency
      const response = await fetch(
        `/api/forecasts/update-enhanced?beachId=${effectiveBeach.id}&days=2`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        console.error(`❌ Forecast API error: ${response.status}`);

        const error = new Error(`HTTP ${response.status}`);
        (error as any).status = response.status;

        if (response.status === 429) {
          setForecastState("rate_limited");
        } else {
          setForecastState("failed");
        }

        setForecastError(error);
        return null;
      }

      const data = await response.json();

      // Extract forecasts from the API response
      const forecasts = data?.data?.forecasts || data?.forecasts || [];

      console.log(`📊 Home page received ${forecasts.length} forecasts`);

      if (forecasts.length === 0) {
        setForecastState("no_coverage");
        return null;
      }

      // Use the same time-aware selection logic as beach detail page
      const { getCurrentForecast } = await import(
        "@/lib/utils/current-forecast-utils"
      );
      const currentForecast =
        getCurrentForecast<EnhancedForecastEntity>(forecasts);

      if (currentForecast) {
        console.log(
          `✅ Home page selected forecast: ${currentForecast.forecast_time}, wave: ${currentForecast.wave_height}, updated: ${currentForecast.updated_at}`
        );

        // Check if data is stale
        const dataSource = currentForecast.data_source;
        const isStale = isDataStale(currentForecast.updated_at, dataSource);

        setForecastState(isStale ? "stale" : "available");
      }

      return currentForecast;
    } catch (error) {
      console.error("❌ Error fetching forecast for home page:", error);
      setForecastState("failed");
      setForecastError(error as Error);
      return null;
    }
  }, [effectiveBeach?.id, effectiveBeach?.name]);

  const {
    data: todaysForecast,
    loading: forecastLoading,
    error: fetchError,
    refetch,
  } = useDataFetcher<EnhancedForecastEntity | null>(fetchTodaysForecast, {
    // Skip until we know which beach to use
    skip: !effectiveBeach?.id,
    initialData: null,
  });

  // Track forecast views
  useEffect(() => {
    if (todaysForecast && effectiveBeach) {
      track("forecast_viewed", {
        beach_slug: slugify(effectiveBeach.name),
        beach_id: effectiveBeach.id,
        source: "home_tab",
        is_home_beach: !!homeBeach,
        is_override: !!overrideBeach,
      });
    }
  }, [todaysForecast, effectiveBeach, homeBeach, overrideBeach]);

  // Track personalized forecast impressions
  useEffect(() => {
    if (hasRecommendation && recommendation && profile) {
      track("personalized_forecast_impression", {
        beach_id: recommendation.beach.id,
        beach_slug: slugify(recommendation.beach.name),
        score: recommendation.score,
        personalized: recommendation.personalized,
        window_start: recommendation.window.start.toISOString(),
        window_end: recommendation.window.end.toISOString(),
        reasons_count: recommendation.reasons.length,
        source: "home_forecast_tab",
      });
    }
  }, [hasRecommendation, recommendation, profile]);

  // Avoid flashing "Unavailable" on first load; retry once if we get null
  const [retryAttempted, setRetryAttempted] = useState(false);
  useEffect(() => {
    if (
      effectiveBeach?.id &&
      !forecastLoading &&
      !fetchError &&
      !todaysForecast &&
      !retryAttempted
    ) {
      setRetryAttempted(true);
      const t = setTimeout(() => {
        refetch();
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [
    effectiveBeach?.id,
    forecastLoading,
    fetchError,
    todaysForecast,
    retryAttempted,
    refetch,
  ]);

  // Get calibration data for the beach
  const { beachAccuracy, getConfidenceLevel, accuracyStats } =
    useForecastCalibration({
      beachId: effectiveBeach?.id,
    });

  const confidenceLevel = getConfidenceLevel(
    beachAccuracy?.overall_accuracy_score
  );
  const ConfidenceIcon: any = confidenceLevel?.icon as any;

  const handleViewBeach = () => {
    if (!effectiveBeach?.id) {
      return;
    }

    const beachUrl =
      getBeachUrlSafe({
        id: effectiveBeach.id,
        slug: effectiveBeach.slug,
        city: effectiveBeach.city,
        state: effectiveBeach.state,
      }) || `/beach/${effectiveBeach.id}`;

    const urlWithSource = beachUrl.includes("?")
      ? `${beachUrl}&from=home`
      : `${beachUrl}?from=home`;

    router.push(urlWithSource);
  };

  const handleToggleForecast = () => {
    setShowAdjusted(!showAdjusted);
  };

  // Get forecast state info for display
  const forecastStateInfo = getForecastStateInfo(
    todaysForecast,
    forecastState === "stale",
    forecastError,
    forecastLoading,
    false // not refreshing here
  );

  // Handle retry
  const handleRetry = useCallback(() => {
    if (forecastStateInfo.canRetry) {
      setForecastState("loading");
      refetch();
    }
  }, [forecastStateInfo.canRetry, refetch]);

  // Handle plan session from personalized forecast
  const handlePlanSession = useCallback(() => {
    if (!recommendation?.beach?.id) return;

    // Build URL with prefill parameters
    const params = new URLSearchParams({
      mode: "plan",
      beach: recommendation.beach.id,
      beachName: recommendation.beach.name,
      startTime: recommendation.window.start.toISOString(),
      endTime: recommendation.window.end.toISOString(),
      step: "3", // Jump to Goals step
    });

    const url = `/sessions/new?${params.toString()}`;

    // Track the action
    track("personalized_forecast_plan_session", {
      beach_id: recommendation.beach.id,
      beach_slug: slugify(recommendation.beach.name),
      score: recommendation.score,
      personalized: recommendation.personalized,
      window_start: recommendation.window.start.toISOString(),
      window_end: recommendation.window.end.toISOString(),
      source: "home_forecast_tab",
    });

    router.push(url);
  }, [recommendation, router]);

  // Handle view beach details from personalized forecast
  const handleViewBeachFromPersonalized = useCallback(
    (beachId: string) => {
      if (!recommendation?.beach) return;

      // Use the same URL helper as existing handleViewBeach
      const beachUrl =
        getBeachUrlSafe({
          id: recommendation.beach.id,
          slug: recommendation.beach.slug,
          city: recommendation.beach.city,
          state: recommendation.beach.state,
        }) || `/beach/${recommendation.beach.id}`;

      const urlWithSource = beachUrl.includes("?")
        ? `${beachUrl}&from=home_personalized`
        : `${beachUrl}?from=home_personalized`;

      // Track the action
      track("personalized_forecast_view_beach", {
        beach_id: recommendation.beach.id,
        beach_slug: slugify(recommendation.beach.name),
        score: recommendation.score,
        personalized: recommendation.personalized,
        source: "home_forecast_tab",
      });

      router.push(urlWithSource);
    },
    [recommendation, router]
  );

  // Keep showing skeleton until we have a beach and either a forecast or we've attempted a retry
  if (
    popularLoading ||
    (forecastLoading && forecastState === "loading") ||
    !effectiveBeach ||
    (!todaysForecast && !retryAttempted)
  ) {
    return (
      <div data-testid="forecast-tab" className="space-y-4">
        {/* Ensure the Set Home Beach banner is available even while loading */}
        {shouldShowHomeBeachBanner && effectiveBeach && (
          <HomeBeachBanner
            selectedBeachId={effectiveBeach.id}
            selectedBeachName={effectiveBeach.name}
          />
        )}
        <ForecastLoadingSkeleton />
      </div>
    );
  }

  // Show error states using the new error state component
  if (
    !todaysForecast ||
    fetchError ||
    forecastError ||
    ["failed", "rate_limited", "no_coverage"].includes(forecastState)
  ) {
    return (
      <div data-testid="forecast-tab" className="space-y-4">
        {shouldShowHomeBeachBanner && (
          <HomeBeachBanner
            selectedBeachId={effectiveBeach.id}
            selectedBeachName={effectiveBeach.name}
          />
        )}
        <ForecastErrorStateCard
          state={forecastState}
          stateInfo={forecastStateInfo}
          onRetry={forecastStateInfo.canRetry ? handleRetry : undefined}
        />
        {effectiveBeach && (
          <div className="flex justify-center">
            <Button onClick={handleViewBeach} variant="outline">
              View {effectiveBeach.name} Details
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid="forecast-tab"
      id="forecast-tab-content"
      className="space-y-4"
    >
      {/* Show home beach banner when no beach is set or using fallback */}
      {shouldShowHomeBeachBanner && (
        <HomeBeachBanner
          selectedBeachId={effectiveBeach.id}
          selectedBeachName={effectiveBeach.name}
        />
      )}
      {/* Personalized Forecast Recommendation */}
      {profile && (
        <PersonalizedForecastCard
          recommendation={recommendation}
          loading={personalizedLoading}
          error={personalizedError ? new Error(personalizedError) : null}
          onPlanSession={handlePlanSession}
          onViewBeach={handleViewBeachFromPersonalized}
        />
      )}
      {/* Surf Discovery - Top Spots for You (uses same data as personalized card) */}
      {profile && (
        <BeachDiscoveryList
          discoveryData={discovery}
          isLoading={discoveryLoading}
          errorMessage={discoveryError}
        />
      )}

      {/* Beach Header */}
      <Card className="bg-gradient-to-r from-ocean-blue to-blue-500 text-white rounded-lg border-0 shadow-md">
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="flex items-center justify-between text-xl font-roboto font-bold">
            <div className="flex items-center space-x-2">
              <MapPin className="h-5 w-5" />
              <span>{effectiveBeach.name}</span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleViewBeach}
              className="text-ocean-blue h-9 px-4 text-sm font-semibold hover:bg-white/90 transition-all"
            >
              View Details
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Community-Adjusted Forecast - only show when we have real session data */}
      {beachAccuracy && (beachAccuracy.total_sessions_count ?? 0) > 0 && (
        <div className="space-y-2">
          {!showAdjusted && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Star className="h-3 w-3 text-yellow-500" />
              <span>Community-calibrated forecast (more accurate)</span>
            </div>
          )}
          <AdjustedForecastDisplay
            rawForecast={todaysForecast}
            beachAccuracy={beachAccuracy}
            showComparison={showAdjusted}
            compact={!showAdjusted}
            className={showAdjusted ? "border-2 border-blue-200" : ""}
          />
        </div>
      )}

      {/* Raw Forecast Display - only show when no real calibration data or when user wants to see comparison */}
      {(!beachAccuracy ||
        (beachAccuracy.total_sessions_count ?? 0) === 0 ||
        showAdjusted) && (
        <Card
          className={
            showAdjusted &&
            beachAccuracy &&
            (beachAccuracy.total_sessions_count ?? 0) > 0
              ? "opacity-75"
              : ""
          }
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <Waves className="h-5 w-5 text-blue-500" />
                <span>Today&apos;s Forecast</span>
                {!showAdjusted && (
                  <Badge variant="outline" className="text-xs">
                    Raw Data
                  </Badge>
                )}
                <HighConfidenceIndicator
                  confidence={todaysForecast?.confidence_score || 0}
                />
              </div>

              <div className="flex items-center gap-2">
                {todaysForecast?.updated_at && (
                  <ForecastFreshnessBadge
                    updatedAt={todaysForecast.updated_at}
                    onRefresh={refetch}
                    isRefreshing={forecastLoading}
                    showRefreshButton={true}
                  />
                )}
                {beachAccuracy &&
                  (beachAccuracy.total_sessions_count ?? 0) > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleToggleForecast}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      {showAdjusted ? "Show Raw" : "Show Adjusted"}
                    </Button>
                  )}
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Main forecast data */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Wave Height */}
              {(() => {
                const raw = (todaysForecast?.wave_height || "").toString();
                const match = raw && raw.match(/([\d.]+)/);
                const value = match ? Number(match[1]).toFixed(1) : "—";
                const unit = match ? "ft" : undefined;
                return (
                  <KpiTile
                    value={value}
                    unit={unit}
                    label={<span>Wave Height</span>}
                    className="bg-blue-50"
                    valueClassName="text-blue-600"
                    labelClassName="text-blue-500"
                  />
                );
              })()}

              {/* Wind Speed */}
              {(() => {
                const raw = (todaysForecast?.wind_speed || "").toString();
                const match = raw && raw.match(/([\d.]+)/);
                const value = match ? Number(match[1]).toFixed(0) : "—";
                const unit =
                  match && raw
                    ? raw.toLowerCase().includes("mph")
                      ? "mph"
                      : raw.toLowerCase().includes("kts")
                      ? "kts"
                      : undefined
                    : undefined;
                return (
                  <KpiTile
                    value={value}
                    unit={unit}
                    label={<span>Wind Speed</span>}
                    className="bg-green-50"
                    valueClassName="text-green-600"
                    labelClassName="text-green-500"
                  />
                );
              })()}

              {/* Water Temp */}
              {(() => {
                const raw = (todaysForecast?.water_temp || "").toString();
                const match = raw && raw.match(/([\d.]+)/);
                const value = match ? Number(match[1]).toFixed(0) : "—";
                const unit =
                  match && raw
                    ? raw.includes("°")
                      ? raw.slice(raw.indexOf("°"))
                      : raw.toLowerCase().includes("f")
                      ? "°F"
                      : raw.toLowerCase().includes("c")
                      ? "°C"
                      : undefined
                    : undefined;
                return (
                  <KpiTile
                    value={value}
                    unit={unit}
                    label={<span>Water Temp</span>}
                    className="bg-cyan-50"
                    valueClassName="text-cyan-600"
                    labelClassName="text-cyan-500"
                  />
                );
              })()}

              {/* Confidence */}
              {(() => {
                const num = Math.round(todaysForecast?.confidence_score || 0);
                return (
                  <KpiTile
                    value={num}
                    unit="%"
                    label={<span>Confidence</span>}
                    className="bg-purple-50"
                    valueClassName="text-purple-600"
                    labelClassName="text-purple-500"
                  />
                );
              })()}
            </div>

            {/* Community Trust Level */}
            {beachAccuracy && confidenceLevel?.level !== "unknown" && (
              <div
                className={`flex items-center justify-between p-3 rounded-lg ${confidenceLevel.bg}`}
              >
                <div className="flex items-center space-x-2">
                  <span className={`font-medium ${confidenceLevel.color}`}>
                    Community Trust: {confidenceLevel.level}
                  </span>
                </div>

                <div className="flex items-center space-x-4 text-xs text-gray-600">
                  <div className="flex items-center space-x-1">
                    <Users className="h-3 w-3" />
                    <span>{accuracyStats?.totalSessions || 0} sessions</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <TrendingUp className="h-3 w-3" />
                    <span>
                      {Math.round(beachAccuracy.overall_accuracy_score || 0)}%
                      accurate
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Local Intel for this beach */}
            <div className="mt-4">
              {(() => {
                const lat = effectiveBeach.lat ?? 0;
                const lon = effectiveBeach.lon ?? 0;

                // Warn in development if coordinates look suspicious
                if (
                  process.env.NODE_ENV === "development" &&
                  (lat === 0 || lon === 0)
                ) {
                  console.warn(
                    `⚠️ ForecastTab: Beach ${effectiveBeach.name} has zero coordinates`
                  );
                  console.warn(`  Beach ID: ${effectiveBeach.id}`);
                  console.warn(`  Latitude: ${lat}`);
                  console.warn(`  Longitude: ${lon}`);
                }

                return (
                  <BeachIntelSection
                    key={`intel-${effectiveBeach.id}`}
                    beachId={effectiveBeach.id}
                    beachName={effectiveBeach.name}
                    latitude={lat}
                    longitude={lon}
                    className="border-0 p-0"
                  />
                );
              })()}
            </div>

            {/* Encourage feedback if no accuracy data */}
            {!beachAccuracy && (
              <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200 mt-4">
                <Star className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
                <p className="text-sm text-yellow-700 font-medium mb-1">
                  Help Improve Forecast Accuracy!
                </p>
                <p className="text-xs text-yellow-600">
                  Log your surf sessions to help calibrate forecasts for this
                  beach
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
