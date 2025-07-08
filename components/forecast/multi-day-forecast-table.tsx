"use client";

import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { EnhancedForecast } from "@/types/database";

interface MultiDayForecastTableProps {
  forecasts: EnhancedForecast[];
}

interface ForecastTableProps {
  forecasts: EnhancedForecast[];
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
    return height; // Keep the original formatting with space
  };

  const formatPeriod = (period: string | null) => {
    if (!period) return "-";
    return period.replace("s", "s");
  };

  const formatDayLabel = () => {
    // Use our improved date checking functions
    if (isDateToday(date)) return "Today";
    if (isDateTomorrow(date)) return "Tomorrow";

    // For other dates, show full format
    return dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "numeric",
      day: "numeric",
    });
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
                  Tide
                </th>
                <th className="text-left p-3 text-sm font-medium text-gray-600">
                  Weather
                </th>
                <th className="text-left p-3 text-sm font-medium text-gray-600">
                  Confidence
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

                  {/* Tide */}
                  <td className="p-3">
                    <div className="text-xs">
                      <div className="font-medium">{forecast.tide_height}</div>
                      <div className="text-gray-600">
                        {forecast.tide_status}
                      </div>
                    </div>
                  </td>

                  {/* Weather */}
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🌤️</span>
                      <div className="text-xs">
                        <div className="font-medium">
                          {forecast.air_temperature}
                        </div>
                        <div className="text-gray-600">
                          {forecast.water_temp}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Confidence */}
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          forecast.confidence_score >= 80
                            ? "bg-green-500"
                            : forecast.confidence_score >= 60
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        }`}
                      />
                      <span className="text-xs font-medium">
                        {forecast.confidence_score}%
                      </span>
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

export function MultiDayForecastTable({
  forecasts,
}: MultiDayForecastTableProps) {
  // Compute available dates from forecasts
  const availableDates = React.useMemo(() => {
    const dates = Array.from(
      new Set(forecasts.map((f) => f.forecast_date))
    ).sort((a, b) => {
      const dateA = createDateFromString(a);
      const dateB = createDateFromString(b);
      return dateA.getTime() - dateB.getTime();
    });
    return dates;
  }, [forecasts]);

  const [expandedDays, setExpandedDays] = React.useState<Set<string>>(() => {
    // Initialize with first date if available
    return new Set(availableDates.length > 0 ? [availableDates[0]] : []);
  });

  // Update expanded days when available dates change
  React.useEffect(() => {
    if (availableDates.length > 0 && expandedDays.size === 0) {
      setExpandedDays(new Set([availableDates[0]]));
    }
  }, [availableDates, expandedDays.size]);

  // Group forecasts by date
  const forecastsByDate = React.useMemo(() => {
    return forecasts.reduce((acc, forecast) => {
      const date = forecast.forecast_date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(forecast);
      return acc;
    }, {} as Record<string, EnhancedForecast[]>);
  }, [forecasts]);

  const toggleDay = (date: string) => {
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDays(newExpanded);
  };

  // Use our improved date checking functions
  const todayDate = getCurrentDate();
  const otherDates = availableDates.filter((date) => !isDateToday(date));
  const hasTodayData = availableDates.some((date) => isDateToday(date));

  if (forecasts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No forecast data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Today's forecasts */}
      {hasTodayData && (
        <ForecastTable
          forecasts={forecastsByDate[todayDate] || []}
          date={todayDate}
          isExpanded={expandedDays.has(todayDate)}
          onToggle={() => toggleDay(todayDate)}
          isToday={true}
        />
      )}

      {/* Other dates */}
      {otherDates.map((date) => (
        <ForecastTable
          key={date}
          forecasts={forecastsByDate[date] || []}
          date={date}
          isExpanded={expandedDays.has(date)}
          onToggle={() => toggleDay(date)}
          isToday={isDateToday(date)}
        />
      ))}
    </div>
  );
}
