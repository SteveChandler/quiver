"use client";

import { Wind, Droplets, Thermometer } from "lucide-react";
import { AnimatedWaveIcon } from "@/components/ui/animated-wave-icon";
import { getSummaryTrendIndicator } from "./constants";
import type { CoastPulseSummary } from "./types";

interface CoastPulseSummaryBarProps {
  summary: CoastPulseSummary;
}

/**
 * CoastPulseSummaryBar - Displays current conditions summary
 */
export function CoastPulseSummaryBar({ summary }: CoastPulseSummaryBarProps) {
  // Only render if at least one metric is present
  if (!summary.waveHeight && !summary.windSpeed && !summary.tideHeight && !summary.waterTemp) {
    return null;
  }

  return (
    <div className="relative z-10 flex flex-wrap items-center gap-3 text-xs text-gray-300 bg-[#2a2a2a] rounded-lg px-3 py-2">
      {summary.waveHeight && (
        <span className="flex items-center gap-1.5">
          <AnimatedWaveIcon className="text-blue-400" size={14} duration={1.5} />
          {summary.waveHeight}
        </span>
      )}
      {summary.windSpeed && (
        <span className="flex items-center gap-1">
          <Wind className="h-3.5 w-3.5 text-cyan-400" />
          {summary.windSpeed}
        </span>
      )}
      {summary.tideHeight && (
        <span className="flex items-center gap-1">
          <Droplets className="h-3.5 w-3.5 text-teal-400" />
          {summary.tideHeight}
        </span>
      )}
      {summary.waterTemp && (
        <span className="flex items-center gap-1">
          <Thermometer className="h-3.5 w-3.5 text-orange-400" />
          {summary.waterTemp}
        </span>
      )}
      {getSummaryTrendIndicator(summary.trend)}
    </div>
  );
}
