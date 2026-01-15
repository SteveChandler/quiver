"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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

  // Default return for empty/missing data
  const defaultResult: DynamicTideResult = {
    nextTide: null,
    minutesUntil: null,
    nextHigh: null,
    nextLow: null,
    minutesToHigh: null,
    minutesToLow: null,
    usingFallback: true,
  };

  if (!forecasts || forecasts.length === 0) {
    return defaultResult;
  }

  return defaultResult;
}
