/**
 * Personalization Types
 * 
 * Type definitions for personalized forecast recommendations.
 * These types wrap forecast data with user-specific scoring, summaries, and reasoning.
 * 
 * @module types/personalization
 */

import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { PersonalizedScore } from "@/lib/services/personalized-scoring-service";

// ============================================================================
// Time Slot Filter Types
// ============================================================================

/**
 * Time slot filter for constraining discovery recommendations
 *
 * Users can filter surf windows to specific times of day:
 * - 'any': Full daylight hours (6am-9pm)
 * - 'dawn-patrol': Early morning (6am-11am)
 * - 'lunch-session': Lunch session (11am-2pm)
 * - 'afternoon': Afternoon session (2pm-6pm)
 */
export type TimeSlot = 'any' | 'lunch-session' | 'afternoon' | 'dawn-patrol';

/**
 * Hour ranges for each time slot
 *
 * startHour and endHour are in 24-hour format (0-23).
 * Used to filter forecast windows to the specified time range.
 */
export const TIME_SLOT_RANGES: Record<TimeSlot, { startHour: number; endHour: number }> = {
  'any': { startHour: 6, endHour: 21 },
  'dawn-patrol': { startHour: 6, endHour: 11 },
  'lunch-session': { startHour: 11, endHour: 14 },
  'afternoon': { startHour: 14, endHour: 18 },
};

/**
 * Optimal surf window within a forecast period
 * 
 * Represents a specific time window with the best conditions
 * for surfing based on wave, wind, and tide forecasts.
 */
export interface PersonalizedForecastWindow {
  /** Window start time */
  start: Date;
  /** Window end time (typically 3 hours after start) */
  end: Date;
  /** Tide status during window (e.g., "Rising", "High Slack") */
  tide: string;
  /** Wind conditions (e.g., "10 mph SW") */
  wind: string;
  /** Wave height (e.g., "3-4 ft") */
  waveHeight: string;
  /** Wave period (e.g., "12s") */
  wavePeriod: string;
  /** Source used for the underlying forecast row (e.g., "CDIP", "NOAA_NWS", "NOAA_BUOY", "FALLBACK") */
  dataSource: string;
  /** Confidence score for this window (0-100) */
  confidence: number;
  /** Beach's IANA timezone for consistent time display (e.g., "America/Los_Angeles") */
  timezone: string;
  /** Whether tide-driven boundaries were used for this window (vs hourly fallback) */
  usedTideBoundaries?: boolean;
  /** Composite quality score for this window (0-100) */
  score?: number;
  /** Peak time within the window (highest score moment) */
  peakTime?: Date;
  /** Original forecast entity this window was derived from (used for scoring, not serialized) */
  sourceForecast?: EnhancedForecastEntity;
}

/** Condition badge shown on recommendations */
export interface ConditionBadge {
  /** Badge label (e.g., "Glass", "Clean Swell") */
  label: string;
  /** Score contribution (for ranking top badges) */
  contribution: number;
}

/**
 * Complete personalized forecast recommendation
 *
 * Combines beach details, forecast data, personalized scoring,
 * and human-readable explanations for the recommendation.
 *
 * Used by home screen to show users their best surf opportunity.
 */
export interface PersonalizedForecastRecommendation {
  /** Beach with location coordinates (lat/lon from database) */
  beach: Beach;
  /** Optimal time window for surfing */
  window: PersonalizedForecastWindow;
  /** Full forecast data for the window */
  forecast: EnhancedForecastEntity;
  /** Final personalized score (0-100) */
  score: number;
  /** Whether personalization was applied */
  personalized: boolean;
  /** Score breakdown by component */
  breakdown: PersonalizedScore['breakdown'];
  /** Human-readable summary (e.g., "Best conditions at Ocean Beach tomorrow morning") */
  summary: string;
  /** Reasons for recommendation (2-4 personalization factors) */
  reasons: string[];
  /** ISO timestamp when recommendation was generated */
  generated_at: string;
  /** Total number of candidate beaches considered */
  total_beaches_count: number;
  /** Number of beaches with successful forecast retrieval */
  available_beaches_count: number;
  /** Whether some beaches failed to fetch (partial success) */
  partial_success: boolean;
  /** Whether recommendation used stale forecast data (NEW) */
  stale_data_used?: boolean;
  /** Optional warning about data staleness (NEW) */
  data_freshness_warning?: string;
}

/**
 * Options for personalized forecast generation
 */
