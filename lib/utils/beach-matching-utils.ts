/**
 * Beach Matching Utilities
 *
 * Functions for matching and selecting beaches from multiple candidates.
 * @module lib/utils/beach-matching-utils
 */

import type { Beach } from '@/types/database';
import { stateToSlug, cityToSlug } from './beach-url-utils';

export interface BeachMatchParams {
  stateParam: string;
  cityParam: string;
  beaches: Beach[];
}

/**
 * Pick the best matching beach from candidates based on state, city, and quality signals.
 *
 * Strategy:
 * 1. Filter by state match (if any matches exist)
 * 2. Further filter by city match (if any matches exist)
 * 3. Sort by quality signals: coordinates > reviews > recency > ID
 * 4. Return the best match or null
 *
 * @param params - State, city, and candidate beaches
 * @returns Best matching beach or null
 */
export function pickBestUsaBeachMatch(params: BeachMatchParams): Beach | null {
  const { stateParam, cityParam, beaches } = params;

  if (!Array.isArray(beaches) || beaches.length === 0) {
    return null;
  }

  const stateLower = stateParam.toLowerCase();
  const cityLower = cityParam.toLowerCase();

  // Filter by state match
  const withStateMatch = beaches.filter(
    (b) => stateToSlug(b.state)?.toLowerCase() === stateLower
  );

  const statePool = withStateMatch.length > 0 ? withStateMatch : beaches;

  // Further filter by city match
  const withCityMatch = statePool.filter(
    (b) => cityToSlug(b.city)?.toLowerCase() === cityLower
  );

  const pool = withCityMatch.length > 0 ? withCityMatch : statePool;

  // Sort by quality signals
  const sorted = [...pool].sort((a, b) => {
    // Prefer beaches with coordinates
    const aHasCoords = Number(Boolean(a.lat && a.lon));
    const bHasCoords = Number(Boolean(b.lat && b.lon));
    if (aHasCoords !== bHasCoords) {
      return bHasCoords - aHasCoords;
    }

    // Prefer beaches with more reviews (null sorts last)
    const aReviews = a.review_count ?? -1;
    const bReviews = b.review_count ?? -1;
    if (aReviews !== bReviews) {
      return bReviews - aReviews;
    }

    // Prefer more recently created beaches
    const aCreated = a.created_at ? Date.parse(a.created_at) : 0;
    const bCreated = b.created_at ? Date.parse(b.created_at) : 0;
    if (aCreated !== bCreated) {
      return bCreated - aCreated;
    }

    // Fallback to ID for stable ordering
    return String(a.id).localeCompare(String(b.id));
  });

  return sorted[0] ?? null;
}
