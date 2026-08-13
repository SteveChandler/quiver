"use client";

import * as React from "react";
import {
  ArrowUp,
  ArrowDown,
  Minus,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTideHeight } from "@/lib/formatters/surf-data";
import type {
  TideHourlyTableProps,
  TideHourlyPoint,
} from "@/types/tide-diagnostics";

/**
 * Format time for table display
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Get trend icon based on trend type
 */
function getTrendIcon(trend: TideHourlyPoint["trend"]) {
  switch (trend) {
    case "rising":
      return <ArrowUp className="h-4 w-4 text-blue-500" />;
    case "falling":
      return <ArrowDown className="h-4 w-4 text-slate-500" />;
    case "peak":
      return <ChevronUp className="h-4 w-4 text-blue-600" />;
    case "trough":
      return <ChevronDown className="h-4 w-4 text-slate-600" />;
    case "stable":
    default:
      return <Minus className="h-4 w-4 text-slate-400" />;
  }
}

/**
 * Get row styling based on point type
 */
function getRowStyles(point: TideHourlyPoint) {
  if (point.isCurrent) {
    return "bg-blue-50 border-l-2 border-l-blue-500";
  }
  if (point.isHigh) {
    return "bg-blue-50/50";
  }
  if (point.isLow) {
    return "bg-slate-50/50";
  }
  return "";
}

/**
 * Single table row
 */
function TableRow({ point, unit }: { point: TideHourlyPoint; unit: string }) {
  return (
    <tr
      className={cn(
        "border-b border-slate-100 last:border-b-0",
        getRowStyles(point)
      )}
      data-testid="tide-table-row"
    >
      {/* Time */}
      <td className="py-2 px-3 text-sm">
        <span className={cn(point.isCurrent && "font-semibold text-blue-700")}>
          {formatTime(point.time)}
        </span>
        {point.isCurrent && (
          <span className="ml-1.5 text-xs text-blue-600">(Now)</span>
        )}
      </td>

      {/* Height */}
      <td className="py-2 px-3 text-sm text-right">
        <span
          className={cn(
            "font-medium",
            point.isHigh && "text-blue-700",
            point.isLow && "text-slate-700",
            point.isCurrent && "text-blue-800"
          )}
        >
          {formatTideHeight(point.height)}
        </span>
      </td>

      {/* Trend */}
      <td className="py-2 px-3 text-center">
        <div className="flex items-center justify-center gap-1">
          {getTrendIcon(point.trend)}
          {(point.isHigh || point.isLow) && (
            <span
              className={cn(
                "text-xs font-medium",
                point.isHigh && "text-blue-600",
                point.isLow && "text-slate-600"
              )}
            >
              {point.isHigh ? "HIGH" : "LOW"}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

/**
 * TideHourlyTable - Displays hourly tide predictions
 *
 * Shows an 18-row table with:
 * - Time (local)
 * - Height (ft)
 * - Trend (rising/falling/peak/trough)
 *
 * Features:
 * - Highlights current hour
 * - Marks high/low tide rows
 * - Mobile responsive (scrollable)
 */
export function TideHourlyTable({
  data,
  now: _now,
  unit = "ft",
  className,
  maxRows = 18,
}: TideHourlyTableProps) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  // Limit rows if needed
  const displayData = data.slice(0, maxRows);

  if (displayData.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500",
          className
        )}
      >
        No hourly tide data available
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn("space-y-2", className)}>
      <h4 className="text-sm font-medium text-slate-700">Tide Table</h4>
      <div
        className="overflow-hidden rounded-lg border border-slate-200"
        data-testid="tide-hourly-table"
      >
        <div
          className="max-h-[400px] overflow-x-auto overflow-y-auto"
          data-testid="tide-hourly-table-scroll"
          role="region"
          aria-label="Hourly tide data"
          tabIndex={0}
        >
          <table className="w-full">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="border-b border-slate-200">
                <th className="py-2 px-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Time
                </th>
                <th className="py-2 px-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Height
                </th>
                <th className="py-2 px-3 text-center text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody>
              {displayData.map((point, index) => (
                <TableRow
                  key={point.time.getTime()}
                  point={point}
                  unit={unit}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact two-column version for side-by-side display
 */
export function TideHourlyTableCompact({
  data,
  now: _now,
  unit = "ft",
  className,
  maxRows = 18,
}: TideHourlyTableProps) {
  const displayData = data.slice(0, maxRows);
  const midpoint = Math.ceil(displayData.length / 2);
  const leftColumn = displayData.slice(0, midpoint);
  const rightColumn = displayData.slice(midpoint);

  if (displayData.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <h4 className="text-sm font-medium text-slate-700">Tide Table</h4>
      <div
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
        data-testid="tide-hourly-table-compact-grid"
      >
        {/* Left column */}
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div
            className="overflow-x-auto"
            data-testid="tide-hourly-table-compact-left-scroll"
            role="region"
            aria-label="Tide table, first half"
            tabIndex={0}
          >
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="py-1.5 px-2 text-left font-medium text-slate-600">
                    Time
                  </th>
                  <th className="py-1.5 px-2 text-right font-medium text-slate-600">
                    {unit}
                  </th>
                  <th className="py-1.5 px-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {leftColumn.map((point) => (
                  <tr
                    key={point.time.getTime()}
                    className={cn(
                      "border-b border-slate-100 last:border-b-0",
                      getRowStyles(point)
                    )}
                  >
                    <td className="py-1.5 px-2">{formatTime(point.time)}</td>
                    <td className="py-1.5 px-2 text-right font-medium">
                      {formatTideHeight(point.height)}
                    </td>
                    <td className="py-1.5 px-2">{getTrendIcon(point.trend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div
            className="overflow-x-auto"
            data-testid="tide-hourly-table-compact-right-scroll"
            role="region"
            aria-label="Tide table, second half"
            tabIndex={0}
          >
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="py-1.5 px-2 text-left font-medium text-slate-600">
                    Time
                  </th>
                  <th className="py-1.5 px-2 text-right font-medium text-slate-600">
                    {unit}
                  </th>
                  <th className="py-1.5 px-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {rightColumn.map((point) => (
                  <tr
                    key={point.time.getTime()}
                    className={cn(
                      "border-b border-slate-100 last:border-b-0",
                      getRowStyles(point)
                    )}
                  >
                    <td className="py-1.5 px-2">{formatTime(point.time)}</td>
                    <td className="py-1.5 px-2 text-right font-medium">
                      {formatTideHeight(point.height)}
                    </td>
                    <td className="py-1.5 px-2">{getTrendIcon(point.trend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TideHourlyTable;
