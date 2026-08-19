/**
 * Tide Meta Data Helper for SEO
 *
 * Fetches tide data for beach pages to generate dynamic SEO metadata
 * with specific tide times that create unique SERP snippets.
 */

import { cache } from "react";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { DEFAULT_TIMEZONE } from "@/lib/utils/timezone-constants";
import { getTimezoneFromCoords } from "@/lib/utils/timezone-utils.server";

export interface TideMetaData {
  /** Next high tide time formatted for display (e.g., "2:30 PM") */
  nextHighTime: string | null;
  /** Next low tide time formatted for display (e.g., "8:45 AM") */
  nextLowTime: string | null;
  /** Next high tide height in feet */
  nextHighHeight: number | null;
  /** Next low tide height in feet */
  nextLowHeight: number | null;
}

/**
 * Format a timestamp to a human-readable time string in the specified timezone.
 * Defaults to America/Los_Angeles if no timezone provided.
 */
function formatTideTime(ts: string | Date, timezone: string = DEFAULT_TIMEZONE): string {
  const date = typeof ts === "string" ? new Date(ts) : ts;
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  });
}

const METERS_TO_FEET = 3.28084;

export interface TideHeightRow {
  ts: string;
  tide_height_m: number | null;
}

export interface NextTideExtremes {
  nextHigh: { ts: string; heightFt: number } | null;
  nextLow: { ts: string; heightFt: number } | null;
}

/**
 * Find the next high and low tide from an ascending series of hourly heights.
 *
 * Shared deliberately: the sitemap and the sub-page's generateMetadata must
 * decide "does this beach have tide data" from the same computation, or a URL
 * can be listed in the sitemap while the page it points at answers noindex.
 * A beach with rows but no detectable extreme is NOT covered.
 */
export function findNextTideExtremes(
  rows: readonly TideHeightRow[],
): NextTideExtremes {
  let nextHigh: NextTideExtremes["nextHigh"] = null;
  let nextLow: NextTideExtremes["nextLow"] = null;

  // Check first data point as potential extreme (edge case)
  if (rows.length >= 2) {
    const first = rows[0].tide_height_m;
    const second = rows[1].tide_height_m;
    if (first !== null && second !== null) {
      // First point is high if it's higher than second
      if (first > second) {
        nextHigh = { ts: rows[0].ts, heightFt: first * METERS_TO_FEET };
      }
      // First point is low if it's lower than second
      if (first < second) {
        nextLow = { ts: rows[0].ts, heightFt: first * METERS_TO_FEET };
      }
    }
  }

  // Simple peak detection: look for direction changes
  for (let i = 1; i < rows.length - 1; i++) {
    const prev = rows[i - 1].tide_height_m;
    const curr = rows[i].tide_height_m;
    const next = rows[i + 1].tide_height_m;

    if (prev !== null && curr !== null && next !== null) {
      if (curr > prev && curr > next && !nextHigh) {
        nextHigh = { ts: rows[i].ts, heightFt: curr * METERS_TO_FEET };
      }
      if (curr < prev && curr < next && !nextLow) {
        nextLow = { ts: rows[i].ts, heightFt: curr * METERS_TO_FEET };
      }
    }

    if (nextHigh && nextLow) break;
  }

  return { nextHigh, nextLow };
}

/**
 * Get tide metadata for SEO purposes.
 *
 * Uses React's cache() for request deduplication between generateMetadata
 * and page component calls.
 *
 * @param beachId Beach UUID to fetch tides for
 * @returns Tide meta data with formatted times, or nulls if unavailable
 */
export const getTideMetaData = cache(
  async (beachId: string): Promise<TideMetaData> => {
    const nullResult: TideMetaData = {
      nextHighTime: null,
      nextLowTime: null,
      nextHighHeight: null,
      nextLowHeight: null,
    };

    if (!beachId) return nullResult;

    try {
      const supabase = await createSupabaseServiceRoleClient();

      // Fetch beach coordinates for timezone calculation
      const { data: beach, error: beachError } = await supabase
        .from("beaches")
        .select("lat, lon, timezone")
        .eq("id", beachId)
        .single();

      // Determine timezone: prefer DB column, fallback to geo-tz, then default
      let timezone = DEFAULT_TIMEZONE;
      if (!beachError && beach) {
        if (beach.timezone) {
          timezone = beach.timezone;
        } else if (beach.lat != null && beach.lon != null) {
          timezone = getTimezoneFromCoords(beach.lat, beach.lon) || DEFAULT_TIMEZONE;
        }
      }

      const now = new Date();
      const endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Next 24 hours

      // Query tide_forecasts table for this beach
      const { data: rows, error } = await supabase
        .from("tide_forecasts")
        .select("ts, tide_height_m, tide_phase")
        .eq("beach_id", beachId)
        .gte("ts", now.toISOString())
        .lte("ts", endTime.toISOString())
        .order("ts", { ascending: true });

      if (error || !rows || rows.length === 0) {
        return nullResult;
      }

      const { nextHigh, nextLow } = findNextTideExtremes(rows);

      return {
        nextHighTime: nextHigh ? formatTideTime(nextHigh.ts, timezone) : null,
        nextLowTime: nextLow ? formatTideTime(nextLow.ts, timezone) : null,
        nextHighHeight: nextHigh ? Math.round(nextHigh.heightFt * 10) / 10 : null,
        nextLowHeight: nextLow ? Math.round(nextLow.heightFt * 10) / 10 : null,
      };
    } catch (error) {
      console.error("[getTideMetaData] Error fetching tide data:", {
        beachId,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      return nullResult;
    }
  }
);
