/**
 * Tide Extrema Detector
 *
 * Extracts local maxima (high tides) and minima (low tides) from
 * hourly tide height samples. Handles both interior extrema and
 * boundary cases at the start/end of the data window.
 */

import { METERS_TO_FEET } from "@/lib/utils/unit-conversions";

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
export interface TideExtremaDetectorConfig {
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
 * 3. Plateau handling: Equal heights are NOT detected as extrema, preventing
 *    false positives during slack tide periods.
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
  private createExtreme(sample: TideSample, type: "high" | "low"): TideExtreme {
    return {
      time: Math.floor(new Date(sample.ts).getTime() / 1000),
      height: this.toFeetRounded(sample.tide_height_m),
      type,
      name: type === "high" ? "High" : "Low",
    };
  }

  /**
   * Detect interior extrema (points 1 to n-2)
   * A point is an extreme if it's strictly greater/less than both neighbors
   */
  private detectInteriorExtrema(samples: TideSample[]): TideExtreme[] {
    const extrema: TideExtreme[] = [];

    for (let i = 1; i < samples.length - 1; i++) {
      const prev = samples[i - 1].tide_height_m;
      const curr = samples[i].tide_height_m;
      const next = samples[i + 1].tide_height_m;

      // Local maximum (high tide)
      if (curr > prev && curr > next) {
        extrema.push(this.createExtreme(samples[i], "high"));
      }
      // Local minimum (low tide)
      else if (curr < prev && curr < next) {
        extrema.push(this.createExtreme(samples[i], "low"));
      }
      // Equal heights are NOT extrema (plateau handling)
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