export interface PersonalizedForecastOptions {
  /** Override home beach ID (optional) */
  homeBeachId?: string;
  /** Maximum beaches to fetch in parallel (default: 3) */
  maxConcurrent?: number;
  /** Timeout per beach forecast fetch in ms (default: 5000) */
  timeout?: number;
  /** Overall batch timeout in ms (default: 8000) */
  overallTimeout?: number;
}

/**
 * Internal type for beach with forecast data
 * Used during scoring phase
 */
export interface BeachForecastCandidate {
  beach: Beach;
  forecasts: EnhancedForecastEntity[];
  bestWindow: PersonalizedForecastWindow | null;
  baseScore: number;
}

/**
 * Detailed scoring breakdown for discovery recommendations
 *
 * Provides granular sub-scores for each condition factor,
 * allowing users to understand exactly why a beach was recommended.
 */
export interface DetailedScore {
  /** Total score (0-100) */
  total: number;
  /** Individual sub-score components */
  subscores: {
    /** Wave height fit to user's comfort range (0-25 points) */
    waveHeightFit: number;
    /** Swell period/energy score vs user skill (0-20 points) */
    periodEnergyScore: number;
    /** Wind alignment with beach's optimal direction (0-20 points) */
    windAlignment: number;
    /** Tide fit to beach's preferred range (0-15 points) */
    tideFit: number;
    /** Bonus for familiar beaches (0-15 points) */
    affinityBonus: number;
    /** Bonus from personalization engine (break type, learned/implicit prefs) */
    personalizationBonus: number;
    /** Distance penalty for far beaches (0 to -20 points) */
    distancePenalty: number;
  };
  /** Overall match quality category */
  matchQuality: 'perfect' | 'excellent' | 'good' | 'fair';
  /** Human-readable reasons (3-5 specific factors) */
  reasons: string[];
  /** Warnings about conditions, skill level, or crowding */
  warnings: string[];
  /** Top condition badges explaining why conditions are good */
  conditionBadges?: ConditionBadge[];
  /** Wave height display badge (e.g., "2-3ft") */
  waveHeightBadge?: string;
}

/**
 * Single surf discovery recommendation
 *
 * Extends personalized forecast with detailed scoring breakdown,
 * match quality indicators, and distance information for GPS phase.
 */
export interface SurfDiscoveryRecommendation {
  /** Beach with location coordinates and optional photo */
  beach: Beach & { photo_url?: string | null };
  /** True if this beach is in user's favorites */
  isFavorite?: boolean;
  /** Optimal time window for surfing */
  window: PersonalizedForecastWindow;
  /** Full forecast data for the window */
  forecast: EnhancedForecastEntity;
  /** Final match score (0-100) */
  score: number;
  /** Match quality category */
  matchQuality: 'perfect' | 'excellent' | 'good' | 'fair';
  /** Morning Intel style recommendation label */
  recommendationLabel?: 'Worth it' | 'Maybe' | 'Skip';
  /** Detailed scoring breakdown */
  subscores: DetailedScore['subscores'];
  /** Human-readable summary of conditions */
  summary: string;
  /** Natural language message (e.g., "Worth it — Good wave size, Offshore wind") */
  message?: string;
  /** Specific reasons for this ranking (3-5 factors) */
  reasons: string[];
  /** Warnings or cautions about the spot */
  warnings: string[];
  /** Top condition badges explaining why conditions are good */
  conditionBadges?: ConditionBadge[];
  /** Wave height display badge (e.g., "2-3ft") */
  waveHeightBadge?: string;
  /** Distance in miles (GPS phase) */
  distanceMiles?: number;
  /** Estimated driving time in minutes (GPS phase) */
  drivingTimeMinutes?: number;
  /** ISO timestamp when generated */
  generated_at: string;
}

/**
 * Surf discovery response with multiple ranked recommendations
 */
export interface SurfDiscoveryResponse {
  /** Ranked list of surf spot recommendations (best first) */
  recommendations: SurfDiscoveryRecommendation[];
  /** Search criteria used to generate recommendations */
  searchCriteria: {
    /** User's GPS location (GPS phase) */
    userLocation?: { lat: number; lon: number };
    /** Search radius in miles (GPS phase) */
    radiusMiles?: number;
    /** Maximum number of results requested */
    maxResults: number;
  };
  /** Generation metadata */
  metadata: {
    /** Total beaches considered for ranking */
    totalBeachesConsidered: number;
    /** Beaches with successful forecast fetches */
    successfulForecasts: number;
    /** Whether some forecasts failed (partial success) */
    partialSuccess: boolean;
    /** Number of beaches with failed forecast fetches (NEW) */
    failedBeaches: number;
    /** Number of beaches with stale forecast data (NEW) */
    staleBeaches: number;
    /** Whether stale forecast data was used as fallback (no fresh data available) */
    usingStaleData?: boolean;
    /** ISO timestamp when generated */
    generated_at: string;
  };
}

