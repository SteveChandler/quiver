"use client";

import { useState, useCallback } from "react";
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
import { BeachIntelSection } from "@/components/intel/beach-intel-section";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useForecastCalibration } from "@/hooks/use-forecast-calibration";
import { getForecastForToday } from "@/actions/forecast-actions";
import { getBeaches } from "@/actions/beach/beach-query-actions";
import type { Profile, Forecast, Beach } from "@/types/database";

interface ForecastTabProps {
  profile: Profile | null;
  defaultBeach?: Beach | null;
}

export function ForecastTab({ profile, defaultBeach }: ForecastTabProps) {
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
    { skip: !!defaultBeach?.id }
  );

  const effectiveBeach = (defaultBeach || popularBeach) as Beach | null;
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
  } = useDataFetcher(fetchTodaysForecast, {
    // Skip until we know which beach to use
    skip: !effectiveBeach?.id,
  });

  console.log("🏖️ ForecastTab useDataFetcher result:", {
    todaysForecast,
    forecastLoading,
    forecastError,
    willShowUnavailable: !!(forecastError || !todaysForecast),
  });

  // Get calibration data for the beach
  const { beachAccuracy, getConfidenceLevel, accuracyStats } =
    useForecastCalibration({
      beachId: effectiveBeach?.id,
    });

  const confidenceLevel = getConfidenceLevel(
    beachAccuracy?.overall_accuracy_score
  );

  const handleViewBeach = () => {
    if (effectiveBeach?.id) {
      router.push(`/beach/${effectiveBeach.id}`);
    }
  };

  const handleToggleForecast = () => {
    setShowAdjusted(!showAdjusted);
  };

  if (forecastLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // While determining a fallback beach
  if (!effectiveBeach) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (forecastError || !todaysForecast) {
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
                Set your default beach in your profile to personalize your home
                feed.
              </p>
            </div>
            <Button onClick={() => router.push("/profile?edit=true")} size="sm">
              Set Default Beach
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
      {beachAccuracy && showAdjusted && (
        <AdjustedForecastDisplay
          rawForecast={todaysForecast}
          beachAccuracy={beachAccuracy}
          showComparison={true}
          className="border-2 border-blue-200"
        />
      )}

      {/* Raw Forecast Display */}
      <Card className={showAdjusted ? "opacity-75" : ""}>
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
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {todaysForecast.wave_height || "N/A"}
              </div>
              <div className="text-xs text-blue-500">Wave Height</div>
            </div>

            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-lg font-bold text-green-600">
                {todaysForecast.wind_speed || "N/A"}
              </div>
              <div className="text-xs text-green-500">Wind Speed</div>
            </div>

            <div className="text-center p-3 bg-cyan-50 rounded-lg">
              <div className="text-lg font-bold text-cyan-600">
                {todaysForecast.water_temp || "N/A"}
              </div>
              <div className="text-xs text-cyan-500">Water Temp</div>
            </div>

            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-lg font-bold text-purple-600">
                {Math.round(todaysForecast.confidence_score || 0)}%
              </div>
              <div className="text-xs text-purple-500">Confidence</div>
            </div>
          </div>

          {/* Community Trust Level */}
          {beachAccuracy && (
            <div
              className={`flex items-center justify-between p-3 rounded-lg ${confidenceLevel.bg}`}
            >
              <div className="flex items-center space-x-2">
                <confidenceLevel.icon
                  className={`h-4 w-4 ${confidenceLevel.color}`}
                />
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

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => router.push("/plan-session")}
              className="flex-1 bg-ocean-blue hover:bg-ocean-blue/90"
            >
              Plan Session
            </Button>
            <Button
              onClick={() => router.push("/log-session")}
              variant="outline"
              className="flex-1"
            >
              Log Session
            </Button>
          </div>

          {/* Local Intel for this beach */}
          <div className="mt-4">
            <BeachIntelSection
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
    </div>
  );
}
