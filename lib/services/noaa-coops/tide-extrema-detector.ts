/**
 * Tide Extrema Detector
 *
 * Extracts local maxima (high tides) and minima (low tides) from
 * hourly tide height samples. Handles both interior extrema and
 * boundary cases at the start/end of the data window.
 */

import { METERS_TO_FEET } from "@/lib/utils/unit-conversions";

function toUnixSeconds(ts: string): number {
  return Math.floor(new Date(ts).getTime() / 1000);
}

/**
 * A single tide height sample from the tide_forecasts table
 */
export interface TideSample {
  /** ISO timestamp */
  ts: string;
  /** Tide height in meters */
  tide_height_m: number;
}

/**
 * A detected tide extreme (high or low tide)
 */
export interface TideExtreme {
  /** Unix timestamp in seconds */
  time: number;
  /** Height in feet */
  height: number;
  /** Type: 'high' or 'low' */
  type: "high" | "low";
  /** Display name */
  name: "High" | "Low";
}

/**
 * Configuration for the detector
 */
interface TideExtremaDetectorConfig {
  /** Decimal precision for height rounding (default: 1) */
  precision?: number;
}

/**
 * Detects tide extrema (high and low tides) from hourly tide samples.
 *
 * Algorithm:
 * 1. Interior extrema: For each point i (1 to n-2), check if it's a local
 *    maximum (higher than both neighbors) or minimum (lower than both).
 * 2. Boundary extrema: First point is an extreme if different from second;
 *    last point is an extreme if different from second-to-last.
 * 3. Plateau handling: a run of equal heights at a turn is one extreme at
 *    the run's middle; a flat step inside a rise or fall is none.
 */
export class TideExtremaDetector {
  private readonly precision: number;

  constructor(config: TideExtremaDetectorConfig = {}) {
    this.precision = config.precision ?? 1;
  }

  /**
   * Convert meters to feet and round to configured precision
   */
  private toFeetRounded(meters: number): number {
    const multiplier = Math.pow(10, this.precision);
    return Math.round(meters * METERS_TO_FEET * multiplier) / multiplier;
  }

  /**
   * Create a TideExtreme from a sample
   */
  private createExtreme(
    sample: TideSample,
    type: "high" | "low",
    time: number = toUnixSeconds(sample.ts),
  ): TideExtreme {
    return {
      time,
      height: this.toFeetRounded(sample.tide_height_m),
      type,
      name: type === "high" ? "High" : "Low",
    };
  }

  /**
   * Detect interior extrema (points 1 to n-2)
   *
   * A run of equal heights (one sample or more) is an extreme when both
   * neighbours are lower (high) or both are higher (low). A tie at the turn
   * is slack water: NOAA's hourly predictions put 1.851 m at both 18Z and
   * 19Z for 9410196 on 2026-09-30, and requiring a strictly higher single
   * sample dropped that high. The extreme is timed at the run's middle.
   * A flat step inside a rise or fall has neighbours on both sides of it
   * and is not an extreme.
   */
  private detectInteriorExtrema(samples: TideSample[]): TideExtreme[] {
    const extrema: TideExtreme[] = [];

    let runStart = 1;
    while (runStart < samples.length - 1) {
      const curr = samples[runStart].tide_height_m;
      let runEnd = runStart;
      while (runEnd + 1 < samples.length && samples[runEnd + 1].tide_height_m === curr) {
        runEnd++;
      }
      if (runEnd === samples.length - 1) break; // flat to the end: no turn inside the window

      const prev = samples[runStart - 1].tide_height_m;
      const next = samples[runEnd + 1].tide_height_m;
      const time = Math.floor(
        (toUnixSeconds(samples[runStart].ts) + toUnixSeconds(samples[runEnd].ts)) / 2
      );

      if (curr > prev && curr > next) {
        extrema.push(this.createExtreme(samples[runStart], "high", time));
      } else if (curr < prev && curr < next) {
        extrema.push(this.createExtreme(samples[runStart], "low", time));
      }

      runStart = runEnd + 1;
    }

    return extrema;
  }

  /**
   * Detect boundary extrema (first and last points)
   * These handle windows that start/end mid-tide cycle
   */
  private detectBoundaryExtrema(samples: TideSample[]): TideExtreme[] {
    if (samples.length < 2) return [];

    const extrema: TideExtreme[] = [];
    const first = samples[0];
    const second = samples[1];
    const last = samples[samples.length - 1];
    const secondToLast = samples[samples.length - 2];

    // First point boundary check
    if (first.tide_height_m > second.tide_height_m) {
      extrema.push(this.createExtreme(first, "high"));
    } else if (first.tide_height_m < second.tide_height_m) {
      extrema.push(this.createExtreme(first, "low"));
    }
    // Equal heights: no boundary extreme (prevents false positives)

    // Last point boundary check
    if (last.tide_height_m > secondToLast.tide_height_m) {
      extrema.push(this.createExtreme(last, "high"));
    } else if (last.tide_height_m < secondToLast.tide_height_m) {
      extrema.push(this.createExtreme(last, "low"));
    }
    // Equal heights: no boundary extreme (prevents false positives)

    return extrema;
  }

  /**
   * Detect all tide extrema from a set of samples
   *
   * @param samples - Array of tide samples, assumed to be sorted by timestamp
   * @returns Array of tide extrema, sorted by time
   */
  detectExtrema(samples: TideSample[]): TideExtreme[] {
    if (samples.length < 2) {
      return [];
    }

    // Detect both interior and boundary extrema
    const interior = this.detectInteriorExtrema(samples);
    const boundary = this.detectBoundaryExtrema(samples);

    // Combine and sort by time
    const allExtrema = [...interior, ...boundary];
    allExtrema.sort((a, b) => a.time - b.time);

    return allExtrema;
  }
}
