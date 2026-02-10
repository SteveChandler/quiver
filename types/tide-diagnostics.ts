/**
 * Tide Diagnostics Types
 *
 * Types for tide data validation, diagnostics display, and quality indicators.
 * Used by the enhanced tide chart components for transparency and debugging.
 */

/**
 * Tide data verification status
 */
export type TideVerificationStatus = "verified" | "partial" | "unverified";

/**
 * Supported NOAA datum types
 */
export type TideDatum = "MLLW" | "MSL" | "NAVD88" | "MTL" | "MHW" | "MHHW";

/**
 * Units for tide height
 */
export type TideUnits = "feet" | "meters";

/**
 * Data freshness indicator
 */
export type TideDataFreshness = "fresh" | "stale" | "cached";

/**
 * Raw tide sample point for diagnostics display
 */
export interface TideRawSample {
  /** Original timestamp from NOAA: "YYYY-MM-DD HH:mm" */
  t: string;
  /** Height value as string from NOAA */
  v: string;
  /** High or Low tide type */
  type: "H" | "L";
}

/**
 * Tide extreme (high/low) with time and height
 */
export interface TideExtreme {
  /** Time of the extreme tide */
  time: Date;
  /** Height in the configured units */
  height: number;
}

/**
 * Comprehensive tide diagnostics for debugging and transparency
 */
export interface TideDiagnostics {
  // ---- Station Metadata ----
  /** NOAA CO-OPS station ID (e.g., "9410170") */
  stationId: string;
  /** Human-readable station name (e.g., "San Diego") */
  stationName: string;
  /** Whether this is the primary station or a fallback */
  isPrimaryStation: boolean;
  /** Beach name if available */
  beachName?: string;

  // ---- Configuration ----
  /** Tidal datum reference (e.g., MLLW) */
  datum: TideDatum;
  /** Units for height display */
  units: TideUnits;
  /** Timezone info string (e.g., "GMT→PST/UTC-8") */
  timezone: string;

  // ---- Current State ----
  /** Height at current time from source data (not interpolated) */
  nowHeightFromSource: number | null;
  /** Interpolated height at current time */
  nowHeightInterpolated: number | null;
  /** Method used for interpolation */
  interpolationMethod: "linear" | "cosine";

  // ---- Next Extremes ----
  /** Next high tide after current time */
  nextHigh: TideExtreme | null;
  /** Next low tide after current time */
  nextLow: TideExtreme | null;
  /** Time until next high tide in minutes */
  minutesToNextHigh: number | null;
  /** Time until next low tide in minutes */
  minutesToNextLow: number | null;

  // ---- Raw Data Sample ----
  /** Sample of raw data points for verification (last 3-5 points) */
  rawSample: TideRawSample[];
  /** Total number of predictions in the dataset */
  totalPredictions: number;

  // ---- Source URL ----
  /** Full NOAA API URL for manual verification */
  sourceUrl: string;
  /** NOAA station page URL */
  stationPageUrl: string;

  // ---- Data Quality ----
  /** How fresh the data is */
  dataFreshness: TideDataFreshness;
  /** When the data was last fetched */
  lastFetchTime: Date;
  /** Whether the result came from cache */
  cacheHit: boolean;
  /** Time to live remaining in cache (seconds) */
  cacheTtlRemaining: number | null;

  // ---- Validation ----
  /** Whether the data passed validation checks */
  isValidated: boolean;
  /** List of validation errors if any */
  validationErrors: string[];
  /** Overall verification status */
  verificationStatus: TideVerificationStatus;
  /** Confidence score (0-100) */
  confidenceScore: number;
}

/**
 * Warning types for tide data quality issues
 */
export type TideWarningType =
  | "stale_data"
  | "fallback_station"
  | "interpolation_gap"
  | "missing_data"
  | "api_error"
  | "cache_miss"
  | "partial_data";

/**
 * Warning severity levels
 */
export type TideWarningSeverity = "info" | "warning" | "error";

/**
 * A single warning about tide data quality
 */
export interface TideWarning {
  /** Type of warning */
  type: TideWarningType;
  /** Human-readable message */
  message: string;
  /** Severity level */
  severity: TideWarningSeverity;
  /** Additional details (optional) */
  details?: string;
  /** Whether this warning can be dismissed */
  dismissible?: boolean;
}

/**
 * Props for tide warning banner component
 */