/**
 * Options for surf discovery queries
 */
export interface SurfDiscoveryOptions {
  /** User's GPS location (required for GPS-based discovery) */
  userLocation?: { lat: number; lon: number };
  /** Search radius in miles (default: 25) */
  radiusMiles?: number;
  /**
   * Hard cap for how far in the future a "best window" may start (in hours).
   * If provided, discovery will ignore forecast slots beyond this horizon when
   * selecting each beach's best window. Intended for "next 24 hours" UX.
   */
  horizonHours?: number;
  /** Filter windows to specific time of day (default: 'any') */
  timeSlot?: TimeSlot;
  /** Maximum recommendations to return (default: 5, max: 10) */
  maxResults?: number;
  /** Maximum concurrent forecast fetches (default: 5) */
  maxConcurrent?: number;
  /** Timeout per beach forecast in ms (default: 5000) */
  timeout?: number;
  /** Overall batch timeout in ms (default: 12000) */
  overallTimeout?: number;
}

// ============================================================================
// Personalized Insights Types
// ============================================================================

/**
 * Board snapshot captured at session time
 *
 * Preserves board details even if the board is later modified or deleted.
 * Stored in sessions.board_snapshot JSONB column.
 */
export interface BoardSnapshot {
  /** Board name (e.g., "Fish") */
  name: string;
  /** Board type (e.g., "shortboard", "longboard", "fish") */
  board_type: string;
  /** Size category */
  size: string | null;
  /** Board volume in liters */
  volume: number | null;
  /** Board dimensions (e.g., "5'8\" x 19\" x 2.5\"") */
  dimensions: string;
}

/**
 * Similar session from user's history for insights comparison
 *
 * Represents a past session with conditions similar to the current forecast.
 */
export interface SimilarSessionInsight {
  /** Session ID */
  id: string;
  /** Beach name where session occurred */
  beachName: string;
  /** Beach ID for comparison with recommended spot */
  beachId: string;
  /** ISO timestamp of session */
  sessionDate: string;
  /** User's rating (1-5) */
  rating: number;
  /** Wave height in feet during session */
  waveHeight: number | null;
  /** Wave period in seconds during session */
  wavePeriod: number | null;
  /** Wind speed in mph during session */
  windSpeed: number | null;
  /** Board name used (from board_snapshot) */
  boardName: string | null;
  /** Board type used (from board_snapshot) */
  boardType: string | null;
  /** Similarity score to current forecast (0-100) */
  similarityScore: number;
}

/**
 * Personalized insights computed from user's session history
 *
 * Shows how current recommended conditions compare to the user's
 * historically high-rated sessions, including board recommendations.
 */
export interface PersonalizedInsights {
  /** Overall match percentage (0-100) */
  matchPercent: number;
  /** Match quality label */
  label: 'Perfect' | 'Great' | 'Good' | 'Low' | 'Insufficient Data';
  /** Explanation bullets (2-4 reasons) */
  reasonBullets: string[];
  /** Top similar sessions from user's history */
  similarSessions: SimilarSessionInsight[];
  /** Board recommendation based on similar sessions (if clear pattern) */
  boardTip: string | null;
  /** Total number of rated sessions found */
  sessionCount: number;
  /** Current state of insights computation */
  state: 'ready' | 'onboarding' | 'degraded';
}

/**
 * Input parameters for similarity computation
 */
export interface SimilarityInsightsInput {
  /** Beach ID for the recommended spot */
  beachId: string;
  /** Beach name for the recommended spot */
  beachName: string;
  /** Forecast wave height in feet */
  waveHeight: number;
  /** Forecast wave period in seconds */
  wavePeriod: number;
  /** Forecast wind speed in mph */
  windSpeed: number;
  /** Forecast wind direction in degrees (optional) */
  windDirection?: number;
  /** Forecast tide height in feet (optional) */
  tideHeight?: number;
  /** Forecast tide status (optional) */
  tideStatus?: string;
  /** Window start time (optional) */
  windowStart?: string;
}

