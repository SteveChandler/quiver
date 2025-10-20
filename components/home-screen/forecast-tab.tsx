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
import { track, slugify } from "@/lib/analytics";

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
  const [showAdjusted, setShowAdjusted] = useState(false);

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
      return null;
    }

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
        return null;
      }

      const data = await response.json();

      // Extract forecasts from the API response
      const forecasts = data?.data?.forecasts || data?.forecasts || [];

      console.log(`📊 Home page received ${forecasts.length} forecasts`);

      if (forecasts.length === 0) {
        return null;
      }

      // Use the same time-aware selection logic as beach detail page
      const { getCurrentForecast } = await import(
        "@/lib/utils/current-forecast-utils"
      );
      const currentForecast = getCurrentForecast(forecasts);

      if (currentForecast) {
        console.log(
          `✅ Home page selected forecast: ${currentForecast.forecast_time}, wave: ${currentForecast.wave_height}, updated: ${currentForecast.updated_at}`
        );
      }

      return currentForecast;
    } catch (error) {
      console.error("❌ Error fetching forecast for home page:", error);
      return null;
    }
  }, [effectiveBeach?.id, effectiveBeach?.name]);

  const {
    data: todaysForecast,
    loading: forecastLoading,
    error: forecastError,
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

  // Avoid flashing "Unavailable" on first load; retry once if we get null
  const [retryAttempted, setRetryAttempted] = useState(false);
  useEffect(() => {
    if (
      effectiveBeach?.id &&
      !forecastLoading &&
      !forecastError &&
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
    forecastError,
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
    if (effectiveBeach?.id) {
      router.push(`/beach/${effectiveBeach.id}?from=home`);
    }
  };

  const handleToggleForecast = () => {
    setShowAdjusted(!showAdjusted);
  };

  // Keep showing skeleton until we have a beach and either a forecast or we've attempted a retry
  if (
    popularLoading ||
    forecastLoading ||
    !effectiveBeach ||
    (!todaysForecast && !retryAttempted)
  ) {
    return (
      <div data-testid="forecast-tab" className="space-y-4">
        {/* Ensure the Set Home Beach banner is available even while loading */}
        {shouldShowHomeBeachBanner && (
          <HomeBeachBanner
            selectedBeachId={effectiveBeach.id}
            selectedBeachName={effectiveBeach.name}
          />
        )}
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!todaysForecast || forecastError) {
    return (
      <div data-testid="forecast-tab">
        <Card>
          <CardContent className="p-6 text-center">
            <Info className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              Forecast Unavailable
            </h3>
            <p className="text-gray-500 mb-4">
              No forecast data available for {effectiveBeach.name} today
            </p>
            <Button onClick={handleViewBeach} variant="outline">
              View Beach Details
            </Button>
          </CardContent>
        </Card>
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
      {/* Beach Header */}
      <Card className="bg-gradient-to-r from-ocean-blue to-blue-500 text-white">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MapPin className="h-5 w-5" />
              <span>{effectiveBeach.name}</span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleViewBeach}
              className="text-ocean-blue"
            >
              View Details
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Community-Adjusted Forecast */}
      {beachAccuracy && (
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

      {/* Raw Forecast Display - only show when no accuracy data or when user wants to see comparison */}
      {(!beachAccuracy || showAdjusted) && (
        <Card className={showAdjusted && beachAccuracy ? "opacity-75" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <Waves className="h-5 w-5 text-blue-500" />
                <span>Today's Forecast</span>
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
                {beachAccuracy && (
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
              <BeachIntelSection
                key={`intel-${effectiveBeach.id}`}
                beachId={effectiveBeach.id}
                beachName={effectiveBeach.name}
                latitude={effectiveBeach.latitude}
                longitude={effectiveBeach.longitude}
                className="border-0 p-0"
              />
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
