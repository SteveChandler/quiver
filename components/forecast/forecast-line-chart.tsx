"use client";

import React, { useMemo } from "react";
import { EnhancedForecastEntity } from "@/types/forecast";

interface ForecastLineChartProps {
  forecasts: EnhancedForecastEntity[];
  className?: string;
}

interface DayData {
  date: string;
  dayLabel: string;
  forecasts: EnhancedForecastEntity[];
  avgWaveHeight: number;
  maxWaveHeight: number;
  minWaveHeight: number;
  avgConfidence: number;
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

// Helper function to parse wave height string to number
function parseWaveHeight(waveHeight: string | null): number {
  if (!waveHeight) return 0;

  // Handle formats like "2-3 ft", "3 ft", "2-3"
  const cleanHeight = waveHeight.replace(/ft|'|"/g, "").trim();

  // If it's a range like "2-3", take the average
  if (cleanHeight.includes("-")) {
    const [min, max] = cleanHeight.split("-").map((s) => parseFloat(s.trim()));
    return (min + max) / 2;
  }

  return parseFloat(cleanHeight) || 0;
}

export function ForecastLineChart({
  forecasts,
  className,
}: ForecastLineChartProps) {
  const processedData = useMemo(() => {
    // Group forecasts by date
    const groupedByDate: Record<string, EnhancedForecastEntity[]> = {};

    forecasts.forEach((forecast) => {
      const date = forecast.forecast_date;
      if (!groupedByDate[date]) {
        groupedByDate[date] = [];
      }
      groupedByDate[date].push(forecast);
    });

    // Process each day's data
    const dayData: DayData[] = Object.entries(groupedByDate)
      .map(([date, dayForecasts]) => {
        const waveHeights = dayForecasts.map((f) =>
          parseWaveHeight(f.wave_height)
        );
        const confidences = dayForecasts.map((f) => f.confidence_score || 0);

        return {
          date,
          dayLabel: getDayLabel(date),
          forecasts: dayForecasts,
          avgWaveHeight:
            waveHeights.reduce((a, b) => a + b, 0) / waveHeights.length,
          maxWaveHeight: Math.max(...waveHeights),
          minWaveHeight: Math.min(...waveHeights),
          avgConfidence:
            confidences.reduce((a, b) => a + b, 0) / confidences.length,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return dayData;
  }, [forecasts]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "#10B981"; // Green-500
    if (confidence >= 60) return "#EAB308"; // Yellow-500
    return "#EF4444"; // Red-500
  };

  if (processedData.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        <p>No forecast data available</p>
      </div>
    );
  }

  // Chart dimensions and scaling
  const chartWidth = 800;
  const chartHeight = 200;
  const padding = { top: 20, right: 20, bottom: 40, left: 40 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const maxHeight = Math.max(...processedData.map((d) => d.maxWaveHeight));
  const minHeight = Math.min(...processedData.map((d) => d.minWaveHeight));
  const heightRange = maxHeight - minHeight;

  // Scale functions
  const xScale = (index: number) =>
    (index / (processedData.length - 1)) * innerWidth;
  const yScale = (height: number) => {
    if (heightRange === 0) return innerHeight / 2;
    return innerHeight - ((height - minHeight) / heightRange) * innerHeight;
  };

  // Generate SVG path for the line
  const linePath = processedData
    .map((d, i) => {
      const x = xScale(i);
      const y = yScale(d.avgWaveHeight);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  // Generate area path (for gradient fill)
  const areaPath = `${linePath} L ${xScale(
    processedData.length - 1
  )} ${innerHeight} L ${xScale(0)} ${innerHeight} Z`;

  return (
    <div className={`w-full ${className}`}>
      <div className="overflow-x-auto">
        <svg
          width={chartWidth}
          height={chartHeight}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto min-w-[600px]"
        >
          {/* Gradient definitions */}
          <defs>
            <linearGradient id="waveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
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
            const height = minHeight + (1 - ratio) * heightRange;
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
                  className="text-xs fill-gray-500"
                >
                  {height.toFixed(1)}ft
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path
            d={areaPath}
            fill="url(#waveGradient)"
            transform={`translate(${padding.left}, ${padding.top})`}
          />

          {/* Main line */}
          <path
            d={linePath}
            fill="none"
            stroke="#3B82F6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            transform={`translate(${padding.left}, ${padding.top})`}
          />

          {/* Data points */}
          {processedData.map((d, i) => {
            const x = padding.left + xScale(i);
            const y = padding.top + yScale(d.avgWaveHeight);
            const confidenceColor = getConfidenceColor(d.avgConfidence);

            return (
              <g key={d.date}>
                {/* Point circle */}
                <circle
                  cx={x}
                  cy={y}
                  r="4"
                  fill="#3B82F6"
                  stroke="white"
                  strokeWidth="2"
                />

                {/* Wave height label */}
                <text
                  x={x}
                  y={y - 12}
                  textAnchor="middle"
                  className="text-xs font-medium fill-gray-700"
                >
                  {d.avgWaveHeight.toFixed(1)}ft
                </text>

                {/* Confidence indicator */}
                <circle
                  cx={x}
                  cy={y}
                  r="6"
                  fill="none"
                  stroke={confidenceColor}
                  strokeWidth="2"
                  opacity="0.7"
                />

                {/* Day label */}
                <text
                  x={x}
                  y={chartHeight - 10}
                  textAnchor="middle"
                  className="text-sm font-medium fill-gray-600"
                >
                  {d.dayLabel}
                </text>

                {/* Date label */}
                <text
                  x={x}
                  y={chartHeight - 25}
                  textAnchor="middle"
                  className="text-xs fill-gray-500"
                >
                  {new Date(d.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex justify-center mt-4 space-x-6 text-xs text-gray-600">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span>Wave Height</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 border-2 border-green-500 rounded-full"></div>
          <span>High Confidence (80%+)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 border-2 border-yellow-500 rounded-full"></div>
          <span>Medium Confidence (60-80%)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 border-2 border-red-500 rounded-full"></div>
          <span>Low Confidence (&lt;60%)</span>
        </div>
      </div>
    </div>
  );
}
