"use client";

import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { Badge } from "@/components/ui/badge";

interface SimplifiedForecastTableProps {
  forecasts: EnhancedForecastEntity[];
}

interface ForecastTableProps {
  forecasts: EnhancedForecastEntity[];
  date: string;
  isExpanded: boolean;
  onToggle: () => void;
  isToday: boolean;
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

function ForecastTable({
  forecasts,
  date,
  isExpanded,
  onToggle,
  isToday,
}: ForecastTableProps) {
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
    if (hours === 6) return "6am";
    if (hours === 12) return "Noon";
    if (hours === 18) return "6pm";

    const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const period = hours < 12 ? "am" : "pm";
    return `${hour12}${period}`;
  };

  const getDirectionArrow = (direction: string | null) => {
    if (!direction) return "→";

    const directionMap: Record<string, string> = {
      N: "↑",
      NNE: "↗",
      NE: "↗",
      ENE: "↗",
      E: "→",
      ESE: "↘",
      SE: "↘",
      SSE: "↘",
      S: "↓",
      SSW: "↙",
      SW: "↙",
      WSW: "↙",
      W: "←",
      WNW: "↖",
      NW: "↖",
      NNW: "↖",
    };

    return directionMap[direction] || "→";
  };

  const formatHeight = (height: string | null) => {
    if (!height) return "-";
    return height;
  };

  const formatPeriod = (period: string | null) => {
    if (!period) return "-";
    return period.replace("s", "s");
  };

