"use client";

import { Thermometer, TrendingUp, TrendingDown } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatWaterTemp } from "@/lib/utils/wetsuit-utils";
import type { CityWaterTempExpanded } from "@/actions/forecast/intent-forecast-actions";

interface WaterTempHeroSectionProps {
  data: CityWaterTempExpanded;
}

function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

export function WaterTempHeroSection({ data }: WaterTempHeroSectionProps) {
  const { currentTemp, points, beachName, wetsuitRecommendation } = data;

  const chartData = points.map((p) => ({
    day: formatDayLabel(p.date),
    temp: p.tempF,
    fullDate: p.date,
  }));

  const showTrendChart = chartData.length >= 2;
  const temps = points.map((p) => p.tempF);
  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);
  const yMin = Math.floor(minTemp - 2);
  const yMax = Math.ceil(maxTemp + 2);

  // Trend indicator
  const trend =
    points.length >= 2
      ? points[points.length - 1].tempF - points[0].tempF
      : 0;
  const TrendIcon = trend > 0 ? TrendingUp : TrendingDown;

  return (
    <section data-testid="water-temp-hero" className="space-y-6">
      <Card className="overflow-hidden rounded-2xl backdrop-blur-sm bg-gradient-to-br from-white/80 to-cyan-50/60 border-cyan-200/50 shadow-lg">
        <CardContent className="pt-6 space-y-6">
          {/* Temperature Display */}
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Large temp display */}
            <div className="flex items-baseline">
              <Thermometer className="h-8 w-8 text-cyan-600 mr-3 self-center" />
              <span className="text-5xl md:text-6xl font-bold text-cyan-700">
                {Math.round(currentTemp)}
              </span>
              <span className="text-2xl font-semibold text-cyan-600 ml-1">
                °F
              </span>
              {trend !== 0 && (
                <span
                  className={`ml-3 flex items-center text-sm ${trend > 0 ? "text-amber-600" : "text-blue-600"}`}
                >
                  <TrendIcon className="h-4 w-4 mr-1" />
                  {Math.abs(Math.round(trend * 10) / 10)}° this week
                </span>
              )}
            </div>

            {/* Wetsuit recommendation */}
            <div className="flex-1 space-y-2">
              <Badge
                variant="secondary"
                className="text-sm bg-cyan-100/80 text-cyan-800 font-medium"
              >
                {wetsuitRecommendation.thickness}
              </Badge>
              <p className="text-sm text-gray-600">
                {wetsuitRecommendation.description}
              </p>
              {wetsuitRecommendation.extras.length > 0 && (
                <p className="text-xs text-gray-500">
                  Recommended extras:{" "}
                  {wetsuitRecommendation.extras.join(", ")}
                </p>
              )}
            </div>
          </div>

          {/* 7-Day Trend Chart - Promoted to h-64 */}
          {showTrendChart && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                7-Day Temperature Trend
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#404C92"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 12, fill: "#B0BFDA" }}
                      axisLine={{ stroke: "#404C92" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[yMin, yMax]}
                      tick={{ fontSize: 12, fill: "#B0BFDA" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}°`}
                      width={40}
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
                        fontSize: "13px",
                        color: "#F0F0F0",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="temp"
                      stroke="#0891b2"
                      strokeWidth={2.5}
                      dot={{ fill: "#0891b2", r: 4 }}
                      activeDot={{ r: 6, fill: "#06b6d4" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Attribution */}
          <p className="text-xs text-gray-500">
            Data from {beachName} · Updated hourly
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
