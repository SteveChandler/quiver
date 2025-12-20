"use client";

import * as React from "react";
import { ArrowUp, ArrowDown, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TideNextExtremeProps } from "@/types/tide-diagnostics";

/**
 * Format time for display
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format duration in minutes to human-readable string
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `in ${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `in ${hours}h`;
  }
  return `in ${hours}h ${mins}m`;
}

/**
 * Single tide extreme card
 */
function TideExtremeCard({
  type,
  time,
  height,
  minutesUntil,
  unit = "ft",
}: {
  type: "high" | "low";
  time: Date;
  height: number;
  minutesUntil: number;
  unit?: string;
}) {
  const isHigh = type === "high";

  return (
    <div
      className={cn(
        "flex-1 rounded-lg border p-3",
        isHigh
          ? "bg-blue-50 border-blue-200"
          : "bg-slate-50 border-slate-200"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2">
        {isHigh ? (
          <ArrowUp className="h-4 w-4 text-blue-600" />
        ) : (
          <ArrowDown className="h-4 w-4 text-slate-600" />
        )}
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-wide",
            isHigh ? "text-blue-700" : "text-slate-700"
          )}
        >
          {isHigh ? "High Tide" : "Low Tide"}
        </span>
      </div>

      {/* Height */}
      <div className="mb-1">
        <span
          className={cn(
            "text-2xl font-bold",
            isHigh ? "text-blue-900" : "text-slate-900"
          )}
        >
          {height.toFixed(1)}
        </span>
        <span className="text-sm text-slate-500 ml-1">{unit}</span>
      </div>

      {/* Time */}
      <div className="flex items-center gap-1 text-sm">
        <Clock className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-slate-600">{formatTime(time)}</span>
        <span className="text-slate-400">·</span>
        <span className="text-slate-500">{formatDuration(minutesUntil)}</span>
      </div>
    </div>
  );
}

/**
 * Empty state when tide data is unavailable
 */
function TideExtremeEmpty({ type }: { type: "high" | "low" }) {
  return (
    <div className="flex-1 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        {type === "high" ? (
          <ArrowUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ArrowDown className="h-4 w-4 text-slate-400" />
        )}
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {type === "high" ? "High Tide" : "Low Tide"}
        </span>
      </div>
      <div className="text-sm text-slate-400">Not available</div>
    </div>
  );
}

/**
 * TideNextExtreme - Shows next high and low tides
 *
 * Displays a summary of the next high and low tides with:
 * - Height in configured units
 * - Time of occurrence
 * - Duration until the event
 */
export function TideNextExtreme({
  nextHigh,
  nextLow,
  minutesToHigh,
  minutesToLow,
  unit = "ft",
  className,
}: TideNextExtremeProps) {
  // If no data at all, don't render
  if (!nextHigh && !nextLow) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <h4 className="text-sm font-medium text-slate-700">Next Tides</h4>
      <div className="flex gap-3">
        {nextHigh && minutesToHigh !== null ? (
          <TideExtremeCard
            type="high"
            time={nextHigh.time}
            height={nextHigh.height}
            minutesUntil={minutesToHigh}
            unit={unit}
          />
        ) : (
          <TideExtremeEmpty type="high" />
        )}
        {nextLow && minutesToLow !== null ? (
          <TideExtremeCard
            type="low"
            time={nextLow.time}
            height={nextLow.height}
            minutesUntil={minutesToLow}
            unit={unit}
          />
        ) : (
          <TideExtremeEmpty type="low" />
        )}
      </div>
    </div>
  );
}

/**
 * Compact inline version for mobile or constrained layouts
 */
export function TideNextExtremeCompact({
  nextHigh,
  nextLow,
  minutesToHigh,
  minutesToLow,
  unit = "ft",
  className,
}: TideNextExtremeProps) {
  if (!nextHigh && !nextLow) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-4 text-sm",
        className
      )}
    >
      {nextHigh && minutesToHigh !== null && (
        <div className="flex items-center gap-1.5">
          <ArrowUp className="h-4 w-4 text-blue-600" />
          <span className="font-medium">
            {nextHigh.height.toFixed(1)} {unit}
          </span>
          <span className="text-slate-500">
            @ {formatTime(nextHigh.time)}
          </span>
        </div>
      )}
      {nextLow && minutesToLow !== null && (
        <div className="flex items-center gap-1.5">
          <ArrowDown className="h-4 w-4 text-slate-600" />
          <span className="font-medium">
            {nextLow.height.toFixed(1)} {unit}
          </span>
          <span className="text-slate-500">
            @ {formatTime(nextLow.time)}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Row format suitable for use inside cards or lists
 */
export function TideNextExtremeRow({
  nextHigh,
  nextLow,
  minutesToHigh,
  minutesToLow,
  unit = "ft",
  className,
}: TideNextExtremeProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-4 text-sm", className)}>
      <div>
        <div className="text-xs text-slate-500 mb-0.5">Next High</div>
        {nextHigh && minutesToHigh !== null ? (
          <div className="font-medium text-blue-700">
            {formatTime(nextHigh.time)} · {nextHigh.height.toFixed(1)} {unit}
          </div>
        ) : (
          <div className="text-slate-400">—</div>
        )}
      </div>
      <div>
        <div className="text-xs text-slate-500 mb-0.5">Next Low</div>
        {nextLow && minutesToLow !== null ? (
          <div className="font-medium text-slate-700">
            {formatTime(nextLow.time)} · {nextLow.height.toFixed(1)} {unit}
          </div>
        ) : (
          <div className="text-slate-400">—</div>
        )}
      </div>
    </div>
  );
}

export default TideNextExtreme;
