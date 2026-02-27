/**
 * Beginner Seasonal Utilities
 *
 * Computes seasonal beginner-friendliness scores for surf states using a
 * tiered data strategy:
 *   Tier 1 - Full StateSurfProfile monthly data (best accuracy)
 *   Tier 2 - Regional surf data + climate zone estimates
 *   Tier 3 - Generic fallback with null detail fields
 *
 * Used by: beginner-friendly intent pages, seasonal recommendation cards.
 */

import { getStateSurfProfile } from "@/lib/data/monthly-surf-data";
import type { MonthlyData, StateSurfProfile } from "@/lib/data/monthly-surf-data";
import { waterTempComfortScore, crowdScore } from "@/lib/utils/surf-score-utils";
import { getRegionalData, getClimateZone } from "@/lib/seo/regional-surf-data";
import type { ClimateZone } from "@/lib/seo/regional-surf-data";

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface BeginnerSeasonData {
  season: string;
  months: string;
  beginnerScore: number;
  tier: "great" | "decent" | "challenging";
  color: string;
  waveRange: string | null;
  waterTempRange: string | null;
  wetsuit: string | null;
  crowdLevel: string | null;
  description: string;
}

export interface BeginnerSeasonalResult {
  seasons: BeginnerSeasonData[];
  dataSource: "state-profile" | "regional" | "generic";
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const SEASON_GROUPS = [
  { season: "Spring", months: "Mar-May", monthIndices: [2, 3, 4] },
  { season: "Summer", months: "Jun-Aug", monthIndices: [5, 6, 7] },
  { season: "Fall", months: "Sep-Nov", monthIndices: [8, 9, 10] },
  { season: "Winter", months: "Dec-Feb", monthIndices: [11, 0, 1] },
] as const;

const CLIMATE_WAVE_PATTERNS: Record<ClimateZone, Record<string, string>> = {
  tropical: {
    Spring: "2-4 ft",
    Summer: "2-5 ft",
    Fall: "3-5 ft",
    Winter: "4-8 ft",
  },
  "warm-atlantic": {
    Spring: "1-3 ft",
    Summer: "1-3 ft",
    Fall: "3-6 ft",
    Winter: "2-4 ft",
  },
  "cold-pacific": {
    Spring: "3-6 ft",
    Summer: "2-4 ft",
    Fall: "4-8 ft",
    Winter: "6-12 ft",
  },
  "temperate-pacific": {
    Spring: "2-4 ft",
    Summer: "2-4 ft",
    Fall: "3-6 ft",
    Winter: "4-8 ft",
  },
  "cold-atlantic": {
    Spring: "2-4 ft",
    Summer: "1-3 ft",
    Fall: "3-6 ft",
    Winter: "3-6 ft",
  },
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function mode<T>(arr: T[]): T {
  const counts = new Map<T, number>();
  for (const item of arr) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return [...counts.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

/**
 * Parse a wave height range string like "2-4 ft" into numeric min/max.
 * Handles formats: "2-4 ft", "2-4", "6-12 ft".
 */
function parseWaveRange(
  waveHeightRange: string
): { min: number; max: number } | null {
  const match = waveHeightRange.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const min = parseFloat(match[1]);
  const max = parseFloat(match[2]);
  if (isNaN(min) || isNaN(max)) return null;
  return { min, max };
}

// ---------------------------------------------------------------------------
// Exported scoring functions (needed by tests)
// ---------------------------------------------------------------------------

/**
 * Score wave height range for beginner suitability. Smaller waves score
 * higher because beginners learn best in gentle surf.
 */
export function waveSmallnessScore(waveHeightRange: string): number {
  const range = parseWaveRange(waveHeightRange);
  if (!range) return 50; // neutral fallback for unparseable input
  const midpoint = (range.min + range.max) / 2;

  if (midpoint <= 2) return 95;
  if (midpoint <= 3) return 80;
  if (midpoint <= 4) return 60;
  if (midpoint <= 5) return 40;
  if (midpoint <= 7) return 20;
  return 10;
}

/**
 * Weighted composite beginner score for a single month:
 *   40% wave smallness
 *   35% water temp comfort
 *   15% crowd avoidance
 *   10% constant floor (50)
 */
export function computeBeginnerMonthScore(monthData: MonthlyData): number {
  const wave = waveSmallnessScore(monthData.waveHeightRange);
  const temp = waterTempComfortScore(monthData.waterTemp);
  const crowd = crowdScore(monthData.crowdLevel);

  const raw = 0.4 * wave + 0.35 * temp + 0.15 * crowd + 0.1 * 50;
  return clamp(Math.round(raw));
}

/**
 * Map a numeric beginner score to a human-readable tier and Tailwind color.
 */
export function scoreToTier(score: number): {
  tier: "great" | "decent" | "challenging";
  color: string;
} {
  if (score >= 65) {
    return { tier: "great", color: "bg-green-50 border-green-200" };
  }
  if (score >= 40) {
    return { tier: "decent", color: "bg-amber-50 border-amber-200" };
  }
  return { tier: "challenging", color: "bg-red-50 border-red-200" };
}

// ---------------------------------------------------------------------------
// Tier 1 - Full StateSurfProfile data
// ---------------------------------------------------------------------------

function buildTier1Seasons(profile: StateSurfProfile): BeginnerSeasonData[] {
  return SEASON_GROUPS.map((group) => {
    const monthEntries = group.monthIndices.map((i) => profile.monthly[i]);

    // Average beginner score across the 3 months
    const beginnerScore = Math.round(
      monthEntries.reduce((sum, m) => sum + computeBeginnerMonthScore(m), 0) /
        monthEntries.length
    );

    // Aggregate wave ranges: min of mins, max of maxes
    const waveRanges = monthEntries
      .map((m) => parseWaveRange(m.waveHeightRange))
      .filter((r): r is { min: number; max: number } => r !== null);
    const waveRange =
      waveRanges.length > 0
        ? `${Math.min(...waveRanges.map((r) => r.min))}-${Math.max(...waveRanges.map((r) => r.max))} ft`
        : null;

    // Aggregate water temps: min and max across months
    const temps = monthEntries.map((m) => m.waterTemp);
    const tempMin = Math.min(...temps);
    const tempMax = Math.max(...temps);
    const waterTempRange = `${tempMin}-${tempMax}`;

    // Most common wetsuit and crowd level
    const wetsuit = mode(monthEntries.map((m) => m.wetsuit));
    const crowdLevel = mode(monthEntries.map((m) => m.crowdLevel));

    const { tier, color } = scoreToTier(beginnerScore);

    let description: string;
    if (tier === "great") {
      description = `Gentle ${waveRange} waves with ${waterTempRange}\u00B0F water. ${wetsuit} conditions. Ideal for learning.`;
    } else if (tier === "decent") {
      description = `Mixed ${waveRange} waves \u2014 look for calmer days. ${waterTempRange}\u00B0F water, ${wetsuit} recommended.`;
    } else {
      description = `Powerful ${waveRange} waves challenge most beginners. ${waterTempRange}\u00B0F water requires a ${wetsuit}. Stick to sheltered spots.`;
    }

    return {
      season: group.season,
      months: group.months,
      beginnerScore,
      tier,
      color,
      waveRange,
      waterTempRange,
      wetsuit,
      crowdLevel,
      description,
    };
  });
}

// ---------------------------------------------------------------------------
// Tier 2 - Regional data + climate zone estimates
// ---------------------------------------------------------------------------

function buildTier2Seasons(stateSlug: string): BeginnerSeasonData[] {
  const regional = getRegionalData(stateSlug);
  const zone = getClimateZone(stateSlug);

  // Parse regional water temp range for sinusoidal estimation
  const tempMatch = regional?.waterTempRange.match(
    /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/
  );
  const tempLow = tempMatch ? parseFloat(tempMatch[1]) : 60;
  const tempHigh = tempMatch ? parseFloat(tempMatch[2]) : 70;
  const tempAvg = (tempLow + tempHigh) / 2;
  const tempAmplitude = (tempHigh - tempLow) / 2;

  // Sinusoidal temperature model: peaks at month 7 (August)
  function estimatedTemp(monthIndex: number): number {
    return (
      tempAvg +
      tempAmplitude * Math.cos((2 * Math.PI * (monthIndex - 7)) / 12)
    );
  }

  return SEASON_GROUPS.map((group) => {
    const waveRange =
      CLIMATE_WAVE_PATTERNS[zone]?.[group.season] ?? "2-4 ft";

    // Average estimated temp across the 3 months of the season
    const seasonTemps = group.monthIndices.map((i) => estimatedTemp(i));
    const avgTemp =
      seasonTemps.reduce((sum, t) => sum + t, 0) / seasonTemps.length;
    const tempMin = Math.round(Math.min(...seasonTemps));
    const tempMax = Math.round(Math.max(...seasonTemps));
    const waterTempRange = `${tempMin}-${tempMax}`;

    // Wetsuit: summer suit for warm seasons, winter suit for cold seasons
    const isWarmSeason =
      group.season === "Summer" || group.season === "Spring";
    const wetsuit = isWarmSeason
      ? (regional?.summerWetsuit ?? "spring suit")
      : (regional?.winterWetsuit ?? "4/3mm");

    const crowdLevel = "moderate";

    // Compute beginner score from wave smallness + temp comfort
    const waveScore = waveSmallnessScore(waveRange);
    const tempScore = waterTempComfortScore(Math.round(avgTemp));
    const crowdVal = crowdScore(crowdLevel);
    const beginnerScore = clamp(
      Math.round(0.4 * waveScore + 0.35 * tempScore + 0.15 * crowdVal + 0.1 * 50)
    );

    const { tier, color } = scoreToTier(beginnerScore);

    let description: string;
    if (tier === "great") {
      description = `Typically gentle ${waveRange} waves with ${waterTempRange}\u00B0F water. ${wetsuit} conditions. Ideal for learning.`;
    } else if (tier === "decent") {
      description = `Typically mixed ${waveRange} waves \u2014 look for calmer days. ${waterTempRange}\u00B0F water, ${wetsuit} recommended.`;
    } else {
      description = `Typically powerful ${waveRange} waves challenge most beginners. ${waterTempRange}\u00B0F water requires a ${wetsuit}. Stick to sheltered spots.`;
    }

    return {
      season: group.season,
      months: group.months,
      beginnerScore,
      tier,
      color,
      waveRange,
      waterTempRange,
      wetsuit,
      crowdLevel,
      description,
    };
  });
}

// ---------------------------------------------------------------------------
// Tier 3 - Generic fallback
// ---------------------------------------------------------------------------

function buildTier3Seasons(): BeginnerSeasonData[] {
  const fallbackScores: Record<string, number> = {
    Spring: 55,
    Summer: 65,
    Fall: 50,
    Winter: 35,
  };

  return SEASON_GROUPS.map((group) => {
    const beginnerScore = fallbackScores[group.season];
    const { tier, color } = scoreToTier(beginnerScore);

    return {
      season: group.season,
      months: group.months,
      beginnerScore,
      tier,
      color,
      waveRange: null,
      waterTempRange: null,
      wetsuit: null,
      crowdLevel: null,
      description:
        "Conditions vary by location. Check current forecasts for the best beginner days.",
    };
  });
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Get seasonal beginner-friendliness data for a US state.
 *
 * Uses a tiered fallback strategy:
 *   1. StateSurfProfile monthly data (best accuracy)
 *   2. Regional surf data with climate zone estimates
 *   3. Generic fallback with null detail fields
 */
export function getBeginnerSeasonalData(
  stateSlug: string
): BeginnerSeasonalResult {
  const slug = stateSlug.toLowerCase();

  // Tier 1: full monthly profile
  const profile = getStateSurfProfile(slug);
  if (profile) {
    return {
      seasons: buildTier1Seasons(profile),
      dataSource: "state-profile",
    };
  }

  // Tier 2: regional data available
  const regional = getRegionalData(slug);
  if (regional) {
    return {
      seasons: buildTier2Seasons(slug),
      dataSource: "regional",
    };
  }

  // Tier 3: generic fallback
  return {
    seasons: buildTier3Seasons(),
    dataSource: "generic",
  };
}
