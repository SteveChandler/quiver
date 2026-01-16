/**
 * Conditions Domain Types
 *
 * Represents forecast data interpreted for scoring.
 * These are immutable snapshots and windows of surf conditions.
 */

/**
 * Swell component data (primary, secondary, or wind-wave).
 */
export interface SwellComponent {
  /** Wave height in feet */
  readonly heightFt: number;
  /** Wave period in seconds */
  readonly periodS: number;
  /** Swell direction in degrees (0-360, direction waves come FROM) */
  readonly directionDeg: number;
  /** Computed energy: height² × period (higher = more powerful) */
  readonly energy: number;
}

/**
 * Wind state at a point in time.
 */
export interface WindState {
  /** Wind speed in mph */
  readonly speedMph: number;
  /** Wind direction in degrees (0-360, direction wind comes FROM) */
  readonly directionDeg: number | null;
}

/**
 * Tide movement direction.
 */
export type TideDirection = 'rising' | 'falling' | 'slack';

/**
 * Tide status (more specific than direction).
 */
export type TideStatus =
  | 'rising'
  | 'falling'
  | 'slack-high'
  | 'slack-low'
  | 'unknown';

/**
 * Tide state at a point in time.
 */
export interface TideState {
  /** Tide height in feet */
  readonly heightFt: number;
  /** Specific tide status */
  readonly status: TideStatus;
  /** General tide direction */
  readonly direction: TideDirection;
}

/**
 * Immutable snapshot of conditions at a single point in time.
 * Created from EnhancedForecastEntity.
 */
export interface ConditionsSnapshot {
  /** Timestamp of this snapshot */
  readonly timestamp: Date;

  /** Overall wave height (primary metric, feet) */
  readonly waveHeight: number;
  /** Overall wave period (seconds) */
  readonly wavePeriod: number;
  /** Overall wave direction (degrees) */
  readonly waveDirection: number | null;

  /** Primary swell component (dominant swell) */
  readonly primarySwell: SwellComponent | null;
  /** Secondary swell component (if present) */
  readonly secondarySwell: SwellComponent | null;
  /** Wind-generated waves (short period, local) */
  readonly windWave: SwellComponent | null;

  /** Wind conditions */
  readonly wind: WindState;
  /** Tide conditions */
  readonly tide: TideState;

  /** Forecast confidence score (0-100) */
  readonly confidence: number;
  /** Data source identifier */
  readonly dataSource: string;
}

/**
 * Trend direction for a metric over time.
 */
export type TrendDirection = 'improving' | 'stable' | 'degrading';

/**
 * Analyzed conditions over a time window.
 * Contains multiple snapshots with trend analysis.
 */
export interface ConditionsWindow {
  /** Window start time */
  readonly start: Date;
  /** Window end time */
  readonly end: Date;
  /** Duration in hours */
  readonly durationHours: number;

  /** Ordered snapshots within the window */
  readonly snapshots: readonly ConditionsSnapshot[];

  /** Wave height trend over the window */
  readonly waveHeightTrend: TrendDirection;
  /** Wind speed trend (improving = decreasing) */
  readonly windSpeedTrend: TrendDirection;
  /** Tide trend */
  readonly tideTrend: TrendDirection;
  /** Overall conditions trend */
  readonly overallTrend: TrendDirection;

  /** Wave height variance (standard deviation) */
  readonly waveHeightVariance: number;
  /** Wind speed variance */
  readonly windVariance: number;

  /** True if conditions are consistent (low variance) */
  readonly isStable: boolean;

  /** Average wave height across window */
  readonly avgWaveHeight: number;
  /** Average wind speed across window */
  readonly avgWindSpeed: number;
  /** Average confidence across window */
  readonly avgConfidence: number;
}

/**
 * Result of swell interference analysis.
 */
export interface SwellAnalysis {
  /** How well primary swell aligns with beach window (0-100) */
  readonly primaryAlignment: number;
  /** How well secondary swell aligns with beach window (0-100) */
  readonly secondaryAlignment: number;
  /** Penalty when swells are crossing (0-30) */
  readonly interferencePenalty: number;
  /** Combined swell quality score (0-100) */
  readonly combinedScore: number;
  /** Human-readable explanation */
  readonly explanation: string;
}

/**
 * Constants for conditions analysis.
 */
export const CONDITIONS_CONSTANTS = {
  /** Minimum period to be considered significant swell (not wind chop) */
  MIN_SWELL_PERIOD_S: 8,

  /** Energy ratio threshold: secondary swell matters if > 10% of primary */
  SECONDARY_SWELL_THRESHOLD: 0.1,

  /** Angular difference where swell interference starts (degrees) */
  INTERFERENCE_START_DEG: 30,

  /** Angular difference where interference is severe (degrees) */
  INTERFERENCE_SEVERE_DEG: 90,

  /** Maximum interference penalty points */
  MAX_INTERFERENCE_PENALTY: 30,

  /** Wave height variance threshold for "stable" classification */
  STABLE_WAVE_VARIANCE_THRESHOLD: 0.5,

  /** Wind variance threshold for "stable" classification */
  STABLE_WIND_VARIANCE_THRESHOLD: 3,

  /** Trend slope threshold (normalized) for significance */
  TREND_SIGNIFICANCE_THRESHOLD: 0.1,
} as const;
