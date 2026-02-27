/**
 * Surf Score Utilities
 *
 * Pure utility functions for computing composite surf scores with
 * shoulder smoothing. No server or Supabase dependencies.
 *
 * Used by: best-time-to-surf pages, discovery scoring, monthly rankings.
 */

const MONTHS = 12;

// Gaussian-like convolution kernel centered on the target month
const SHOULDER_KERNEL = [0.25, 0.5, 1.0, 0.5, 0.25] as const;
const KERNEL_CENTER = 2; // index of the 1.0 weight

/**
 * Apply shoulder smoothing to raw monthly counts using a Gaussian-like
 * convolution kernel with circular wrapping (Dec wraps to Jan).
 *
 * @param monthCounts 12-element array of raw month counts
 * @returns 12-element array of smoothed (non-rounded) values
 */
export function applyShoulderSmoothing(monthCounts: number[]): number[] {
  if (monthCounts.length !== MONTHS) {
    throw new Error(
      `applyShoulderSmoothing expects 12-element array, got ${monthCounts.length}`
    );
  }

  const smoothed: number[] = new Array(MONTHS);

  for (let month = 0; month < MONTHS; month++) {
    let sum = 0;
    let weightSum = 0;

    for (let k = 0; k < SHOULDER_KERNEL.length; k++) {
      const offset = k - KERNEL_CENTER;
      const sourceMonth = ((month + offset) % MONTHS + MONTHS) % MONTHS;
      const weight = SHOULDER_KERNEL[k];
      sum += monthCounts[sourceMonth] * weight;
      weightSum += weight;
    }

    smoothed[month] = sum / weightSum;
  }

  return smoothed;
}

/**
 * Map water temperature (Fahrenheit) to a 0-100 comfort score using
 * piecewise linear interpolation.
 */
export function waterTempComfortScore(tempF: number): number {
  if (tempF < 45) return 10;
  if (tempF <= 55) return Math.round(20 + ((tempF - 45) / 10) * 20);
  if (tempF <= 65) return Math.round(40 + ((tempF - 55) / 10) * 30);
  if (tempF <= 78) return Math.round(70 + ((tempF - 65) / 13) * 30);
  return 90;
}

/**
 * Map crowd level to a desirability score (higher = less crowded = better).
 */
export function crowdScore(level: "low" | "moderate" | "high"): number {
  switch (level) {
    case "low":
      return 100;
    case "moderate":
      return 60;
    case "high":
      return 30;
  }
}

/**
 * Tier-based weighted blend for composite surf score.
 *
 * - Tier 1 (StateSurfProfile): 60% beach + 25% state + 10% water + 5% crowd
 * - Tier 2 (RegionalSurfData): 80% beach + 15% water + 5% crowd
 * - Tier 3 (no supplementary):  100% beach
 */
export function computeCompositeScore(
  beachPeakScore: number,
  options?: {
    stateOverallScore?: number;
    waterTempComfort?: number;
    crowdBonus?: number;
    tier: 1 | 2 | 3;
  }
): number {
  if (!options || options.tier === 3) {
    return clamp(Math.round(beachPeakScore));
  }

  if (options.tier === 1) {
    const raw =
      0.6 * beachPeakScore +
      0.25 * (options.stateOverallScore ?? 0) +
      0.1 * (options.waterTempComfort ?? 0) +
      0.05 * (options.crowdBonus ?? 0);
    return clamp(Math.round(raw));
  }

  // Tier 2
  const raw =
    0.8 * beachPeakScore +
    0.15 * (options.waterTempComfort ?? 0) +
    0.05 * (options.crowdBonus ?? 0);
  return clamp(Math.round(raw));
}

/**
 * Parse a "low-high" water temperature range string (e.g. "78-84") into
 * 12 monthly estimated temperatures using a sinusoidal model.
 *
 * Peaks in August (index 7), troughs in February (index 1).
 *
 * @returns null if input is null or unparseable
 */
export function estimateMonthlyTemps(
  waterTempRange: string | null
): number[] | null {
  if (!waterTempRange) return null;

  const match = waterTempRange.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const low = parseFloat(match[1]);
  const high = parseFloat(match[2]);
  if (isNaN(low) || isNaN(high) || low > high) return null;

  const avg = (low + high) / 2;
  const amplitude = (high - low) / 2;

  const temps: number[] = new Array(MONTHS);
  for (let m = 0; m < MONTHS; m++) {
    temps[m] = avg + amplitude * Math.cos((2 * Math.PI * (m - 7)) / MONTHS);
  }

  return temps;
}

/**
 * Orchestrator: build 12 monthly composite scores from raw month counts
 * and optional supplementary data.
 *
 * 1. Shoulder-smooth the raw counts
 * 2. Normalize to 0-100
 * 3. Determine tier and blend with supplementary signals
 */
export function buildMonthlyScores(
  monthCounts: number[],
  stateMonthly?: Array<{
    overallScore: number;
    waterTemp: number;
    crowdLevel: "low" | "moderate" | "high";
  }>,
  estimatedTemps?: number[] | null,
  waterTempRange?: string | null
): number[] {
  const smoothed = applyShoulderSmoothing(monthCounts);

  const maxSmoothed = Math.max(...smoothed);
  const normalized =
    maxSmoothed > 0
      ? smoothed.map((v) => (v / maxSmoothed) * 100)
      : smoothed.map(() => 0);

  // Tier 1: full state monthly data available
  if (stateMonthly && stateMonthly.length === MONTHS) {
    return normalized.map((beachPeak, i) =>
      computeCompositeScore(beachPeak, {
        stateOverallScore: stateMonthly[i].overallScore,
        waterTempComfort: waterTempComfortScore(stateMonthly[i].waterTemp),
        crowdBonus: crowdScore(stateMonthly[i].crowdLevel),
        tier: 1,
      })
    );
  }

  // Tier 2: regional temperature data available
  const temps = estimatedTemps ?? estimateMonthlyTemps(waterTempRange ?? null);
  if (temps && temps.length === MONTHS) {
    return normalized.map((beachPeak, i) =>
      computeCompositeScore(beachPeak, {
        waterTempComfort: waterTempComfortScore(temps[i]),
        tier: 2,
      })
    );
  }

  // Tier 3: beach peak scores only
  return normalized.map((beachPeak) =>
    computeCompositeScore(beachPeak, { tier: 3 })
  );
}

// --- Internal helpers ---

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}
