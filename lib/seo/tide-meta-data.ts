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
import { selectTideSeries } from "@/lib/services/tide-forecast-selection";

export interface TideMetaData {
  /** tide_forecasts.source of the series read; "fes2022" marks model tides, which need a source note. */
  source?: string | null;
  /** Next high tide time formatted for display (e.g., "2:30 PM") */
  nextHighTime: string | null;
  /** Next low tide time formatted for display (e.g., "8:45 AM") */
  nextLowTime: string | null;
  /** Next high tide height in feet */
  nextHighHeight: number | null;
  /** Next low tide height in feet */
  nextLowHeight: number | null;
  /**
   * ISO timestamp of the next high tide. The display times carry no date, so
   * ordering the two events (e.g. a high tonight, a low after midnight) needs this.
   */
  nextHighAt: string | null;
  /** ISO timestamp of the next low tide. */
  nextLowAt: string | null;
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
const HOUR_MS = 60 * 60 * 1000;

/**
 * The tide rows the next-extreme search reads. It starts an hour before now
 * so the first reading ahead has a neighbour on both sides; that earlier
 * reading is never reported itself. It ends 24 hours ahead because the times
 * are shown without a date. The sitemap must read this same span, or its
 * coverage stops matching the sub-page's.
 */
export function tideExtremesWindow(now: Date): { from: string; to: string } {
  return {
    from: new Date(now.getTime() - HOUR_MS).toISOString(),
    to: new Date(now.getTime() + 24 * HOUR_MS).toISOString(),
  };
}

export interface TideHeightRow {
  ts: string;
  tide_height_m: number | null;
}

interface NextTideExtremes {
  nextHigh: { ts: string; heightFt: number } | null;
  nextLow: { ts: string; heightFt: number } | null;
}

/**
 * Find the next high and low tide from an ascending series of hourly heights,
 * read over tideExtremesWindow.
 *
 * Only interior turning points count: a reading strictly higher, or lower,
 * than the readings on both sides. The first and last rows are never
 * extremes, because the reading beyond them is unknown; taking the first row
 * as a high whenever the tide fell from it put the "next high" and "next low"
 * an hour apart. Equal consecutive readings at a slack are one turn, timed at
 * the first of them: heights are rounded to the millimetre, so a turn often
 * reads the same two hours running.
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

  let i = 1;
  while (i < rows.length - 1) {
    const prev = rows[i - 1].tide_height_m;
    const curr = rows[i].tide_height_m;
    let end = i;
    while (end + 1 < rows.length && rows[end + 1].tide_height_m === curr) end++;
    const next = end + 1 < rows.length ? rows[end + 1].tide_height_m : null;

    // prev === curr only when the run began at the first row, so it is not interior.
    if (prev !== null && curr !== null && next !== null && prev !== curr) {
      if (curr > prev && curr > next && !nextHigh) {
        nextHigh = { ts: rows[i].ts, heightFt: curr * METERS_TO_FEET };
      }
      if (curr < prev && curr < next && !nextLow) {
        nextLow = { ts: rows[i].ts, heightFt: curr * METERS_TO_FEET };
      }
      if (nextHigh && nextLow) break;
    }

    i = end + 1;
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
      source: null,
      nextHighTime: null,
      nextLowTime: null,
      nextHighHeight: null,
      nextLowHeight: null,
      nextHighAt: null,
      nextLowAt: null,
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

      const tideWindow = tideExtremesWindow(new Date());

      // Query tide_forecasts table for this beach
      const { data: rows, error } = await supabase
        .from("tide_forecasts")
        .select("ts, tide_height_m, tide_phase, source, station_id, created_at")
        .eq("beach_id", beachId)
        .gte("ts", tideWindow.from)
        .lte("ts", tideWindow.to)
        .order("ts", { ascending: true });

      if (error || !rows || rows.length === 0) {
        return nullResult;
      }

      const selectedRows = selectTideSeries(rows);
      const { nextHigh, nextLow } = findNextTideExtremes(selectedRows);

      return {
        source: selectedRows[0]?.source ?? null,
        nextHighTime: nextHigh ? formatTideTime(nextHigh.ts, timezone) : null,
        nextLowTime: nextLow ? formatTideTime(nextLow.ts, timezone) : null,
        nextHighHeight: nextHigh ? Math.round(nextHigh.heightFt * 10) / 10 : null,
        nextLowHeight: nextLow ? Math.round(nextLow.heightFt * 10) / 10 : null,
        nextHighAt: nextHigh?.ts ?? null,
        nextLowAt: nextLow?.ts ?? null,
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
