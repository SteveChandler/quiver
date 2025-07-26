"use client";

import React, { useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  Scatter,
  CartesianGrid,
  ResponsiveContainer,
  LabelList,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  TideTooltipContent,
  getTideChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EnhancedForecastEntity } from "@/types/forecast";

// Tide data structure
export interface TideDataPoint {
  time: Date;
  height: number;
  type: "high" | "low";
}

interface TideEvent {
  time: Date;
  height: number;
  type: "high" | "low";
  day: string;
  dayLabel: string;
}

interface TideChartProps {
  data?: TideDataPoint[];
  forecasts?: EnhancedForecastEntity[];
  className?: string;
  showNowLine?: boolean;
  isAnimationActive?: boolean;
}

// Helper functions for data extraction (from old component)
function getNormalizedDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDayLabel(dateString: string): string {
  const today = getNormalizedDateString(new Date());
  const tomorrow = getNormalizedDateString(
    new Date(Date.now() + 24 * 60 * 60 * 1000)
  );

  if (dateString === today) return "Today";
  if (dateString === tomorrow) return "Tomorrow";

  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function parseTideHeight(tideHeight: string | null): number {
  if (!tideHeight) return 0;
  const cleanHeight = tideHeight.replace(/ft|'|"/g, "").trim();
  return parseFloat(cleanHeight) || 0;
}

// Extract tide events from forecast data
function extractTideEvents(forecasts: EnhancedForecastEntity[]): TideEvent[] {
  const tideEvents: TideEvent[] = [];
  const seenTides = new Set<string>();

  forecasts.forEach((forecast) => {
    if (
      !forecast.next_tide_time ||
      !forecast.next_tide_type ||
      forecast.next_tide_time === "Unknown"
    ) {
      return;
    }

    const forecastDate = new Date(
      forecast.forecast_date + "T" + forecast.forecast_time
    );
    let tideTime: Date;

    // Handle different time formats
    if (forecast.next_tide_time.includes(":")) {
      const timeString = forecast.next_tide_time;
      const datePart = forecast.forecast_date.includes("T")
        ? forecast.forecast_date.split("T")[0]
        : forecast.forecast_date;

      if (/^\d{1,2}:\d{2}$/.test(timeString)) {
        tideTime = new Date(`${datePart}T${timeString.padStart(5, "0")}:00`);
      } else {
        tideTime = new Date(`${datePart} ${timeString}`);
      }
    } else {
      return;
    }

    if (isNaN(tideTime.getTime())) {
      return;
    }

    const height = parseTideHeight(forecast.next_tide_height);
    const type = forecast.next_tide_type.toLowerCase().includes("high")
      ? "high"
      : "low";
    const tideKey = `${tideTime.getTime()}-${type}`;

    if (!seenTides.has(tideKey)) {
      seenTides.add(tideKey);

      const dayString = getNormalizedDateString(tideTime);
      tideEvents.push({
        time: tideTime,
        height,
        type,
        day: dayString,
        dayLabel: getDayLabel(dayString),
      });
    }
  });

  return tideEvents.sort((a, b) => a.time.getTime() - b.time.getTime());
}

// Custom label component for tide markers
const TideLabel = (props: any) => {
  const { payload, x, y, value } = props;
  if (!payload || value === undefined) return null;

  const isHigh = payload.type === "high";
  const labelY = isHigh ? y - 15 : y + 20; // Above for high, below for low

  return (
    <text
      x={x}
      y={labelY}
      textAnchor="middle"
      className="fill-gray-700 text-xs font-medium"
      dominantBaseline={isHigh ? "auto" : "hanging"}
    >
      {Math.abs(value).toFixed(1)}ft
    </text>
  );
};

export function TideChart({
  data,
  forecasts,
  className,
  showNowLine = true,
  isAnimationActive = process.env.NODE_ENV !== "production",
}: TideChartProps) {
  const chartConfig = getTideChartConfig();

  // Process and filter data to 10 days maximum
  const processedData = useMemo(() => {
    let tideData: TideDataPoint[] = [];

    // Support both data formats
    if (data && data.length > 0) {
      tideData = data;
    } else if (forecasts && forecasts.length > 0) {
      // Extract tide data from forecast entities
      const tideEvents = extractTideEvents(forecasts);
      tideData = tideEvents.map((event) => ({
        time: event.time,
        height: event.height,
        type: event.type as "high" | "low",
      }));
    }

    if (tideData.length === 0)
      return {
        areaData: [],
        scatterData: { highTides: [], lowTides: [] },
        yDomain: [-8, 8],
      };

    // Limit to 10 days from the first data point
    const firstDate = tideData[0]?.time;
    if (!firstDate) {
      return {
        areaData: [],
        scatterData: { highTides: [], lowTides: [] },
        yDomain: [-8, 8],
      };
    }

    const tenDaysLater = new Date(firstDate);
    tenDaysLater.setDate(tenDaysLater.getDate() + 10);

    const filteredData = tideData.filter((point) => point.time <= tenDaysLater);

    // Check if filtering removed all data
    if (filteredData.length === 0) {
      return {
        areaData: [],
        scatterData: { highTides: [], lowTides: [] },
        yDomain: [-8, 8],
      };
    }

    // Calculate Y-axis domain with padding
    const heights = filteredData.map((point) => point.height);
    const minHeight = Math.min(...heights);
    const maxHeight = Math.max(...heights);
    const padding = Math.max(1, (maxHeight - minHeight) * 0.1); // 10% padding
    const yDomain = [
      Math.max(-8, minHeight - padding),
      Math.min(8, maxHeight + padding),
    ];

    // Create area chart data with smooth interpolation
    const areaData = filteredData.map((point) => ({
      time: point.time.getTime(),
      timeFormatted: point.time,
      height: point.height,
      type: point.type,
    }));

    // Separate high and low tide scatter data
    const highTides = filteredData
      .filter((point) => point.type === "high")
      .map((point) => ({
        time: point.time.getTime(),
        timeFormatted: point.time,
        height: point.height,
        type: point.type,
      }));

    const lowTides = filteredData
      .filter((point) => point.type === "low")
      .map((point) => ({
        time: point.time.getTime(),
        timeFormatted: point.time,
        height: point.height,
        type: point.type,
      }));

    return {
      areaData,
      scatterData: { highTides, lowTides },
      yDomain,
    };
  }, [data, forecasts]);

  const { areaData, scatterData, yDomain } = processedData;

  // Get current timestamp for "Now" line
  const nowTimestamp = Date.now();

  // Custom tick formatter for Today/Tomorrow/Day names
  const formatXAxisTick = useMemo(
    () => (tickItem: any) => {
      const date = new Date(tickItem);
      const dayString = getNormalizedDateString(date);
      return getDayLabel(dayString);
    },
    []
  );

  // Filter ticks to show one per day
  const getDayTicks = useMemo(() => {
    if (areaData.length === 0) return [];

    const ticks: number[] = [];
    const seenDays = new Set<string>();

    areaData.forEach((point) => {
      const date = new Date(point.time);
      const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

      if (!seenDays.has(dayKey)) {
        seenDays.add(dayKey);
        ticks.push(point.time);
      }
    });

    return ticks;
  }, [areaData]);

  if (areaData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>10-Day Tide Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>No tide data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>10-Day Tide Chart</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          role="img"
          aria-label="10-day tide chart showing high and low tide heights over time"
          className="w-full"
        >
          <ChartContainer config={chartConfig} className="aspect-[8/3] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={areaData}
                margin={{ top: 50, right: 30, left: 30, bottom: 50 }}
              >
                {/* Minimal, subtle grid */}
                <CartesianGrid
                  strokeDasharray="2 4"
                  stroke="#E5E7EB"
                  strokeOpacity={0.3}
                  horizontal={true}
                  vertical={false}
                />

                {/* Zero baseline reference line - subtle */}
                <ReferenceLine
                  y={0}
                  stroke="#D1D5DB"
                  strokeWidth={1}
                  strokeDasharray="4 2"
                  strokeOpacity={0.6}
                />

                {/* X-axis with Today/Tomorrow labels and visible axis lines */}
                <XAxis
                  dataKey="time"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  ticks={getDayTicks}
                  tickFormatter={formatXAxisTick}
                  interval={0}
                  axisLine={{ stroke: "#9CA3AF" }}
                  tickLine={{ stroke: "#9CA3AF" }}
                  label={{
                    value: "Day",
                    position: "bottom",
                    offset: -5,
                    fill: "#4B5563",
                  }}
                />

                {/* Y-axis with tide height label and visible axis lines */}
                <YAxis
                  domain={yDomain}
                  tickCount={7}
                  axisLine={{ stroke: "#9CA3AF" }}
                  tickLine={{ stroke: "#9CA3AF" }}
                  label={{
                    value: "Tide (ft)",
                    angle: -90,
                    position: "insideLeft",
                    offset: 0,
                    fill: "#4B5563",
                  }}
                />

                {/* "Now" reference line - subtle */}
                {showNowLine && (
                  <ReferenceLine
                    x={nowTimestamp}
                    stroke="#EF4444"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    strokeOpacity={0.8}
                  />
                )}

                {/* Area chart with zero baseline split */}
                <Area
                  type="monotone"
                  dataKey="height"
                  stroke="#0077B6"
                  strokeWidth={2}
                  fill="#0077B6"
                  fillOpacity={0.1}
                  dot={false}
                  connectNulls={true}
                  baseValue={0}
                  isAnimationActive={isAnimationActive}
                />

                {/* Main line - clean and prominent */}
                <Line
                  type="monotone"
                  dataKey="height"
                  stroke="#0077B6"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{
                    r: 4,
                    stroke: "#0077B6",
                    strokeWidth: 2,
                    fill: "#FFFFFF",
                  }}
                  isAnimationActive={isAnimationActive}
                />

                {/* High tide scatter points with labels above */}
                <Scatter
                  data={scatterData.highTides}
                  dataKey="height"
                  fill="#FF7F11"
                  stroke="#FFFFFF"
                  strokeWidth={1}
                  r={5}
                  fillOpacity={0.9}
                  isAnimationActive={isAnimationActive}
                >
                  <LabelList
                    dataKey="height"
                    content={TideLabel}
                    position="top"
                  />
                </Scatter>

                {/* Low tide scatter points with labels below */}
                <Scatter
                  data={scatterData.lowTides}
                  dataKey="height"
                  fill="#6B7280"
                  stroke="#FFFFFF"
                  strokeWidth={1}
                  r={5}
                  fillOpacity={0.8}
                  isAnimationActive={isAnimationActive}
                >
                  <LabelList
                    dataKey="height"
                    content={TideLabel}
                    position="bottom"
                  />
                </Scatter>

                {/* Enhanced, accessible tooltip */}
                <ChartTooltip
                  content={<TideTooltipContent />}
                  labelFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    });
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