export interface TideWarningBannerProps {
  /** List of warnings to display */
  warnings: TideWarning[];
  /** Callback when warning is dismissed */
  onDismiss?: (warningType: TideWarningType) => void;
  /** Optional className */
  className?: string;
}

/**
 * Props for tide verified badge component
 */
export interface TideVerifiedBadgeProps {
  /** Verification status */
  status: TideVerificationStatus;
  /** Tooltip text explaining the status */
  tooltip: string;
  /** Confidence score (0-100) */
  confidenceScore?: number;
  /** Optional className */
  className?: string;
  /** Whether to show confidence percentage */
  showConfidence?: boolean;
}

/**
 * Props for tide diagnostics panel component
 */
export interface TideDiagnosticsPanelProps {
  /** Full diagnostics data */
  diagnostics: TideDiagnostics;
  /** Whether the panel is expanded */
  isOpen: boolean;
  /** Callback when toggle is clicked */
  onToggle: () => void;
  /** Optional className */
  className?: string;
}

/**
 * Hourly tide data point for table display
 */
export interface TideHourlyPoint {
  /** Time of this point */
  time: Date;
  /** Height in display units (feet) */
  height: number;
  /** Trend compared to previous hour */
  trend: "rising" | "falling" | "peak" | "trough" | "stable";
  /** Whether this is a high tide point */
  isHigh?: boolean;
  /** Whether this is a low tide point */
  isLow?: boolean;
  /** Whether this is the current hour */
  isCurrent?: boolean;
}

/**
 * Props for tide hourly table component
 */
export interface TideHourlyTableProps {
  /** Hourly data points */
  data: TideHourlyPoint[];
  /** Current time for highlighting */
  now: Date;
  /** Unit label (default: "ft") */
  unit?: string;
  /** Optional className */
  className?: string;
  /** Maximum rows to display */
  maxRows?: number;
}

/**
 * Props for tide next extreme component
 */
export interface TideNextExtremeProps {
  /** Next high tide info */
  nextHigh: TideExtreme | null;
  /** Next low tide info */
  nextLow: TideExtreme | null;
  /** Minutes until next high */
  minutesToHigh: number | null;
  /** Minutes until next low */
  minutesToLow: number | null;
  /** Current time */
  now: Date;
  /** Unit label */
  unit?: string;
  /** Optional className */
  className?: string;
}

/**
 * Helper to determine verification status from diagnostics
 */
export function getVerificationStatus(
  diagnostics: Partial<TideDiagnostics>
): TideVerificationStatus {
  const { isPrimaryStation, dataFreshness, validationErrors = [], totalPredictions = 0 } = diagnostics;

  // Unverified if any critical issues
  if (validationErrors.length > 0) return "unverified";
  if (totalPredictions === 0) return "unverified";

  // Partial if non-critical issues
  if (!isPrimaryStation) return "partial";

  // Verified if all checks pass
  return "verified";
}

/**
 * Helper to calculate confidence score
 */
export function calculateConfidenceScore(
  diagnostics: Partial<TideDiagnostics>
): number {
  let score = 100;

  const { isPrimaryStation, dataFreshness, validationErrors = [], totalPredictions = 0 } = diagnostics;

  // Deduct for fallback station
  if (!isPrimaryStation) score -= 15;

  // Deduct for cached data
  if (dataFreshness === "cached") score -= 5;

  // Deduct for validation errors
  score -= validationErrors.length * 25;

  // Deduct if few predictions
  if (totalPredictions < 10) score -= 10;
  if (totalPredictions === 0) score -= 50;

  return Math.max(0, Math.min(100, score));
}

/**
 * Helper to generate warnings from diagnostics
 */
export function generateWarnings(diagnostics: TideDiagnostics): TideWarning[] {
  const warnings: TideWarning[] = [];

  if (!diagnostics.isPrimaryStation) {
    warnings.push({
      type: "fallback_station",
      message: `Using fallback station: ${diagnostics.stationName}`,
      severity: "info",
      details: "Primary station data was not available",
      dismissible: true,
    });
  }

  if (diagnostics.totalPredictions < 10) {
    warnings.push({
      type: "partial_data",
      message: "Limited tide predictions available",
      severity: "warning",
      details: `Only ${diagnostics.totalPredictions} data points`,
      dismissible: false,
    });
  }

  for (const error of diagnostics.validationErrors) {
    warnings.push({
      type: "api_error",
      message: error,
      severity: "error",
      dismissible: false,
    });
  }

  return warnings;
}
