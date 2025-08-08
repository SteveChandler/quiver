"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { SessionFormState } from "@/hooks/use-session-form";
import {
  Clock,
  Waves,
  Wind,
  Star,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OptimalTimesSectionProps {
  formState: SessionFormState;
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
}

interface OptimalTimeSlot {
  time: string;
  score: number;
  conditions: {
    waveHeight: number;
    waveQuality: string;
    windSpeed: number;
    windDirection: string;
    confidence: number;
    weatherCondition: string;
  };
  rating: "poor" | "fair" | "good" | "excellent";
  reasons: string[];
}

export function OptimalTimesSection({
  formState,
  updateField,
}: OptimalTimesSectionProps) {
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(
    formState.selectedOptimalTime || null
  );

  // Fetch optimal times when beach and date are selected
  const fetchOptimalTimes = useCallback(async () => {
    if (!formState.selectedBeachId || !formState.selectedDate) {
      return null;
    }

    const params = new URLSearchParams({
      beachId: formState.selectedBeachId,
      date: formState.selectedDate,
    });

    // Add selected time if available to filter recommendations
    if (formState.selectedTime) {
      params.append("selectedTime", formState.selectedTime);
    }

    const response = await fetch(
      `/api/session-planner/optimal-times?${params}`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch optimal times");
    }

    return response.json();
  }, [
    formState.selectedBeachId,
    formState.selectedDate,
    formState.selectedTime,
  ]);

  const { data, loading, error, refetch } = useDataFetcher(fetchOptimalTimes, {
    skip: !(formState.selectedBeachId && formState.selectedDate), // skip when missing beach ID or date
  });

  // Update form state when optimal times are loaded
  useEffect(() => {
    if (data?.success && data.data?.optimalTimes) {
      updateField("optimalTimes", data.data.optimalTimes);
    }
  }, [data, updateField]);

  // Handle time slot selection
  const handleTimeSlotSelect = useCallback(
    (timeSlot: OptimalTimeSlot) => {
      const timeValue = timeSlot.time;
      setSelectedTimeSlot(timeValue);
      updateField("selectedOptimalTime", timeValue);
      updateField("selectedTime", timeValue);
    },
    [updateField]
  );

  // Show loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Finding Optimal Times...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-destructive">
            <AlertCircle className="w-5 h-5 mr-2" />
            Unable to Load Optimal Times
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error.message ||
                "Failed to analyze surf conditions. You can still manually select a time."}
            </AlertDescription>
          </Alert>
          <Button
            variant="outline"
            onClick={refetch}
            className="mt-3"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no beach/date selected
  if (!formState.selectedBeachId || !formState.selectedDate) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm">
              Select a beach and date to see optimal surf times
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const optimalTimes = data?.data?.optimalTimes || [];

  if (optimalTimes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Optimal Times
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No forecast data available for this date. You can still plan your
              session by selecting a time manually.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Get rating colors
  const getRatingColor = (rating: string) => {
    switch (rating) {
      case "excellent":
        return "bg-green-500 text-white";
      case "good":
        return "bg-blue-500 text-white";
      case "fair":
        return "bg-yellow-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  // Get rating icon
  const getRatingIcon = (rating: string) => {
    switch (rating) {
      case "excellent":
        return <Star className="w-4 h-4" />;
      case "good":
        return <TrendingUp className="w-4 h-4" />;
      case "fair":
        return <Clock className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Clock className="w-5 h-5 mr-2 text-primary" />
            Optimal Times for {formState.selectedDate}
          </div>
          <Badge variant="outline" className="text-xs">
            {data?.data?.forecastSource === "enhanced" ? "Enhanced" : "Basic"}{" "}
            Forecast
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground mb-4">
          Based on wave conditions, wind, and forecast confidence. Tap to select
          your preferred time.
        </p>

        <div className="grid gap-3">
          {optimalTimes
            .slice(0, 4)
            .map((timeSlot: OptimalTimeSlot, index: number) => {
              const isSelected = selectedTimeSlot === timeSlot.time;
              const isTopChoice = index === 0;

              // Memoize the click handler to prevent ref loops
              const handleClick = () => handleTimeSlotSelect(timeSlot);

              return (
                <Button
                  key={timeSlot.time}
                  variant={isSelected ? "default" : "outline"}
                  className={cn(
                    "h-auto p-4 text-left justify-start relative",
                    isSelected && "ring-2 ring-primary ring-offset-2"
                  )}
                  onClick={handleClick}
                >
                  <div className="flex items-start justify-between w-full">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">
                          {new Date(
                            `2000-01-01T${timeSlot.time}`
                          ).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </span>
                        <Badge
                          className={cn(
                            "text-xs",
                            getRatingColor(timeSlot.rating)
                          )}
                        >
                          <span className="flex items-center gap-1">
                            {getRatingIcon(timeSlot.rating)}
                            {timeSlot.rating}
                          </span>
                        </Badge>
                        {isTopChoice && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="w-3 h-3 mr-1" />
                            Best
                          </Badge>
                        )}
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                        <div className="flex items-center gap-1">
                          <Waves className="w-3 h-3" />
                          {timeSlot.conditions.waveHeight}ft
                        </div>
                        <div className="flex items-center gap-1">
                          <Wind className="w-3 h-3" />
                          {timeSlot.conditions.windSpeed}mph{" "}
                          {timeSlot.conditions.windDirection}
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {timeSlot.conditions.confidence}% confidence
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {timeSlot.reasons.slice(0, 2).join(", ")}
                        {timeSlot.reasons.length > 2 && "..."}
                      </div>
                    </div>

                    <div className="ml-4 text-right">
                      <div className="text-lg font-bold text-primary">
                        {timeSlot.score}
                      </div>
                      <div className="text-xs text-muted-foreground">score</div>
                    </div>
                  </div>
                </Button>
              );
            })}
        </div>

        {optimalTimes.length > 4 && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            Showing top 4 optimal times. More conditions available in forecast.
          </p>
        )}

        <div className="pt-3 border-t">
          <p className="text-xs text-muted-foreground">
            💡 Scores are based on wave height, wind conditions, and forecast
            confidence. Higher scores indicate better surfing conditions.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
