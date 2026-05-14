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
      className="flex items-center justify-between gap-3 rounded-[8px] border-2 border-[#11100D] bg-[#F4EBD8] p-3 shadow-[2px_2px_0_#11100D]"
      data-testid="tide-status-strip"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#11100D] bg-[#0B3A75]">
          <DirectionIcon className="h-4 w-4 text-[#F4EBD8]" />
        </span>
        <span className="font-heading text-sm font-black uppercase text-[#11100D]">
          {directionLabel}
        </span>
      </div>
      {nextTideInfo && (
        <span className="text-right font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#0B3A75]">
          {nextTideInfo}
        </span>
      )}
    </div>
  );
}
