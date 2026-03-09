"use client";

import { Waves, ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TideChart, type TidePoint } from "@/components/forecast";
import type { CityTideData } from "@/actions/forecast/intent-forecast-actions";

interface TideOverviewSectionProps {
  data: CityTideData | null;
}

/**
 * TideOverviewSection - Displays city-level tide overview on intent pages
 *
 * Shows:
 * - Current tide status and height
 * - Next tide time and type (high/low)
 * - Interactive tide chart for the day
 * - Data attribution (which beach's station)
 */
export function TideOverviewSection({ data }: TideOverviewSectionProps) {
  // Don't render if no data available
  if (!data) return null;

  const { tidePoints, currentStatus, currentHeight, nextTideType, nextTideTime, nextTideHeight, beachName, tideStation } =
    data;

  // Determine if next tide is high or low for icon selection
  const isNextHigh = nextTideType?.toLowerCase() === "high";
  const TideIcon = isNextHigh ? ArrowUp : ArrowDown;

  return (
    <section className="space-y-4 mt-8">
      <Card className="overflow-hidden rounded-2xl backdrop-blur-sm bg-gradient-to-br from-white/80 to-blue-50/60 border-blue-200/50 shadow-lg">
        <CardHeader className="pb-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-b border-blue-100/50">
          <CardTitle className="flex items-center gap-2 text-lg font-heading text-gray-800">
            <Waves className="h-5 w-5 text-blue-600" />
            Today&apos;s Tide
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {/* Status Summary */}
          <div className="flex flex-wrap items-center gap-3">
            {currentStatus && (
              <Badge
                variant="secondary"
                className="text-sm bg-blue-100/80 text-blue-800"
              >
                {currentStatus}
                {currentHeight && ` · ${currentHeight}`}
              </Badge>
            )}
            {nextTideType && nextTideTime && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <TideIcon className="h-4 w-4 text-blue-600" />
                <span>
                  Next {nextTideType.toLowerCase()}: {nextTideTime}
                  {nextTideHeight && ` (${nextTideHeight})`}
                </span>
              </div>
            )}
          </div>

          {/* Tide Chart */}
          {tidePoints.length >= 2 && (
            <div className="h-48 w-full">
              <TideChart
                data={tidePoints}
                now={new Date()}
                compact={true}
                className="h-full"
              />
            </div>
          )}

          {/* Attribution */}
          <p className="text-xs text-gray-500">
            Data from {tideStation || beachName}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