  const formatDayLabel = () => {
    if (isDateToday(date)) return "Today";
    if (isDateTomorrow(date)) return "Tomorrow";

    // For other dates, show full format
    return dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "numeric",
      day: "numeric",
    });
  };

  const getConsistencyRating = (confidence: number) => {
    if (confidence >= 90) return "Excellent";
    if (confidence >= 80) return "Good";
    if (confidence >= 70) return "Fair";
    if (confidence >= 60) return "Poor";
    return "Very Poor";
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "bg-green-500";
    if (confidence >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getConfidenceTextColor = (confidence: number) => {
    if (confidence >= 80) return "text-green-700";
    if (confidence >= 60) return "text-yellow-700";
    return "text-red-700";
  };

  const getConfidenceBarColor = (confidence: number) => {
    if (confidence >= 80) return "bg-green-600";
    if (confidence >= 60) return "bg-yellow-600";
    return "bg-red-600";
  };

  const getWeatherIcon = (condition: string) => {
    const lowerCondition = condition.toLowerCase();
    if (lowerCondition.includes("sunny") || lowerCondition.includes("clear"))
      return "☀️";
    if (lowerCondition.includes("cloud")) return "☁️";
    if (lowerCondition.includes("rain")) return "🌧️";
    if (lowerCondition.includes("storm")) return "⛈️";
    return "🌤️";
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div
        className="flex items-center justify-between cursor-pointer group"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-gray-900">
              {formatDayLabel()}
            </span>
            {isToday && (
              <Badge
                variant="secondary"
                className="text-xs px-2 py-0.5 bg-primary/10 text-primary border-primary/20"
              >
                Today
              </Badge>
            )}
          </div>
          {isToday && (
            <div className="text-xs text-gray-600">({formatDate(date)})</div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Wave Height Summary */}
          {forecasts.length > 0 && (
            <div className="text-sm text-gray-600 hidden sm:block">
              {(() => {
                const heights = forecasts
                  .map((f) => parseFloat(f.wave_height || "0"))
                  .filter((h) => h > 0);
                if (heights.length === 0) return "No data";
                const min = Math.min(...heights);
                const max = Math.max(...heights);
                return min === max ? `${min} ft` : `${min}-${max} ft`;
              })()}
            </div>
          )}

          {/* Avg Confidence */}
          {forecasts.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 hidden md:inline">
                Avg Confidence:
              </span>
              <div className="flex items-center gap-1">
                <span
                  className={`text-xs font-medium ${getConfidenceTextColor(
                    Math.round(
                      forecasts.reduce(
                        (sum, f) => sum + f.confidence_score,
                        0
                      ) / forecasts.length
                    )
                  )}`}
                >
                  {getConsistencyRating(
                    Math.round(
                      forecasts.reduce(
                        (sum, f) => sum + f.confidence_score,
                        0
                      ) / forecasts.length
                    )
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  (
                  {Math.round(
                    forecasts.reduce((sum, f) => sum + f.confidence_score, 0) /
                      forecasts.length
                  )}
                  %)
                </span>
              </div>
            </div>
          )}

          <ChevronDown
            className={`h-4 w-4 text-gray-600 transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {isExpanded && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left p-3 text-sm font-medium text-gray-600">
                  Time
                </th>
                <th className="text-left p-3 text-sm font-medium text-gray-600">
                  Height
                </th>
                <th className="text-left p-3 text-sm font-medium text-gray-600">
                  Primary Swell
                </th>
                <th className="text-left p-3 text-sm font-medium text-gray-600">
                  Secondary Swell
                </th>
                <th className="text-left p-3 text-sm font-medium text-gray-600">
                  Wind
                </th>
                <th className="text-left p-3 text-sm font-medium text-gray-600">
                  Weather
                </th>
                <th className="text-left p-3 text-sm font-medium text-gray-600">
                  Probability
                </th>
              </tr>
            </thead>
            <tbody>
              {displayForecasts.map((forecast, index) => (
                <tr
                  key={forecast.id}
                  className={`border-b border-gray-200 hover:bg-gray-50 ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
                  }`}
                >
                  {/* Time */}
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
                      <span className="font-medium text-sm text-gray-900">
                        {formatTime(forecast.forecast_time)}
                      </span>
                    </div>
                  </td>

                  {/* Surf Height */}
                  <td className="p-3">
                    <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-md font-bold text-center min-w-[60px] text-sm">
                      {formatHeight(forecast.wave_height)}
                    </div>
                  </td>

                  {/* Primary Swell */}
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">
                        {formatHeight(forecast.swell_1_height)}
                      </span>
                      <span className="text-xs text-gray-600">
                        {formatPeriod(forecast.swell_1_period)}
                      </span>
                      <span className="text-lg">
                        {getDirectionArrow(forecast.swell_1_direction)}
                      </span>
                    </div>
                  </td>

                  {/* Secondary Swell */}
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">
                        {formatHeight(forecast.swell_2_height)}
                      </span>
                      <span className="text-xs text-gray-600">
                        {formatPeriod(forecast.swell_2_period)}
                      </span>
                      <span className="text-lg">
                        {getDirectionArrow(forecast.swell_2_direction)}
                      </span>
                    </div>
                  </td>

                  {/* Wind */}
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">
                        {forecast.wind_speed}
                      </span>
                      <span className="text-lg">
                        {getDirectionArrow(forecast.wind_direction)}
                      </span>
                    </div>
                  </td>

                  {/* Weather */}
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">
                        {getWeatherIcon(forecast.weather_condition)}
                      </span>
                      <div className="text-xs">
                        <div className="font-medium text-gray-900">
                          {forecast.air_temperature}
                        </div>
                        <div className="text-gray-600">
                          {forecast.weather_condition}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Probability */}
                  <td className="p-3">
                    <div className="text-sm">
                      <div
                        className={`font-medium text-center ${getConfidenceTextColor(
                          forecast.confidence_score
                        )}`}
                      >
                        {forecast.confidence_score}%
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${getConfidenceBarColor(
                            forecast.confidence_score
                          )}`}
                          style={{ width: `${forecast.confidence_score}%` }}
                        ></div>
                      </div>
                    </div>
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

export function SimplifiedForecastTable({
  forecasts,
}: SimplifiedForecastTableProps) {
  const [expandedDates, setExpandedDates] = React.useState<Set<string>>(
    new Set()
  );

  // Group forecasts by date
  const groupedForecasts = React.useMemo(() => {
    const grouped: Record<string, EnhancedForecastEntity[]> = {};

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

  return (
    <div className="space-y-4">
      {sortedDates.map((date) => (
        <ForecastTable
          key={date}
          forecasts={groupedForecasts[date]}
          date={date}
          isExpanded={expandedDates.has(date)}
          onToggle={() => handleToggle(date)}
          isToday={isDateToday(date)}
        />
      ))}
    </div>
  );
}
