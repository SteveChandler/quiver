"use client";

import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { Badge } from "@/components/ui/badge";
import { WaveHeightDisplay } from "@/components/ui/wave-height-display";

// Generic forecast type that can accept both EnhancedForecast and EnhancedForecastEntity
type ForecastData = EnhancedForecastEntity | any; // Allow any to support both types

interface ForecastTableProps {
  forecasts: ForecastData[];
  variant?: "standard" | "simplified";
  className?: string;
}

interface ForecastDayTableProps {
  forecasts: ForecastData[];
  date: string;
  isExpanded: boolean;
  onToggle: () => void;
  isToday: boolean;
  variant: "standard" | "simplified";
}

// Helper function to get normalized date string (YYYY-MM-DD) in user's timezone
function getNormalizedDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Helper function to get current date in user's timezone
function getCurrentDate(): string {
  return getNormalizedDateString(new Date());
}

// Helper function to get tomorrow's date in user's timezone
function getTomorrowDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getNormalizedDateString(tomorrow);
}

// Helper function to check if a date string is today
function isDateToday(dateString: string): boolean {
  return dateString === getCurrentDate();
}

// Helper function to check if a date string is tomorrow
function isDateTomorrow(dateString: string): boolean {
  return dateString === getTomorrowDate();
}

// Helper function to format date string for display
function formatDate(dateString: string): string {
  const date = createDateFromString(dateString);
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
  });
}

