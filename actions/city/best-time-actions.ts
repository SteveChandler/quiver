"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withServerAction, type ServerActionResponse } from "@/lib/server-action-utils";
import { getRegionalData } from "@/lib/seo/regional-surf-data";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Monthly surf data for one month in a city.
 */
export interface MonthlySurfEntry {
  month: number; // 1-12
  monthName: string;
  /** How many beaches list this month as a "best month" */
  bestMonthCount: number;
  /** Percentage of city beaches that peak this month (0-100) */
  score: number;
}

/**
 * Full best-time-to-surf dataset for a city.
 */
export interface BestTimeToSurfData {
  cityName: string;
  state: string;
  stateName: string;
  stateSlug: string;
  totalBeaches: number;
  /** Month with the highest score */
  peakMonth: number;
  peakMonthName: string;
  peakScore: number;
  /** Per-month breakdown */
  monthly: MonthlySurfEntry[];
  /** Regional data (water temp, wetsuit) */
  waterTempRange: string | null;
  summerWetsuit: string | null;
  winterWetsuit: string | null;
  /** Top beaches (for ItemList schema + links) */
  topBeaches: Array<{
    name: string;
    slug: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    bestMonths: number[];
    skillLevel: string | null;
    crowdLevel: string | null;
  }>;
}

const STATE_NAMES: Record<string, string> = {
  CA: "California", HI: "Hawaii", OR: "Oregon", WA: "Washington",
  FL: "Florida", NC: "North Carolina", SC: "South Carolina",
  NJ: "New Jersey", NY: "New York", TX: "Texas",
  MA: "Massachusetts", ME: "Maine", RI: "Rhode Island",
  NH: "New Hampshire", GA: "Georgia", PR: "Puerto Rico",
  VA: "Virginia", MD: "Maryland", DE: "Delaware", CT: "Connecticut",
  AL: "Alabama", MS: "Mississippi", LA: "Louisiana",
};

/**
 * Fetch best-time-to-surf data for a city.
 *
 * Aggregates best_months from all beaches in the city to build
 * a month-by-month surf score. Enriches with regional water temp
 * and wetsuit data.
 */
export async function getBestTimeToSurfData(
  cityName: string,
  state: string
): Promise<ServerActionResponse<BestTimeToSurfData | null>> {
  return withServerAction(async () => {
    const supabase = await createSupabaseServerClient();
    const normalizedState = state.toUpperCase();

    const { data: beaches, error } = await supabase
      .from("beaches")
      .select("name, slug, city, state, country, best_months, skill_level, crowd_level")
      .ilike("city", cityName)
      .eq("state", normalizedState)
      .or("is_private.is.null,is_private.eq.false")
      .order("name");

    if (error) {
      throw new Error(error.message || "Failed to fetch city beaches");
    }

    if (!beaches || beaches.length === 0) {
      return null;
    }

    // Aggregate best_months counts across all beaches
    const monthCounts = new Array(12).fill(0);
    let beachesWithMonths = 0;

    for (const beach of beaches) {
      if (beach.best_months && beach.best_months.length > 0) {
        beachesWithMonths++;
        for (const month of beach.best_months) {
          if (month >= 1 && month <= 12) {
            monthCounts[month - 1]++;
          }
        }
      }
    }

    // If no beaches have best_months data, return null
    if (beachesWithMonths === 0) {
      return null;
    }

    // Build monthly entries with scores
    const maxCount = Math.max(...monthCounts);
    const monthly: MonthlySurfEntry[] = monthCounts.map((count, i) => ({
      month: i + 1,
      monthName: MONTH_NAMES[i],
      bestMonthCount: count,
      score: maxCount > 0 ? Math.round((count / maxCount) * 100) : 0,
    }));

    // Find peak month
    const peakIndex = monthCounts.indexOf(maxCount);
    const peakMonth = peakIndex + 1;

    // Regional data
    const stateSlug = normalizedState.toLowerCase();
    const regional = getRegionalData(stateSlug);

    const stateName = STATE_NAMES[normalizedState] || normalizedState;

    return {
      cityName,
      state: normalizedState,
      stateName,
      stateSlug,
      totalBeaches: beaches.length,
      peakMonth,
      peakMonthName: MONTH_NAMES[peakIndex],
      peakScore: monthly[peakIndex].score,
      monthly,
      waterTempRange: regional?.waterTempRange ?? null,
      summerWetsuit: regional?.summerWetsuit ?? null,
      winterWetsuit: regional?.winterWetsuit ?? null,
      topBeaches: beaches
        .filter((b) => b.best_months && b.best_months.length > 0)
        .slice(0, 10)
        .map((b) => ({
          name: b.name,
          slug: b.slug,
          city: b.city,
          state: b.state,
          country: b.country,
          bestMonths: b.best_months || [],
          skillLevel: b.skill_level,
          crowdLevel: b.crowd_level,
        })),
    };
  });
}

/**
 * Get all cities that have best_months data for sitemap generation.
 */
export async function getCitiesWithBestMonthsData(): Promise<
  ServerActionResponse<Array<{ city: string; state: string; beachCount: number }>>
> {
  return withServerAction(async () => {
    const supabase = await createSupabaseServerClient();

    // Find all cities with at least one beach that has best_months data
    const { data, error } = await supabase
      .from("beaches")
      .select("city, state")
      .not("best_months", "is", null)
      .or("is_private.is.null,is_private.eq.false")
      .not("city", "is", null)
      .not("state", "is", null);

    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Group by city+state and count beaches
    const cityMap = new Map<string, { city: string; state: string; beachCount: number }>();
    for (const row of data) {
      if (!row.city || !row.state) continue;
      const key = `${row.city}|${row.state}`;
      const existing = cityMap.get(key);
      if (existing) {
        existing.beachCount++;
      } else {
        cityMap.set(key, { city: row.city, state: row.state, beachCount: 1 });
      }
    }

    return Array.from(cityMap.values()).filter((c) => c.beachCount >= 3);
  });
}
