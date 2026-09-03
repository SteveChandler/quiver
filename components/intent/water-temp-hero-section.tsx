"use client";

import { Thermometer, TrendingUp, TrendingDown } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
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
      <Card className="overflow-hidden rounded-2xl border-[#11100D]/15 bg-gradient-to-br from-[#FBF6E8]/95 to-[#EEE3C9]/70 shadow-[0_18px_38px_rgba(17,16,13,0.14)]">
        <CardContent className="pt-6 space-y-6">
          {/* Temperature Display */}
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Large temp display */}
            <div className="flex items-baseline">
              <Thermometer className="h-8 w-8 text-[#0B3A75] mr-3 self-center" />
              <span className="text-5xl md:text-6xl font-bold text-[#0B3A75]">
                {Math.round(currentTemp)}
              </span>
              <span className="text-2xl font-semibold text-[#0B3A75] ml-1">
                °F
              </span>
              {trend !== 0 && (
                <span
                  className={`ml-3 flex items-center text-sm ${trend > 0 ? "text-[#B65F1A]" : "text-[#0B3A75]"}`}
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
                className="border border-[#0B3A75]/20 bg-[#0B3A75]/10 text-sm font-semibold text-[#0B3A75]"
              >
                {wetsuitRecommendation.thickness}
              </Badge>
              <p className="text-sm text-[#655C4C]">
                {wetsuitRecommendation.description}
              </p>
              {wetsuitRecommendation.extras.length > 0 && (
                <p className="text-xs text-[#6B6252]">
                  Recommended extras:{" "}
                  {wetsuitRecommendation.extras.join(", ")}
                </p>
              )}
            </div>
          </div>

          {/* 7-Day Trend Chart - Promoted to h-64 */}
          {showTrendChart && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[#11100D] mb-3">
                7-Day Temperature Trend
              </h3>
              <div className="h-64 w-full rounded-xl border border-[#11100D]/15 bg-[#FBF6E8]/80 p-2 shadow-[2px_3px_0_rgba(17,16,13,0.08)]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient
                        id="waterTempTrendFill"
                        x1="0"
                        x2="0"
                        y1="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#7FA7B8"
                          stopOpacity={0.55}
                        />
                        <stop
                          offset="95%"
                          stopColor="#F4EBD8"
                          stopOpacity={0.08}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="4 6"
                      stroke="rgba(11, 58, 117, 0.28)"
                      vertical={false}
                    />
                    <ReferenceArea
                      y1={68}
                      y2={74}
                      fill="#F7D98E"
                      fillOpacity={0.2}
                      strokeOpacity={0}
                    />
                    <ReferenceLine
                      y={currentTemp}
                      stroke="#B65F1A"
                      strokeDasharray="6 5"
                      strokeOpacity={0.55}
                    />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 12, fill: "#655C4C", fontWeight: 600 }}
                      axisLine={{ stroke: "rgba(17, 16, 13, 0.32)" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[yMin, yMax]}
                      tick={{ fontSize: 12, fill: "#655C4C", fontWeight: 600 }}
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
                        backgroundColor: "#11100D",
                        border: "1px solid rgba(17, 16, 13, 0.25)",
                        borderRadius: "8px",
                        fontSize: "13px",
                        color: "#F4EBD8",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="temp"
                      stroke="#0B3A75"
                      strokeWidth={3}
                      fill="url(#waterTempTrendFill)"
                      connectNulls
                      isAnimationActive={false}
                      dot={{
                        fill: "#0B3A75",
                        stroke: "#F4EBD8",
                        strokeWidth: 2,
                        r: 5,
                      }}
                      activeDot={{
                        r: 7,
                        fill: "#B65F1A",
                        stroke: "#F4EBD8",
                        strokeWidth: 2,
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Attribution */}
          <p className="text-xs text-[#6B6252]">
            Data from {beachName} · Updated hourly
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
