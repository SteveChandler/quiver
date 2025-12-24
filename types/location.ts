/**
 * Location Type Definitions
 *
 * TypeScript types for the AllTrails-style location browsing feature.
 * These types support hierarchical location navigation and beach ranking.
 */

import type { Beach } from "@/types/database";

/**
 * Location identifier using full names
 */
export interface LocationIdentifier {
  country: string;
  state: string;
  city: string;
}

/**
 * Extended location identifier that can represent a metro area
 */
export interface LocationIdentifierExtended extends LocationIdentifier {
  /** Whether this represents a metro area spanning multiple cities */
  isMetro?: boolean;

  /** If metro, the constituent city names */
  metroCities?: string[];
}

/**
 * Location identifier using URL-friendly slugs
 */
export interface LocationSlug {
  countrySlug: string;
  stateSlug: string;
  citySlug: string;
}

/**
 * Aggregate statistics for a location
 */
export interface LocationStats {
  /** Display name of the city (e.g., "La Jolla") */
  locationName: string;

  /** Display name of the state (e.g., "California") */
  stateName: string;

  /** Display name of the country (e.g., "United States") */
  countryName: string;

  /** Total number of beaches in this location */
  totalBeaches: number;

  /** Average rating across all beaches (0-5 scale) */
  averageRating: number;

  /** Total number of reviews across all beaches */
  totalReviews: number;

  /** Number of "top rated" beaches (composite score >= 0.8) */
  topBeaches: number;
}

/**
 * Beach with computed ranking metrics
 * Extends the base Beach type with additional calculated fields
 *
 * @note Coordinate naming: ranking RPCs may return `latitude/longitude` (v2) while many UI components
 * still consume `lat/lon`. Server actions should normalize/mirror fields to keep component contracts stable.
 */
export interface BeachWithMetrics extends Beach {
  /** Composite score (0-1 scale) combining rating, reviews, and intel */
  compositeScore: number;

  /** Number of recent intel posts (last 7 days) */
  recentIntelCount: number;

  /** Average confirmations on recent intel posts */
  avgConfirmations: number;

  /** Ranking position in the location (1 = best) */
  rank?: number;
}

/**
 * Complete data for a location listing page
 */
export interface LocationPageData {
  /** Location identifiers */
  location: LocationIdentifier;

  /** Aggregate statistics for the location */
  stats: LocationStats;

  /** Ranked list of beaches in this location */
  beaches: BeachWithMetrics[];
}

/**
 * Extended location page data with metro information
 */
export interface LocationPageDataExtended extends LocationPageData {
  /** Metro area configuration if applicable */
  metroConfig?: {
    displayName: string;
    cities: string[];
    description?: string;
  };
}

/**
 * Ranking weights for composite score calculation
 */
export interface RankingWeights {
  /** Weight for beach rating (0-5 stars) */
  rating: number; // Default: 0.4 (40%)

  /** Weight for review volume */
  reviewVolume: number; // Default: 0.3 (30%)

  /** Weight for recent intel activity */
  recentIntel: number; // Default: 0.2 (20%)

  /** Weight for intel quality (confirmations) */
  intelQuality: number; // Default: 0.1 (10%)
}

/**
 * Ranking tier for badge display
 */
export type RankingTier = "top" | "highly-rated" | "popular" | "standard";

/**
 * Breadcrumb segment for hierarchical navigation
 */
export interface BreadcrumbSegment {
  /** Display label for the segment */
  label: string;

  /** URL to navigate to (null if not clickable) */
  url: string | null;

  /** Whether this segment represents the current page */
  isCurrent?: boolean;
}

/**
 * Location params from URL route
 */
export interface LocationPageParams {
  country: string; // URL slug
  state: string; // URL slug
  city: string; // URL slug
}

/**
 * Helper to determine ranking tier from composite score
 */
export function getRankingTier(score: number): RankingTier {
  if (score >= 0.8) return "top";
  if (score >= 0.6) return "highly-rated";
  if (score >= 0.4) return "popular";
  return "standard";
}

/**
 * Helper to get badge label for ranking tier
 */
export function getRankingBadgeLabel(tier: RankingTier): string {
  switch (tier) {
    case "top":
      return "Top Rated";
    case "highly-rated":
      return "Highly Rated";
    case "popular":
      return "Popular";
    default:
      return "";
  }
}

/**
 * Default ranking weights (can be adjusted for experimentation)
 */
export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  rating: 0.4,
  reviewVolume: 0.3,
  recentIntel: 0.2,
  intelQuality: 0.1,
};
