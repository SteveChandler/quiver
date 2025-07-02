"use client";

import React from "react";
import { Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ForecastCard } from "@/components/forecast-card";
import {
  isToday,
  findBestForecastForDate,
  groupForecastsBySwellDirection,
} from "@/lib/utils/forecast-ui-utils";
import type { EnhancedForecastEntity } from "@/types/forecast";

interface ForecastDisplayProps {
  selectedDate: string;
  selectedDateForecasts: EnhancedForecastEntity[];
}

export function ForecastDisplay({
  selectedDate,
  selectedDateForecasts,
}: ForecastDisplayProps) {
  if (!selectedDate || selectedDateForecasts.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">
            No forecast data available for {selectedDate}
          </p>
        </CardContent>
      </Card>
    );
  }

  const isTodaySelected = isToday(selectedDate);
  const todaysBest = isTodaySelected
    ? (findBestForecastForDate(
        selectedDateForecasts,
        true
      ) as EnhancedForecastEntity | null)
    : null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Calendar className="h-5 w-5" />
        {isTodaySelected
          ? "Today's Forecast"
          : new Date(selectedDate).toLocaleDateString([], {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
      </h3>

      <div className="space-y-4">
        {/* Show best forecast for today, grouped forecasts by swell direction for other dates */}
        {isTodaySelected && todaysBest ? (
          <ForecastCard
            key={todaysBest.id}
            forecast={todaysBest}
            variant="compact"
            showDate={false}
            showBeachName={false}
          />
        ) : (
          <>
            {selectedDateForecasts.length > 1 ? (
              <GroupedForecastDisplay forecasts={selectedDateForecasts} />
            ) : (
              <ForecastCard
                key={selectedDateForecasts[0].id}
                forecast={selectedDateForecasts[0]}
                variant="compact"
                showDate={true}
                showBeachName={false}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface GroupedForecastDisplayProps {
  forecasts: EnhancedForecastEntity[];
}

function GroupedForecastDisplay({ forecasts }: GroupedForecastDisplayProps) {
  const groups = groupForecastsBySwellDirection(forecasts);

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {groups.length === 1
          ? `All ${forecasts.length} forecasts show ${groups[0].direction} swell:`
          : "Forecast conditions by swell direction:"}
      </p>

      {/* Column-based layout for individual forecast cards */}
      <div className="overflow-x-auto">
        <div className="min-w-full">
          {/* Direction Headers */}
          <div
            className="grid gap-3 mb-2"
            style={{
              gridTemplateColumns: `repeat(${groups.length}, 1fr)`,
            }}
          >
            {groups.map((group) => (
              <div key={`header-${group.direction}`} className="text-center">
                <div className="flex items-center justify-center gap-2">
                  <h4 className="font-roboto font-bold text-lg text-blue-600">
                    {group.direction}
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      group.swellType === "primary"
                        ? "bg-blue-500 text-white"
                        : group.swellType === "secondary"
                        ? "bg-green-500 text-white"
                        : "bg-gray-500 text-white"
                    }`}
                  >
                    {group.swellType === "primary"
                      ? "Primary"
                      : group.swellType === "secondary"
                      ? "Secondary"
                      : "Mixed"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 font-open-sans">
                  {group.count} forecast
                  {group.count > 1 ? "s" : ""}
                </p>
              </div>
            ))}
          </div>

          {/* Individual Forecast Cards in Columns */}
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${groups.length}, 1fr)`,
            }}
          >
            {(() => {
              const maxForecasts = Math.max(
                ...groups.map((g) => g.forecasts.length)
              );
              const rows: JSX.Element[] = [];

              for (let i = 0; i < maxForecasts; i++) {
                groups.forEach((group, groupIndex) => {
                  if (group.forecasts[i]) {
                    rows.push(
                      <div
                        key={`${group.direction}-${i}`}
                        style={{
                          gridColumn: groupIndex + 1,
                        }}
                      >
                        <ForecastCard
                          forecast={
                            group.forecasts[i] as EnhancedForecastEntity
                          }
                          variant="compact"
                          showDate={true}
                          showBeachName={false}
                        />
                      </div>
                    );
                  }
                });
              }

              return rows;
            })()}
          </div>
        </div>
      </div>
    </>
  );
}
