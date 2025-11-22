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
  /** Confidence score for this window (0-100) */
  confidence: number;
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
    /** Distance penalty for far beaches (0 to -20 points) */
    distancePenalty: number;
  };
  /** Overall match quality category */
  matchQuality: 'perfect' | 'excellent' | 'good' | 'fair';
  /** Human-readable reasons (3-5 specific factors) */
  reasons: string[];
  /** Warnings about conditions, skill level, or crowding */
  warnings: string[];
}

/**
 * Single surf discovery recommendation
 *
 * Extends personalized forecast with detailed scoring breakdown,
 * match quality indicators, and distance information for GPS phase.
 */
export interface SurfDiscoveryRecommendation {
  /** Beach with location coordinates */
  beach: Beach;
  /** Optimal time window for surfing */
  window: PersonalizedForecastWindow;
  /** Full forecast data for the window */
  forecast: EnhancedForecastEntity;
  /** Final match score (0-100) */
  score: number;
  /** Match quality category */
  matchQuality: 'perfect' | 'excellent' | 'good' | 'fair';
  /** Detailed scoring breakdown */
  subscores: DetailedScore['subscores'];
  /** Human-readable summary of conditions */
  summary: string;
  /** Specific reasons for this ranking (3-5 factors) */
  reasons: string[];
  /** Warnings or cautions about the spot */
  warnings: string[];
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
    /** ISO timestamp when generated */
    generated_at: string;
  };
}

/**
 * Options for surf discovery queries
 */
export interface SurfDiscoveryOptions {
  /** User's GPS location (optional, Phase 2) */
  userLocation?: { lat: number; lon: number };
  /** Search radius in miles (default: 25, Phase 2) */
  radiusMiles?: number;
  /** Maximum recommendations to return (default: 5, max: 10) */
  maxResults?: number;
  /** Include home beach in results (default: true) */
  includeHome?: boolean;
  /** Maximum concurrent forecast fetches (default: 5) */
  maxConcurrent?: number;
  /** Timeout per beach forecast in ms (default: 5000) */
  timeout?: number;
  /** Overall batch timeout in ms (default: 12000) */
  overallTimeout?: number;
}

