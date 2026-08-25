"use client";

import { Thermometer } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getWetsuitRecommendation,
  formatWaterTemp,
} from "@/lib/utils/wetsuit-utils";
import type { CityWaterTempData } from "@/actions/forecast/intent-forecast-actions";

interface WaterTempOverviewSectionProps {
  data: CityWaterTempData | null;
}

/**
 * Format date for chart x-axis (e.g., "Mon", "Tue")
 */
function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00"); // Noon to avoid timezone issues
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

/**
 * WaterTempOverviewSection - Displays city-level water temperature overview
 *
 * Shows:
 * - Current water temperature (large display)
 * - Wetsuit recommendation based on temp
 * - 7-day trend line chart (if sufficient data)
 * - Data attribution
 */
export function WaterTempOverviewSection({
  data,
}: WaterTempOverviewSectionProps) {
  // Don't render if no data available
  if (!data) return null;

  const { currentTemp, points, beachName } = data;
  const wetsuitRec = getWetsuitRecommendation(currentTemp);

  // Prepare chart data with formatted labels
  const chartData = points.map((p) => ({
    day: formatDayLabel(p.date),
    temp: p.tempF,
    fullDate: p.date,
  }));

  // Show trend chart only if we have at least 2 data points
  const showTrendChart = chartData.length >= 2;

  // Calculate y-axis domain with some padding
  const temps = points.map((p) => p.tempF);
  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);
  const yMin = Math.floor(minTemp - 2);
  const yMax = Math.ceil(maxTemp + 2);

  return (
    <section className="space-y-4 mt-8">
      <Card className="overflow-hidden rounded-2xl backdrop-blur-sm bg-gradient-to-br from-white/80 to-cyan-50/60 border-cyan-200/50 shadow-lg">
        <CardHeader className="pb-3 bg-gradient-to-r from-cyan-50/80 to-teal-50/80 border-b border-cyan-100/50">
          <CardTitle className="flex items-center gap-2 text-lg font-heading text-gray-800">
            <Thermometer className="h-5 w-5 text-cyan-600" />
            Water Temperature
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {/* Temperature Display */}
          <div className="flex items-start gap-6">
            {/* Large temp display */}
            <div className="flex items-baseline">
              <span className="text-5xl font-bold text-cyan-700">
                {Math.round(currentTemp)}
              </span>
              <span className="text-2xl font-semibold text-cyan-600 ml-1">
                °F
              </span>
            </div>

            {/* Wetsuit recommendation */}
            <div className="flex-1 space-y-2">
              <Badge
                variant="secondary"
                className="text-sm bg-cyan-100/80 text-cyan-800"
              >
                {wetsuitRec.thickness}
              </Badge>
              <p className="text-sm text-gray-600">{wetsuitRec.description}</p>
              {wetsuitRec.extras.length > 0 && (
                <p className="text-xs text-gray-500">
                  Extras: {wetsuitRec.extras.join(", ")}
                </p>
              )}
            </div>
          </div>

          {/* 7-Day Trend Chart */}
          {showTrendChart && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                7-Day Trend
              </h4>
              <div className="h-36 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#404C92"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11, fill: "#B0BFDA" }}
                      axisLine={{ stroke: "#404C92" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[yMin, yMax]}
                      tick={{ fontSize: 11, fill: "#B0BFDA" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}°`}
                      width={35}
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        formatWaterTemp(value),
                        "Temp",
                      ]}
                      labelFormatter={(label, payload) => {
                        if (payload?.[0]?.payload?.fullDate) {
                          const date = new Date(
                            payload[0].payload.fullDate + "T12:00:00"
                          );
                          return date.toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "short",
                            day: "numeric",
                          });
                        }
                        return label;
                      }}
                      contentStyle={{
                        backgroundColor: "rgba(45, 53, 125, 0.95)",
                        border: "1px solid #404C92",
                        borderRadius: "8px",
                        fontSize: "12px",
                        color: "#F0F0F0",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="temp"
                      stroke="#0891b2"
                      strokeWidth={2}
                      dot={{ fill: "#0891b2", r: 3 }}
                      activeDot={{ r: 5, fill: "#06b6d4" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Attribution */}
          <p className="text-xs text-gray-500">Data from {beachName}</p>
        </CardContent>
      </Card>
    </section>
  );
}
