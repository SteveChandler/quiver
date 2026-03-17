/**
 * Wave Frequency Domain Types
 *
 * Input and output types for the rideable waves per hour calculator.
 * Pure data structures with no external dependencies.
 */

/**
 * Input data required to estimate rideable wave frequency at a spot.
 */
export interface WaveFrequencyInput {
  /** Dominant wave period in seconds (overall forecast period) */
  readonly dominantPeriodS: number | null;
  /** Primary swell period in seconds */
  readonly swell1PeriodS: number | null;
  /** Secondary swell period in seconds */
  readonly swell2PeriodS: number | null;
  /** Primary swell direction in degrees (0-360, direction waves come FROM) */
  readonly swell1DirectionDeg: number | null;
  /** Combined wave height in feet */
  readonly waveHeightFt: number | null;
  /** Wind speed in knots */
  readonly windSpeedKts: number;
  /** Wind direction in degrees (0-360, direction wind comes FROM) */
  readonly windDirectionDeg: number | null;
  /** Break type of the spot (beach, point, reef, river) */
  readonly breakType: string | null;
  /** Shore-facing aspect of the break in degrees (perpendicular to shore) */
  readonly aspectDeg: number | null;
  /** 72-bin swell access factors (one per 5-degree bin, 0-360), or null if unavailable */
  readonly swellAccessFactors: number[] | null;
}

/**
 * Result of the rideable wave frequency calculation.
 */
export interface WaveFrequencyResult {
  /** Estimated number of rideable waves per hour (0-60) */
  readonly rideableWavesPerHour: number;
  /** Confidence level based on input data completeness */
  readonly confidence: 'high' | 'medium' | 'low';
  /** Intermediate factors used in the calculation (useful for debugging / UI) */
  readonly factors: {
    /** Raw waves per hour before filtering (from period or beat frequency) */
    readonly baseFrequency: number;
    /** Fraction of total waves that are rideable for this break type (0-1) */
    readonly breakTypeFactor: number;
    /** Penalty for short-period wind swell (0-1, 1 = no penalty) */
    readonly shortPeriodPenalty: number;
    /** Swell direction access for this break (0-1) */
    readonly swellAccessFactor: number;
    /** Wind quality penalty (0-1, 1 = no penalty) */
    readonly windPenalty: number;
  };
}
