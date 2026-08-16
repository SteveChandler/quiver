"use server";

import { unstable_cache } from "next/cache";
import { createPublicReadClient } from "@/lib/supabase/server";
import { rankBeaches } from "@/lib/recommendations/selection";
import { WATER_QUALITY_HOLD_PREFETCH_BUFFER } from "@/lib/recommendations/major-event-hold/water-quality";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CityBeachCondition {
  beachId: string;
  beachName: string;
  beachSlug: string;
  citySlug: string;
  stateSlug: string;
  waveHeight: string | null;
  windDescription: string | null;
  score: number;
  whySentence: string | null;
}

export interface CitySurfReportSummary {
  overallVerdict: "firing" | "good" | "fair" | "poor";
  bestBeach: CityBeachCondition | null;
  beaches: CityBeachCondition[];
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

/** Parse a string like "3-4 ft" or "5 ft" into a single numeric feet value. */
function parseWaveHeightFt(raw: string | null): number {
  if (!raw) return 0;
  // Handle range like "3-4 ft"
  const rangeMatch = raw.match(/([\d.]+)\s*-\s*([\d.]+)/);
  if (rangeMatch) {
    return (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2;
  }
  const single = parseFloat(raw);
  return isNaN(single) ? 0 : single;
}

/** Parse a string like "12 mph" or "8 kts" into numeric value. */
function parseWindSpeed(raw: string | null): number {
  if (!raw) return 0;
  const match = raw.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

/** Parse a string like "12 s" or "14" into seconds. */
function parsePeriod(raw: string | null): number {
  if (!raw) return 0;
  const match = raw.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Simple heuristic score: (wave_height * period) / (wind_speed + 1).
 * Higher is better. Clamped to 0-100.
 */
function computeBeachScore(
  waveHeight: string | null,
  wavePeriod: string | null,
  windSpeed: string | null,
): number {
  const h = parseWaveHeightFt(waveHeight);
  const p = parsePeriod(wavePeriod);
  const w = parseWindSpeed(windSpeed);

  if (h === 0) return 0;

  // Raw score roughly 0-80 for typical surf conditions
  const raw = (h * p) / (w + 1);
  return Math.min(100, Math.round(raw * 2));
}

/** Map a numeric score to a human-friendly verdict. */
function scoreToVerdict(score: number): CitySurfReportSummary["overallVerdict"] {
  if (score >= 70) return "firing";
  if (score >= 45) return "good";
  if (score >= 20) return "fair";
  return "poor";
}

/** Build a short descriptive sentence from conditions. */
function buildWhySentence(
  waveHeight: string | null,
  windSpeed: string | null,
  wavePeriod: string | null,
): string | null {
  const h = parseWaveHeightFt(waveHeight);
  if (h === 0) return null;

  const w = parseWindSpeed(windSpeed);
  const p = parsePeriod(wavePeriod);

  const parts: string[] = [];

  if (p >= 12) parts.push("long-period swell");
  else if (p >= 8) parts.push("medium-period swell");

  if (w <= 5) parts.push("light winds");
  else if (w <= 10) parts.push("moderate winds");
  else parts.push("windy");

  return parts.length > 0 ? parts.join(", ").replace(/^./, (c) => c.toUpperCase()) : null;
}

/** Describe wind in a user-friendly way. */
function describeWind(windSpeed: string | null): string | null {
  const w = parseWindSpeed(windSpeed);
  if (w === 0 && !windSpeed) return null;
  if (w <= 5) return "Light";
  if (w <= 10) return "Moderate";
  if (w <= 18) return "Breezy";
  return "Strong";
}

// ---------------------------------------------------------------------------
// Main query (wrapped in unstable_cache)
// ---------------------------------------------------------------------------

async function fetchCitySurfReport(
  cityName: string,
  stateSlug: string,
): Promise<CitySurfReportSummary | null> {
  try {
    const supabase = createPublicReadClient();

    // Prefer today's rows, but allow recent cached rows so city pages still
    // expose real conditions when a local/dev fixture is slightly stale.
    const now = new Date();
    const recentStart = new Date(now);
    recentStart.setUTCDate(recentStart.getUTCDate() - 3);

    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

    // Query enhanced_forecasts joined with beaches for the given city/state.
    // We select the most recent forecast per beach for today.
    const { data: forecasts, error } = await supabase
      .from("enhanced_forecasts")
      .select(
        `
        beach_id,
        forecast_at,
        wave_height,
        wave_period,
        wind_speed,
        wind_direction,
        beaches!inner (
          id,
          name,
          slug,
          city,
          state
        )
      `,
      )
      .ilike("beaches.state", stateSlug)
      .gte("forecast_at", recentStart.toISOString())
      .lt("forecast_at", tomorrowStart.toISOString())
      .order("forecast_at", { ascending: false })
      .limit(200 + WATER_QUALITY_HOLD_PREFETCH_BUFFER);

    if (error) {
      console.error("[getCitySurfReport] Query error:", error.message);
      return null;
    }

    if (!forecasts || forecasts.length === 0) return null;

    // Filter to beaches matching the city name (case-insensitive).
    // The city slug could be "la-jolla-san-diego" while the DB city is "La Jolla".
    // We match on the slugified city name from the DB.
    const cityNameLower = cityName.toLowerCase();

    // Group by beach_id and keep only the most recent forecast per beach
    const latestByBeach = new Map<
      string,
      {
        beach_id: string;
        wave_height: string | null;
        wave_period: string | null;
        wind_speed: string | null;
        wind_direction: string | null;
        forecast_at: string;
        beach: { id: string; name: string; slug: string | null; city: string | null; state: string | null };
      }
    >();

    for (const row of forecasts) {
      // beaches is returned as a single object via !inner join
      const beach = row.beaches as unknown as {
        id: string;
        name: string;
        slug: string | null;
        city: string | null;
        state: string | null;
      };

      if (!beach || !beach.city) continue;

      // Match city name (case-insensitive)
      if (beach.city.toLowerCase() !== cityNameLower) continue;

      // Keep latest forecast per beach (results are ordered desc by forecast_at)
      if (!latestByBeach.has(row.beach_id)) {
        latestByBeach.set(row.beach_id, {
          beach_id: row.beach_id,
          wave_height: row.wave_height,
          wave_period: row.wave_period,
          wind_speed: row.wind_speed,
          wind_direction: row.wind_direction,
          forecast_at: row.forecast_at,
          beach,
        });
      }
    }

    if (latestByBeach.size === 0) return null;

    // Build conditions array, score, and sort
    const conditions: CityBeachCondition[] = [];
    for (const [, forecast] of latestByBeach) {
      const score = computeBeachScore(
        forecast.wave_height,
        forecast.wave_period,
        forecast.wind_speed,
      );

      conditions.push({
        beachId: forecast.beach.id,
        beachName: forecast.beach.name,
        beachSlug: forecast.beach.slug ?? "",
        citySlug: forecast.beach.city ?? "",
        stateSlug,
        waveHeight: forecast.wave_height,
        windDescription: describeWind(forecast.wind_speed),
        score,
        whySentence: buildWhySentence(
          forecast.wave_height,
          forecast.wind_speed,
          forecast.wave_period,
        ),
      });
    }

    const rankedConditions = await rankBeaches(
      conditions.map((condition) => ({
        id: condition.beachId,
        condition,
      })),
      { compare: (left, right) => right.condition.score - left.condition.score },
    );
    const limited = rankedConditions
      .slice(0, 15)
      .map(({ condition }) => condition);
    const bestBeach = limited[0] ?? null;

    return {
      overallVerdict: bestBeach ? scoreToVerdict(bestBeach.score) : "poor",
      bestBeach,
      beaches: limited,
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[getCitySurfReport] Unexpected error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cached public entry point
// ---------------------------------------------------------------------------

/**
 * Get a recent surf report summary for a city.
 *
 * Cached for 15 minutes via unstable_cache. Server-only (ISR-safe).
 * Returns null when no forecast data is available so the UI degrades gracefully.
 */
export async function getCitySurfReport(
  cityName: string,
  stateSlug: string,
): Promise<CitySurfReportSummary | null> {
  const cityKey = cityName.toLowerCase().replace(/\s+/g, "-");

  const cached = unstable_cache(
    () => fetchCitySurfReport(cityName, stateSlug),
    [`city-surf-report`, "recent-v2", cityKey, stateSlug],
    { revalidate: 900, tags: [`city-surf-report-${cityKey}`] },
  );

  return cached();
}
