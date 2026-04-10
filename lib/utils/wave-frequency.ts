/**
 * Estimate set wave frequency from dominant swell period.
 *
 * Wave groups (sets) arrive at intervals determined by the interference
 * pattern of the swell field. Longer periods = more organized energy =
 * longer waits between sets, but bigger/cleaner waves per set.
 */

export interface SetFrequencyEstimate {
  /** Set interval range in minutes, e.g. [12, 15] */
  setIntervalMin: [number, number];
  /** Estimated rideable waves per hour, e.g. [15, 20] */
  wavesPerHour: [number, number];
  /** Whether sets are well-defined (false for wind chop <8s) */
  hasSets: boolean;
}

export function estimateSetFrequency(periodS: number | null): SetFrequencyEstimate | null {
  if (periodS == null || !Number.isFinite(periodS) || periodS <= 0) {
    return null;
  }

  // Wind chop — no organized sets
  if (periodS < 8) {
    return {
      setIntervalMin: [0, 0],
      wavesPerHour: [0, 0],
      hasSets: false,
    };
  }

  // Group factor: how many wave periods between set arrivals.
  // Empirical values from surf science — longer period swells travel
  // in tighter groups with more spacing between groups.
  let groupFactorLow: number;
  let groupFactorHigh: number;
  let wavesPerSetLow: number;
  let wavesPerSetHigh: number;

  if (periodS >= 16) {
    // Long-period groundswell: very organized, long waits
    groupFactorLow = 9;
    groupFactorHigh = 12;
    wavesPerSetLow = 3;
    wavesPerSetHigh = 4;
  } else if (periodS >= 12) {
    // Standard groundswell
    groupFactorLow = 7;
    groupFactorHigh = 10;
    wavesPerSetLow = 4;
    wavesPerSetHigh = 5;
  } else {
    // 8-12s: medium period, less organized
    groupFactorLow = 5;
    groupFactorHigh = 8;
    wavesPerSetLow = 5;
    wavesPerSetHigh = 7;
  }

  const intervalLow = Math.round((periodS * groupFactorLow) / 60);
  const intervalHigh = Math.round((periodS * groupFactorHigh) / 60);

  // Clamp interval to at least 1 minute
  const clampedLow = Math.max(1, intervalLow);
  const clampedHigh = Math.max(clampedLow, intervalHigh);

  const setsPerHourHigh = 60 / clampedLow;
  const setsPerHourLow = 60 / clampedHigh;

  const wavesHourLow = Math.round(setsPerHourLow * wavesPerSetLow);
  const wavesHourHigh = Math.round(setsPerHourHigh * wavesPerSetHigh);

  return {
    setIntervalMin: [clampedLow, clampedHigh],
    wavesPerHour: [wavesHourLow, wavesHourHigh],
    hasSets: true,
  };
}

/**
 * Format set frequency for display.
 * Returns null if no organized sets.
 *
 * @example
 * formatSetFrequency(estimate) // "Sets every 12-15 min (15-20/hr)"
 * formatSetFrequencyShort(estimate) // "Sets ~12 min"
 */
export function formatSetFrequency(estimate: SetFrequencyEstimate | null): string | null {
  if (!estimate || !estimate.hasSets) return null;

  const [iLow, iHigh] = estimate.setIntervalMin;
  const [wLow, wHigh] = estimate.wavesPerHour;

  const interval = iLow === iHigh ? `${iLow}` : `${iLow}-${iHigh}`;
  const waves = wLow === wHigh ? `${wLow}` : `${wLow}-${wHigh}`;

  return `Sets every ${interval} min (${waves}/hr)`;
}

export function formatSetFrequencyShort(estimate: SetFrequencyEstimate | null): string | null {
  if (!estimate || !estimate.hasSets) return null;
  const [iLow] = estimate.setIntervalMin;
  return `Sets ~${iLow} min`;
}
