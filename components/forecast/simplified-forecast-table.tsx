"use client";

import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { EnhancedForecastEntity } from "@/types/forecast";

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
    <div className="space-y-2">
      {/* Day Header */}
      <div
        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
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
        <span className="text-sm text-gray-600">
          {forecasts.length} forecasts
        </span>
      </div>

      {/* Table */}
      {(isExpanded || isToday) && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white rounded-lg border">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-3 text-sm font-medium text-gray-600">
                  Time
                </th>
                <th className="text-left p-3 text-sm font-medium text-gray-600">
                  Surf (ft)
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
                  Consistency
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
                  className={`border-b hover:bg-gray-50/50 ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                  }`}
                >
                  {/* Time */}
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
                      <span className="font-medium text-sm">
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
                      <span className="font-medium text-sm">
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
                      <span className="font-medium text-sm">
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
                      <span className="font-medium text-sm">
                        {forecast.wind_speed}
                      </span>
                      <span className="text-lg">
                        {getDirectionArrow(forecast.wind_direction)}
                      </span>
                    </div>
                  </td>

                  {/* Consistency */}
                  <td className="p-3">
                    <div className="text-sm">
                      <div
                        className={`font-medium ${getConfidenceTextColor(
                          forecast.confidence_score
                        )}`}
                      >
                        {getConsistencyRating(forecast.confidence_score)}
                      </div>
                      <div className="text-xs text-gray-600">
                        {forecast.confidence_score}%
                      </div>
                    </div>
                  </td>

                  {/* Weather */}
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">
                        {getWeatherIcon(forecast.weather_condition)}
                      </span>
                      <div className="text-xs">
                        <div className="font-medium">
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
