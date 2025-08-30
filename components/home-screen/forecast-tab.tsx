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
import { KpiTile } from "@/components/ui/kpi-tile";
import { BeachIntelSection } from "@/components/intel/beach-intel-section";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useForecastCalibration } from "@/hooks/use-forecast-calibration";
import { getForecastForToday } from "@/actions/forecast-actions";
import { getBeaches } from "@/actions/beach/beach-query-actions";
import type { Profile, Forecast, Beach } from "@/types/database";

interface ForecastTabProps {
  profile: Profile | null;
  defaultBeach?: Beach | null;
  overrideBeach?: Beach | null;
}

export function ForecastTab({
  profile,
  defaultBeach,
  overrideBeach,
}: ForecastTabProps) {
  const router = useRouter();
  const [showAdjusted, setShowAdjusted] = useState(false);

  // When no default beach is set, pick a popular beach to display instead
  const fetchPopularBeach = useCallback(async () => {
    if (defaultBeach?.id) {
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
  }, [defaultBeach?.id]);

  const { data: popularBeach, loading: popularLoading } = useDataFetcher(
    fetchPopularBeach,
    { skip: !!defaultBeach?.id, initialData: null }
  );

  const effectiveBeach = (overrideBeach ||
    defaultBeach ||
    popularBeach) as Beach | null;
  const isFallback = !defaultBeach && !!popularBeach;

  // Get forecast for effective beach
  const fetchTodaysForecast = useCallback(async () => {
    console.log("🌊 ForecastTab fetchTodaysForecast called:", {
      hasDefaultBeach: !!defaultBeach,
      usingFallback: isFallback,
      beachId: effectiveBeach?.id,
      beachName: effectiveBeach?.name,
    });

    if (!effectiveBeach?.id) {
      console.log("❌ No defaultBeach.id, returning null");
      return null;
    }

    console.log(
      "📞 Calling getForecastForToday with beachId:",
      effectiveBeach.id
    );
    const result = await getForecastForToday(effectiveBeach.id);
    console.log("📊 getForecastForToday result:", result);
    return result;
  }, [effectiveBeach?.id, isFallback, defaultBeach]);

  const {
    data: todaysForecast,
    loading: forecastLoading,
    error: forecastError,
    refetch,
  } = useDataFetcher(fetchTodaysForecast, {
    // Skip until we know which beach to use
    skip: !effectiveBeach?.id,
    initialData: null,
  });

  console.log("🏖️ ForecastTab useDataFetcher result:", {
    todaysForecast,
    forecastLoading,
    forecastError,
    willShowUnavailable: !!(forecastError || !todaysForecast),
  });

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
      router.push(`/beach/${effectiveBeach.id}`);
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
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!todaysForecast || forecastError) {
    return (
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
    );
  }

  return (
    <div className="space-y-4">
      {isFallback && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="text-left">
              <p className="text-sm font-medium">
                Showing popular beach forecast
              </p>
              <p className="text-xs text-muted-foreground">
                Set your home beach in your profile to personalize your home
                feed.
              </p>
            </div>
            <Button onClick={() => router.push("/profile?edit=true")} size="sm">
              Set Home Beach
            </Button>
          </CardContent>
        </Card>
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
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Waves className="h-5 w-5 text-blue-500" />
                <span>Today's Forecast</span>
                {!showAdjusted && (
                  <Badge variant="outline" className="text-xs">
                    Raw Data
                  </Badge>
                )}
              </div>

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
                const unit = match && raw
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
                const unit = match && raw
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
