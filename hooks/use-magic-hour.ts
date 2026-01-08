"use client";

import { useCallback, useMemo } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { createClient } from "@/lib/supabase/client";
import {
  findMagicHour,
  type MagicHourResult,
  type BeachMetadata,
  type WeightConfig,
} from "@/lib/services/magic-hour-finder";
import type { EnhancedForecastEntity } from "@/types/forecast";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the useMagicHour hook.
 */
export interface UseMagicHourOptions {
  /**
   * Target date for Magic Hour calculation.
   * Defaults to current date/time if not provided.
   */
  targetDate?: Date;

  /**
   * Custom weights for multi-metric scoring.
   * Defaults: { tide: 0.4, wind: 0.35, swell: 0.25 }
   */
  weights?: WeightConfig;

  /**
   * Whether the hook is enabled.
   * When false, skips all data fetching.
   * @default true
   */
  enabled?: boolean;
}

/**
 * Return type for the useMagicHour hook.
 */
export interface UseMagicHourReturn {
  /**
   * The Magic Hour result, or null if not yet calculated or no optimal window found.
   */
  magicHour: MagicHourResult | null;

  /**
   * Whether the hook is currently loading data.
   */
  isLoading: boolean;

  /**
   * Error message if data fetching or calculation failed.
   */
  error: Error | null;

  /**
   * Function to manually refetch data and recalculate Magic Hour.
   */
  refetch: () => void;
}

/**
 * Internal data structure combining beach metadata and forecasts.
 */
interface MagicHourData {
  beachMetadata: BeachMetadata;
  forecasts: EnhancedForecastEntity[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetches beach metadata required for Magic Hour calculation.
 *
 * @param beachId - The beach UUID
 * @returns Beach metadata with surf preferences
 */
async function fetchBeachMetadata(beachId: string): Promise<BeachMetadata> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("beaches")
    .select(
      `
      id,
      name,
      slug,
      skill_level,
      swell_window_center_deg,
      swell_window_halfwidth_deg,
      wind_offshore_deg,
      wind_offshore_tol_deg,
      preferred_tide_ft_min,
      preferred_tide_ft_max
    `
    )
    .eq("id", beachId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch beach metadata: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Beach not found: ${beachId}`);
  }

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    skill_level: data.skill_level,
    swell_window_center_deg: data.swell_window_center_deg,
    swell_window_halfwidth_deg: data.swell_window_halfwidth_deg,
    wind_offshore_deg: data.wind_offshore_deg,
    wind_offshore_tol_deg: data.wind_offshore_tol_deg,
    preferred_tide_ft_min: data.preferred_tide_ft_min,
    preferred_tide_ft_max: data.preferred_tide_ft_max,
  };
}

/**
 * Fetches enhanced forecasts for the next 48 hours.
 *
 * @param beachId - The beach UUID
 * @returns Array of enhanced forecast entities
 */
async function fetchEnhancedForecasts(
  beachId: string
): Promise<EnhancedForecastEntity[]> {
  const supabase = createClient();

  // Calculate date range: now to 48 hours from now
  const now = new Date();
  const endDate = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  // Format dates for query (YYYY-MM-DD)
  const startDateStr = now.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("enhanced_forecasts")
    .select("*")
    .eq("beach_id", beachId)
    .gte("forecast_date", startDateStr)
    .lte("forecast_date", endDateStr)
    .order("forecast_date", { ascending: true })
    .order("forecast_time", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch forecasts: ${error.message}`);
  }

  return (data as EnhancedForecastEntity[]) || [];
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * React hook for finding the optimal surf window ("Magic Hour") for a beach.
 *
 * This hook wraps the Magic Hour utility for easy use in React components.
 * It handles:
 * - Fetching beach metadata (swell window, wind preferences, tide range)
 * - Fetching enhanced forecasts (next 48 hours)
 * - Calculating the Magic Hour with multi-metric weighted scoring
 * - Memoizing results to avoid recalculation on every render
 *
 * @param beachId - The beach UUID to find Magic Hour for, or null to skip
 * @param options - Optional configuration (targetDate, weights, enabled)
 * @returns Magic Hour result with loading/error states and refetch function
 *
 * @example
 * ```tsx
 * function BeachDetail({ beachId }: { beachId: string }) {
 *   const { magicHour, isLoading, error, refetch } = useMagicHour(beachId, {
 *     enabled: true,
 *   });
 *
 *   if (isLoading) return <div>Finding optimal surf window...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!magicHour?.found) return <div>No optimal window found</div>;
 *
 *   return (
 *     <div>
 *       <h3>Magic Hour</h3>
 *       <p>{magicHour.windowStart} - {magicHour.windowEnd}</p>
 *       <p>Confidence: {Math.round(magicHour.confidence * 100)}%</p>
 *       <p>Wind: {magicHour.windQuality}</p>
 *       <button onClick={refetch}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With custom weights prioritizing tide conditions
 * const { magicHour } = useMagicHour(beachId, {
 *   weights: { tide: 0.5, wind: 0.3, swell: 0.2 },
 *   targetDate: new Date('2025-01-08'),
 * });
 * ```
 *
 * @example
 * ```tsx
 * // Conditionally enabled based on user preferences
 * const { magicHour } = useMagicHour(beachId, {
 *   enabled: userPreferences.showMagicHour,
 * });
 * ```
 */
export function useMagicHour(
  beachId: string | null,
  options: UseMagicHourOptions = {}
): UseMagicHourReturn {
  const { targetDate, weights, enabled = true } = options;

  // Memoize fetch function to prevent recreating on every render
  const fetchMagicHourData = useCallback(async (): Promise<MagicHourData> => {
    if (!beachId) {
      throw new Error("Beach ID is required");
    }

    // Fetch beach metadata and forecasts in parallel
    const [beachMetadata, forecasts] = await Promise.all([
      fetchBeachMetadata(beachId),
      fetchEnhancedForecasts(beachId),
    ]);

    return { beachMetadata, forecasts };
  }, [beachId]);

  // Use standard data fetcher pattern
  const {
    data,
    loading,
    error: fetchError,
    refetch,
  } = useDataFetcher(fetchMagicHourData, {
    immediate: enabled && !!beachId,
    skip: !enabled || !beachId,
  });

  // Memoize Magic Hour calculation to avoid recalculation on every render
  const magicHour = useMemo(() => {
    if (!data) {
      return null;
    }

    const { beachMetadata, forecasts } = data;

    // No forecasts available
    if (forecasts.length === 0) {
      return {
        found: false,
        peakTime: null,
        windowStart: null,
        windowEnd: null,
        confidence: 0,
        swellMatch: false,
        windQuality: null,
        tideInRange: false,
      } as MagicHourResult;
    }

    // Calculate Magic Hour using the service
    return findMagicHour(forecasts, beachMetadata, {
      weights,
      targetDate,
    });
  }, [data, weights, targetDate]);

  // Convert string error to Error object for consistent interface
  const error = fetchError ? new Error(fetchError) : null;

  return {
    magicHour,
    isLoading: loading,
    error,
    refetch,
  };
}

// Re-export types from magic-hour-finder for convenience
export type { MagicHourResult, BeachMetadata, WeightConfig };
