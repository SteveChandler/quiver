/**
 * Shared Session Intelligence recommendation model.
 *
 * Keep this file framework-free: values are serializable and safe to pass from
 * server helpers to future UI surfaces.
 */

export const SURF_WINDOW_VERDICTS = ["Worth it", "Maybe", "Skip"] as const;
export type SurfWindowVerdict = (typeof SURF_WINDOW_VERDICTS)[number];

export const SURF_WINDOW_WIND_QUALITIES = [
  "offshore",
  "cross-shore",
  "onshore",
  "variable",
  "unknown",
] as const;
export type SurfWindowWindQuality =
  (typeof SURF_WINDOW_WIND_QUALITIES)[number];

export const SURF_WINDOW_TIDE_TRENDS = [
  "rising",
  "falling",
  "high",
  "low",
  "unknown",
] as const;
export type SurfWindowTideTrend = (typeof SURF_WINDOW_TIDE_TRENDS)[number];

export const SURF_WINDOW_BEST_FOR_TAGS = [
  "beginner",
  "intermediate",
  "advanced",
  "longboard",
  "shortboard",
  "fish",
  "mid-length",
  "foamie",
  "dawn-patrol",
  "sunset-session",
] as const;
export type SurfWindowBestForTag =
  (typeof SURF_WINDOW_BEST_FOR_TAGS)[number];

export const SURF_WINDOW_CONFIDENCE_LEVELS = [
  "low",
  "medium",
  "high",
] as const;
export type SurfWindowConfidenceLevel =
  (typeof SURF_WINDOW_CONFIDENCE_LEVELS)[number];

export const SURF_WINDOW_SOURCE_FLAG_KEYS = [
  "forecast-model",
  "tide",
  "buoy",
  "cam",
  "user-report",
  "local-spot-intel",
] as const;
export type SurfWindowSourceFlagKey =
  (typeof SURF_WINDOW_SOURCE_FLAG_KEYS)[number];

function isOneOf<const T extends readonly string[]>(
  values: T,
  value: string
): value is T[number] {
  return values.includes(value as T[number]);
}

export function isSurfWindowVerdict(
  value: string
): value is SurfWindowVerdict {
  return isOneOf(SURF_WINDOW_VERDICTS, value);
}

export function isSurfWindowBestForTag(
  value: string
): value is SurfWindowBestForTag {
  return isOneOf(SURF_WINDOW_BEST_FOR_TAGS, value);
}

export function isSurfWindowConfidenceLevel(
  value: string
): value is SurfWindowConfidenceLevel {
  return isOneOf(SURF_WINDOW_CONFIDENCE_LEVELS, value);
}

export interface SurfWindowBeachIdentity {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  region: string | null;
  lat: number | null;
  lon: number | null;
  photoUrl: string | null;
}

export interface SurfWindowSourceFlags {
  forecastModel: boolean;
  tide: boolean;
  buoy: boolean;
  cam: boolean;
  userReport: boolean;
  localSpotIntel: boolean;
}

export interface SurfWindowConfidence {
  level: SurfWindowConfidenceLevel;
  score: number;
  summary: string;
  reasons: string[];
}

export interface SurfWindowWaveSummary {
  height: string | null;
  period: string | null;
  direction: string | null;
  summary: string;
}

export interface SurfWindowWindSummary {
  speed: string | null;
  direction: string | null;
  quality: SurfWindowWindQuality;
  summary: string;
}

export interface SurfWindowTideSummary {
  status: string | null;
  height: string | null;
  nextTideAt: string | null;
  trend: SurfWindowTideTrend;
  summary: string;
}

export interface SurfWindowConditionSummary {
  wave: SurfWindowWaveSummary;
  wind: SurfWindowWindSummary;
  tide: SurfWindowTideSummary;
}

export interface SurfWindowLinks {
  appDeepLink: string | null;
  universalLink: string | null;
  canonicalWebUrl: string | null;
}

export interface SurfWindowRecommendation extends SurfWindowLinks {
  recommendationId?: string;
  windowId: string;
  rank: number;
  beach: SurfWindowBeachIdentity;
  startIso: string;
  endIso: string;
  peakIso: string;
  timezone: string;
  forecastAt: string;
  localTimeLabel: string;
  score: number;
  verdict: SurfWindowVerdict;
  headline: string;
  wave: SurfWindowWaveSummary;
  wind: SurfWindowWindSummary;
  tide: SurfWindowTideSummary;
  bestFor: SurfWindowBestForTag[];
  positives: string[];
  watchouts: string[];
  dataNotes: string[];
  confidence: SurfWindowConfidence;
  sources: SurfWindowSourceFlags;
}

export interface SurfWindowRecommendationResult {
  generatedAt: string;
  horizonDays: 7 | 14;
  recommendations: SurfWindowRecommendation[];
}
