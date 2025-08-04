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
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useForecastCalibration } from "@/hooks/use-forecast-calibration";
import { getForecastForToday } from "@/actions/forecast-actions";
import type { Profile, Forecast, Beach } from "@/types/database";

interface ForecastTabProps {
  profile: Profile | null;
  defaultBeach?: Beach | null;
}

export function ForecastTab({ profile, defaultBeach }: ForecastTabProps) {
  const router = useRouter();
  const [showAdjusted, setShowAdjusted] = useState(false);

  // Get forecast for default beach
  const fetchTodaysForecast = useCallback(async () => {
    console.log("🌊 ForecastTab fetchTodaysForecast called:", {
      hasDefaultBeach: !!defaultBeach,
      beachId: defaultBeach?.id,
      beachName: defaultBeach?.name,
    });

    if (!defaultBeach?.id) {
      console.log("❌ No defaultBeach.id, returning null");
      return null;
    }

    console.log(
      "📞 Calling getForecastForToday with beachId:",
      defaultBeach.id
    );
    const result = await getForecastForToday(defaultBeach.id);
    console.log("📊 getForecastForToday result:", result);
    return result;
  }, [defaultBeach?.id]);

  const {
    data: todaysForecast,
    loading: forecastLoading,
    error: forecastError,
  } = useDataFetcher(fetchTodaysForecast);

  console.log("🏖️ ForecastTab useDataFetcher result:", {
    todaysForecast,
    forecastLoading,
    forecastError,
    willShowUnavailable: !!(forecastError || !todaysForecast),
  });

  // Get calibration data for the beach
  const { beachAccuracy, getConfidenceLevel, accuracyStats } =
    useForecastCalibration({
      beachId: defaultBeach?.id,
    });

  const confidenceLevel = getConfidenceLevel(
    beachAccuracy?.overall_accuracy_score
  );

  const handleViewBeach = () => {
    if (defaultBeach?.id) {
      router.push(`/beach/${defaultBeach.id}`);
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

  if (!defaultBeach) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Waves className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">
            No Default Beach Set
          </h3>
          <p className="text-gray-500 mb-4">
            Set a default beach in your profile to see personalized forecasts
          </p>
          <Button
            onClick={() => router.push("/profile/edit")}
            className="bg-ocean-blue hover:bg-ocean-blue/90"
          >
            Set Default Beach
          </Button>
        </CardContent>
      </Card>
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
            No forecast data available for {defaultBeach.name} today
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
      {/* Beach Header */}
      <Card className="bg-gradient-to-r from-ocean-blue to-blue-500 text-white">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MapPin className="h-5 w-5" />
              <span>{defaultBeach.name}</span>
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

          {/* Encourage feedback if no accuracy data */}
          {!beachAccuracy && (
            <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <Star className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
              <p className="text-sm text-yellow-700 font-medium mb-1">
                Help Build Community Forecasts!
              </p>
              <p className="text-xs text-yellow-600">
                Log sessions and provide feedback to improve forecast accuracy
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
