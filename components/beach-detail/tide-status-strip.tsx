"use client";

import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { DynamicTideResult } from "@/hooks/use-dynamic-tide";
import { formatTideHeight } from "@/lib/formatters/surf-data";

interface TideStatusStripProps {
  dynamicTide: DynamicTideResult;
}

export function TideStatusStrip({ dynamicTide }: TideStatusStripProps) {
  if (!dynamicTide.currentDirection) return null;

  const DirectionIcon =
    dynamicTide.currentDirection === "rising"
      ? ArrowUp
      : dynamicTide.currentDirection === "falling"
        ? ArrowDown
        : Minus;

  const directionLabel =
    dynamicTide.currentDirection === "rising"
      ? "Rising"
      : dynamicTide.currentDirection === "falling"
        ? "Falling"
        : "Slack";

  const nextTideInfo = (() => {
    if (!dynamicTide.nextTide || dynamicTide.minutesUntil == null) return null;

    const type = dynamicTide.nextTide.type === "high" ? "High" : "Low";
    const height = formatTideHeight(dynamicTide.nextTide.height);
    const time = new Date(dynamicTide.nextTide.time * 1000).toLocaleTimeString(
      [],
      { hour: "numeric", minute: "2-digit", hour12: true }
    );

    const totalMinutes = Math.round(dynamicTide.minutesUntil);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const countdown =
      hours > 0 ? `in ${hours}h ${minutes}m` : `in ${minutes}m`;

    return `Next ${type} ${height} @ ${time} (${countdown})`;
  })();

  return (
    <div
      className="flex items-center justify-between rounded-2xl border border-blue-100/60 bg-white/95 p-3 shadow-sm"
      data-testid="tide-status-strip"
    >
      <div className="flex items-center gap-2">
        <DirectionIcon className="h-4 w-4 text-ocean-blue" />
        <span className="text-sm font-medium text-dark-grey">
          {directionLabel}
        </span>
      </div>
      {nextTideInfo && (
        <span className="text-xs text-muted-foreground">{nextTideInfo}</span>
      )}
    </div>
  );
}
