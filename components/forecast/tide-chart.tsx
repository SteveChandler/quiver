"use client";

import React, { useMemo } from "react";
import { EnhancedForecastEntity } from "@/types/forecast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TideChartProps {
  forecasts: EnhancedForecastEntity[];
  className?: string;
}

interface TideEvent {
  time: Date;
  height: number;
  type: "high" | "low";
  day: string;
  dayLabel: string;
}

// Helper function to get normalized date string (YYYY-MM-DD) in user's timezone
function getNormalizedDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Helper function to get day label (Today, Tomorrow, or day of week)
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

// Parse tide height string to number
function parseTideHeight(tideHeight: string | null): number {
  if (!tideHeight) return 0;

  // Handle formats like "2.5 ft", "3 ft", "2.5"
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

    // Parse the next tide time and type
    const forecastDate = new Date(
      forecast.forecast_date + "T" + forecast.forecast_time
    );
    let tideTime: Date;

    // Handle different time formats
    if (forecast.next_tide_time.includes(":")) {
      // Format like "14:30" or "2:30 PM"
      const timeString = forecast.next_tide_time;
      const [datePart] = forecast.forecast_date.split("T");

      // Try to parse as 24-hour format first
      if (/^\d{1,2}:\d{2}$/.test(timeString)) {
        tideTime = new Date(`${datePart}T${timeString.padStart(5, "0")}:00`);
      } else {
        // Try to parse as 12-hour format
        tideTime = new Date(`${datePart} ${timeString}`);
      }
    } else {
      // If it's not a time format we recognize, skip
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

    // Avoid duplicates
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

export function TideChart({ forecasts, className }: TideChartProps) {
  const processedData = useMemo(() => {
    // Extract and sort tide events
    const tideEvents = extractTideEvents(forecasts);

    if (tideEvents.length === 0) {
      return { tides: [], dayBoundaries: [] };
    }

    // Limit to first 30 tides for performance and readability
    const sortedTides = tideEvents.slice(0, 30);

    // Calculate day boundaries for labeling
    const dayBoundaries: { x: number; label: string; date: string }[] = [];
    const seenDays = new Set<string>();

    sortedTides.forEach((tide, index) => {
      if (!seenDays.has(tide.day)) {
        seenDays.add(tide.day);
        dayBoundaries.push({
          x: index,
          label: tide.dayLabel,
          date: tide.day,
        });
      }
    });

    return { tides: sortedTides, dayBoundaries };
  }, [forecasts]);

  const { tides, dayBoundaries } = processedData;

  if (tides.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Tides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>No tide data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Chart dimensions and scaling
  const chartWidth = 800;
  const chartHeight = 200; // Reduced height since we removed bottom elements
  const padding = { top: 50, right: 20, bottom: 40, left: 40 }; // Reduced bottom padding
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Find global min/max heights for consistent scaling
  const globalMaxHeight = Math.max(...tides.map((t) => t.height));
  const globalMinHeight = Math.min(...tides.map((t) => t.height));
  const heightRange = globalMaxHeight - globalMinHeight;

  // Scale functions
  const yScale = (height: number) => {
    if (heightRange === 0) return innerHeight / 2;
    return (
      innerHeight - ((height - globalMinHeight) / heightRange) * innerHeight
    );
  };

  const xScale = (index: number) => {
    return (index / Math.max(tides.length - 1, 1)) * innerWidth;
  };

  // Generate smooth SVG path for the tide line using curves
  const generateSmoothPath = (points: { x: number; y: number }[]) => {
    if (points.length < 2) return "";

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      const current = points[i];
      const previous = points[i - 1];

      // Create smooth curves between points
      if (i === 1) {
        // First curve
        const controlX = previous.x + (current.x - previous.x) * 0.5;
        const controlY1 = previous.y;
        const controlY2 = current.y;
        path += ` C ${controlX} ${controlY1}, ${controlX} ${controlY2}, ${current.x} ${current.y}`;
      } else {
        // Subsequent curves for smoothness
        const controlOffset = Math.min((current.x - previous.x) * 0.3, 40);
        const controlX1 = previous.x + controlOffset;
        const controlX2 = current.x - controlOffset;
        path += ` C ${controlX1} ${previous.y}, ${controlX2} ${current.y}, ${current.x} ${current.y}`;
      }
    }

    return path;
  };

  const tidePoints = tides.map((tide, i) => ({
    x: xScale(i),
    y: yScale(tide.height),
  }));

  const linePath = generateSmoothPath(tidePoints);

  // Generate area path (for gradient fill under the line)
  const areaPath =
    tides.length > 0
      ? `${linePath} L ${xScale(tides.length - 1)} ${innerHeight} L ${xScale(
          0
        )} ${innerHeight} Z`
      : "";

  // Smart label positioning to prevent overlaps
  const getOptimalLabelPositions = () => {
    const positions: { x: number; y: number; visible: boolean }[] = [];
    const minHorizontalDistance = 70; // Minimum horizontal distance between labels
    const minVerticalDistance = 30; // Minimum vertical distance between labels

    tides.forEach((tide, index) => {
      const x = xScale(index);
      const y = yScale(tide.height);
      let labelY = y - 20; // Default position above point
      let visible = true;

      // Check for conflicts with previous labels
      for (
        let i = positions.length - 1;
        i >= Math.max(0, positions.length - 5);
        i--
      ) {
        const prevPos = positions[i];
        if (!prevPos.visible) continue;

        const horizontalDistance = Math.abs(x - prevPos.x);
        const verticalDistance = Math.abs(labelY - prevPos.y);

        // If too close horizontally and vertically, hide this label
        if (
          horizontalDistance < minHorizontalDistance &&
          verticalDistance < minVerticalDistance
        ) {
          // Try positioning above or below
          const altLabelY = y + 25; // Position below point
          const altVerticalDistance = Math.abs(altLabelY - prevPos.y);

          if (altVerticalDistance >= minVerticalDistance) {
            labelY = altLabelY;
          } else {
            // Hide this label if no good position found
            visible = false;
          }
        }
      }

      // Ensure label stays within chart bounds
      labelY = Math.max(15, Math.min(labelY, innerHeight + padding.top - 10));

      positions.push({ x, y: labelY, visible });
    });

    return positions;
  };

  const labelPositions = getOptimalLabelPositions();

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Tides</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <svg
            width={chartWidth}
            height={chartHeight}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-auto min-w-[600px]"
          >
            {/* Gradient definitions */}
            <defs>
              <linearGradient
                id="tideGradient"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.1" />
              </linearGradient>
            </defs>

            {/* Chart background */}
            <rect
              x={padding.left}
              y={padding.top}
              width={innerWidth}
              height={innerHeight}
              fill="transparent"
              stroke="#E5E7EB"
              strokeWidth="1"
            />

            {/* Horizontal grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding.top + ratio * innerHeight;
              const height = globalMinHeight + (1 - ratio) * heightRange;
              return (
                <g key={ratio}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={padding.left + innerWidth}
                    y2={y}
                    stroke="#F3F4F6"
                    strokeWidth="1"
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="text-sm font-medium fill-gray-600"
                  >
                    {height.toFixed(1)}ft
                  </text>
                </g>
              );
            })}

            {/* Vertical day separators */}
            {dayBoundaries.slice(1).map((boundary) => (
              <line
                key={boundary.date}
                x1={padding.left + xScale(boundary.x)}
                y1={padding.top}
                x2={padding.left + xScale(boundary.x)}
                y2={padding.top + innerHeight}
                stroke="#F3F4F6"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
            ))}

            {/* Area fill under the tide line */}
            {areaPath && (
              <path
                d={areaPath}
                fill="url(#tideGradient)"
                transform={`translate(${padding.left}, ${padding.top})`}
              />
            )}

            {/* Main tide line */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#3B82F6"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                transform={`translate(${padding.left}, ${padding.top})`}
              />
            )}

            {/* Tide points and labels */}
            {tides.map((tide, index) => {
              const x = padding.left + xScale(index);
              const y = padding.top + yScale(tide.height);
              const isHigh = tide.type === "high";
              const labelPos = labelPositions[index];

              return (
                <g key={index}>
                  {/* Point circle */}
                  <circle
                    cx={x}
                    cy={y}
                    r="4"
                    fill={isHigh ? "#3B82F6" : "#6B7280"}
                    stroke="white"
                    strokeWidth="2"
                  />

                  {/* Tide height label with improved positioning */}
                  {labelPos.visible && (
                    <g>
                      <rect
                        x={x - 18}
                        y={labelPos.y - 7}
                        width="36"
                        height="16"
                        fill="white"
                        stroke="#E5E7EB"
                        strokeWidth="1"
                        rx="3"
                        opacity="0.95"
                      />
                      <text
                        x={x}
                        y={labelPos.y + 3}
                        textAnchor="middle"
                        className="text-xs font-semibold fill-gray-800"
                      >
                        {tide.height.toFixed(1)}ft
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Day labels */}
            {dayBoundaries.map((boundary, index) => {
              const nextBoundary = dayBoundaries[index + 1];
              const labelX = nextBoundary
                ? xScale(boundary.x) +
                  (xScale(nextBoundary.x) - xScale(boundary.x)) / 2
                : xScale(boundary.x) + 40;

              return (
                <g key={boundary.date}>
                  {/* Day label */}
                  <text
                    x={padding.left + labelX}
                    y={chartHeight - 25}
                    textAnchor="middle"
                    className="text-sm font-semibold fill-gray-700"
                  >
                    {boundary.label}
                  </text>

                  {/* Date label */}
                  <text
                    x={padding.left + labelX}
                    y={chartHeight - 10}
                    textAnchor="middle"
                    className="text-xs fill-gray-600"
                  >
                    {new Date(boundary.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}
