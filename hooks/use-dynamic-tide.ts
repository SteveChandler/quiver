"use client";

import { useState, useMemo } from "react";
import type { EnhancedForecastEntity } from "@/types/forecast";

export interface TideExtreme {
  time: number; // Unix timestamp (seconds)
  height: number; // Height in feet
  type: "high" | "low";
}

export interface DynamicTideResult {
  /** The soonest upcoming tide (high or low) */
  nextTide: TideExtreme | null;
  /** Minutes until nextTide */
  minutesUntil: number | null;
  /** Next high tide */
  nextHigh: TideExtreme | null;
  /** Next low tide */
  nextLow: TideExtreme | null;
  /** Minutes until next high */
  minutesToHigh: number | null;
  /** Minutes until next low */
  minutesToLow: number | null;
  /** True if using fallback (no tide_schedule found) */
  usingFallback: boolean;
}

export function useDynamicTide(
  forecasts: EnhancedForecastEntity[],
  _beachTimezone?: string | null
): DynamicTideResult {
  const [computedAt, setComputedAt] = useState<number>(Date.now());

  // Extract tide_schedule from the first forecast that has it
  const tideSchedule = useMemo(() => {
    if (!forecasts || forecasts.length === 0) return null;

    for (const forecast of forecasts) {
      const schedule = forecast.raw_forecast?.tide_schedule;
      if (Array.isArray(schedule) && schedule.length > 0) {
        return schedule;
      }
    }
    return null;
  }, [forecasts]);

  // Compute next tides from schedule
  const tideResult = useMemo((): DynamicTideResult => {
    if (!tideSchedule) {
      return {
        nextTide: null,
        minutesUntil: null,
        nextHigh: null,
        nextLow: null,
        minutesToHigh: null,
        minutesToLow: null,
        usingFallback: true,
      };
    }

    const nowSeconds = computedAt / 1000;
    let nextHigh: TideExtreme | null = null;
    let nextLow: TideExtreme | null = null;

    for (const tide of tideSchedule) {
      if (tide.time > nowSeconds) {
        if (tide.type === "high" && !nextHigh) {
          nextHigh = { time: tide.time, height: tide.height, type: "high" };
        }
        if (tide.type === "low" && !nextLow) {
          nextLow = { time: tide.time, height: tide.height, type: "low" };
        }
        if (nextHigh && nextLow) break;
      }
    }

    // Determine which tide comes first
    let nextTide: TideExtreme | null = null;
    if (nextHigh && nextLow) {
      nextTide = nextHigh.time < nextLow.time ? nextHigh : nextLow;
    } else {
      nextTide = nextHigh || nextLow;
    }

    const minutesUntil = nextTide
      ? Math.round((nextTide.time - nowSeconds) / 60)
      : null;
    const minutesToHigh = nextHigh
      ? Math.round((nextHigh.time - nowSeconds) / 60)
      : null;
    const minutesToLow = nextLow
      ? Math.round((nextLow.time - nowSeconds) / 60)
      : null;

    return {
      nextTide,
      minutesUntil,
      nextHigh,
      nextLow,
      minutesToHigh,
      minutesToLow,
      usingFallback: false,
    };
  }, [tideSchedule, computedAt]);

  return tideResult;
}