// Helper function to format date string into proper Date object
function createDateFromString(dateString: string): Date {
  // Handle both YYYY-MM-DD and ISO date formats
  if (dateString.includes("T")) {
    return new Date(dateString);
  }

  // For YYYY-MM-DD format, create date at local midnight
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function ForecastDayTable({
  forecasts,
  date,
  isExpanded,
  onToggle,
  isToday,
  variant,
}: ForecastDayTableProps) {
  const dateObj = createDateFromString(date);

  // Get key times of day (6am, Noon, 6pm) or closest available
  const getKeyTimeForecasts = () => {
    const keyTimes = [6, 12, 18]; // 6am, 12pm, 6pm

    return keyTimes
      .map((targetHour) => {
        // Find closest forecast to target hour
        const closest = forecasts.reduce((prev, current) => {
          const prevHour = parseInt(prev.forecast_time.split(":")[0]);
          const currentHour = parseInt(current.forecast_time.split(":")[0]);

          const prevDiff = Math.abs(prevHour - targetHour);
          const currentDiff = Math.abs(currentHour - targetHour);

          return currentDiff < prevDiff ? current : prev;
        });

        return closest;
      })
      .filter(
        (forecast, index, arr) =>
          // Remove duplicates
          arr.findIndex((f) => f.id === forecast.id) === index
      );
  };

  const keyForecasts = getKeyTimeForecasts();
  const displayForecasts = isExpanded ? forecasts : keyForecasts;

  const formatTime = (timeString: string) => {
    const [hours] = timeString.split(":").map(Number);
    if (hours === 0) return "Midnight";
    if (hours === 6) return "6am";
    if (hours === 12) return "Noon";
    if (hours === 18) return "6pm";
    if (hours < 12) return `${hours}am`;
    return `${hours - 12}pm`;
  };

  const getDirectionArrow = (direction: string | null) => {
    if (!direction) return "•";

    const dir = direction.toLowerCase();
    const directions: Record<string, string> = {
      n: "↑",
      nne: "↗",
      ne: "↗",
      ene: "↗",
      e: "→",
      ese: "↘",
      se: "↘",
      sse: "↘",
      s: "↓",
      ssw: "↙",
      sw: "↙",
      wsw: "↙",
      w: "←",
      wnw: "↖",
      nw: "↖",
      nnw: "↖",
    };

    return directions[dir] || "•";
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 75) return "text-green-600";
    if (confidence >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getConfidenceTextColor = (confidence: number) => {
    if (confidence >= 75) return "text-green-700";
    if (confidence >= 50) return "text-yellow-700";
    return "text-red-700";
  };

  const getConfidenceBarColor = (confidence: number) => {
    if (confidence >= 75) return "bg-green-500";
    if (confidence >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const formatHeight = (height: string | null) => {
    return height || "N/A";
  };

  const formatPeriod = (period: string | null) => {
    return period ? period.replace(/s$/, "s") : "N/A";
  };

  const formatDayLabel = () => {
    if (isDateToday(date)) return "Today";
    if (isDateTomorrow(date)) return "Tomorrow";

    return dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "numeric",
      day: "numeric",
    });
  };

  const getConsistencyRating = (confidence: number) => {
    if (confidence >= 75) return "Excellent";
    if (confidence >= 50) return "Fair";
    return "Poor";
  };

  const getWeatherIcon = (condition: string) => {
    const lower = condition.toLowerCase();
    if (lower.includes("sunny") || lower.includes("clear")) return "☀️";
    if (lower.includes("partly cloudy") || lower.includes("scattered"))
      return "⛅";
    if (lower.includes("cloudy") || lower.includes("overcast")) return "☁️";
    if (lower.includes("rain") || lower.includes("shower")) return "🌧️";
    if (lower.includes("storm") || lower.includes("thunder")) return "⛈️";
    if (lower.includes("fog") || lower.includes("mist")) return "🌫️";
    if (lower.includes("wind")) return "💨";
    return "🌤️";
  };

  return (
    <div className="space-y-2">
      {/* Day Header */}
      <div
        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span className="font-semibold">{formatDayLabel()}</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {forecasts.length} forecast{forecasts.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {(isExpanded || isToday) && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-card rounded-lg border border-border">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                  Time
                </th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                  Surf (ft)
                </th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                  Primary Swell
                </th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                  Secondary Swell
                </th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                  Wind
                </th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                  Weather
                </th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                  {variant === "simplified" ? "Consistency" : "Confidence"}
                </th>
              </tr>
            </thead>
            <tbody>
              {displayForecasts.map((forecast, index) => (
                <tr
                  key={forecast.id}
                  className={`border-b border-border hover:bg-muted/50 ${
                    index % 2 === 0 ? "bg-card" : "bg-muted/30"
                  }`}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-8 bg-blue-500 rounded-full" />
                      <span className="font-medium text-sm text-foreground">
                        {formatTime(forecast.forecast_time)}
                      </span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-md font-bold text-center min-w-[60px] text-sm">
                      <WaveHeightDisplay 
                        height={forecast.wave_height} 
                        showTooltip={true}
                        className="text-inherit"
                      />
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">
                        {formatHeight(forecast.swell_1_height)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatPeriod(forecast.swell_1_period)}
                      </span>
                      <span className="text-lg">
                        {getDirectionArrow(forecast.swell_1_direction)}
                      </span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">
                        {formatHeight(forecast.swell_2_height)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatPeriod(forecast.swell_2_period)}
                      </span>
                      <span className="text-lg">
                        {getDirectionArrow(forecast.swell_2_direction)}
                      </span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">
                        {forecast.wind_speed}
                      </span>
                      <span className="text-lg">
                        {getDirectionArrow(forecast.wind_direction)}
                      </span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">
                        {getWeatherIcon(forecast.weather_condition)}
                      </span>
                      <div className="text-xs">
                        <div className="font-medium text-foreground">
                          {forecast.air_temperature}
                        </div>
                        <div className="text-muted-foreground">
                          {forecast.water_temp}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    {variant === "simplified" ? (
                      <Badge
                        variant={
                          forecast.confidence_score >= 75
                            ? "default"
                            : forecast.confidence_score >= 50
                            ? "secondary"
                            : "destructive"
                        }
                        className="text-xs"
                      >
                        {getConsistencyRating(forecast.confidence_score)}
                      </Badge>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-3 h-3 rounded-full ${getConfidenceBarColor(
                            forecast.confidence_score
                          )}`}
                        />
                        <span
                          className={`text-xs font-medium ${getConfidenceTextColor(
                            forecast.confidence_score
                          )}`}
                        >
                          {forecast.confidence_score}%
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ForecastTable({
  forecasts,
  variant = "standard",
  className,
}: ForecastTableProps) {
  const [expandedDates, setExpandedDates] = React.useState<Set<string>>(
    new Set()
  );

  // Group forecasts by date
  const groupedForecasts = React.useMemo(() => {
    const grouped: Record<string, ForecastData[]> = {};

    forecasts.forEach((forecast) => {
      const date = forecast.forecast_date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(forecast);
    });

    // Sort dates and ensure today is expanded by default
    const sortedDates = Object.keys(grouped).sort();
    const today = getCurrentDate();
    if (sortedDates.includes(today)) {
      setExpandedDates(new Set([today]));
    }

    return grouped;
  }, [forecasts]);

  // Update expanded dates when grouped forecasts change
  React.useEffect(() => {
    const sortedDates = Object.keys(groupedForecasts).sort();
    const today = getCurrentDate();

    if (sortedDates.includes(today) && expandedDates.size === 0) {
      setExpandedDates(new Set([today]));
    }
  }, [groupedForecasts, expandedDates.size]);

  const handleToggle = (date: string) => {
    setExpandedDates((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  const sortedDates = Object.keys(groupedForecasts).sort();

  if (forecasts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No forecast data available</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className || ""}`}>
      {sortedDates.map((date) => (
        <ForecastDayTable
          key={date}
          forecasts={groupedForecasts[date]}
          date={date}
          isExpanded={expandedDates.has(date)}
          onToggle={() => handleToggle(date)}
          isToday={isDateToday(date)}
          variant={variant}
        />
      ))}
    </div>
  );
}

// Export with backward compatible names
export const MultiDayForecastTable = (
  props: Omit<ForecastTableProps, "variant">
) => <ForecastTable {...props} variant="standard" />;

export const SimplifiedForecastTable = (
  props: Omit<ForecastTableProps, "variant">
) => <ForecastTable {...props} variant="simplified" />;
