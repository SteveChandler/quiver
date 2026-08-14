"use server";

import { unstable_cache } from "next/cache";
import { withDatabaseOperation } from "@/lib/server-action-utils";
import { createPublicReadClient } from "@/lib/supabase/server";
import { trackFallback } from "@/lib/monitoring/fallback-tracker";
import {
  getBeachesFromDb,
  getBeachByIdFromDb,
  getBeachesBySlugFromDb,
} from "@/lib/services/beach-query-service";
import { rankBeaches } from "@/lib/recommendations/selection";
import type { Beach } from "@/types/database";

// Full beach detail fields for single beach queries
// Includes all fields from beaches table for comprehensive beach view
const BEACH_DETAIL_FIELDS = "*";

/**
 * Escape special characters in LIKE patterns to prevent unintended matches.
 * Escapes % and _ which are wildcards in SQL LIKE patterns.
 *
 * @param pattern - The string to escape for use in a LIKE pattern
 * @returns The escaped pattern safe for use in LIKE queries
 *
 * @example
 * escapeLikePattern('san_diego') // 'san\_diego'
 * escapeLikePattern('test%value') // 'test\%value'
 */
function escapeLikePattern(pattern: string): string {
  return pattern.replace(/[%_]/g, "\\$&");
}

/**
 * Fetch all beaches. Thin wrapper around the service layer.
 */
export async function getBeaches() {
  return getBeachesFromDb();
}

/**
 * Fetch a single beach by ID. Thin wrapper around the service layer.
 */
export async function getBeachById(id: string) {
  return getBeachByIdFromDb(id);
}

/**
 * Fetch 0..N beaches by slug. Thin wrapper around the service layer.
 * Excludes private beaches.
 */
export async function getBeachesBySlug(slug: string) {
  return getBeachesBySlugFromDb(slug);
}

/**
 * Intent to skill_level mapping for database queries.
 */
const INTENT_SKILL_FILTERS: Record<string, string[]> = {
  beginner: ["beginner", "longboard"],
  longboard: ["longboard", "beginner"],
  advanced: ["advanced", "expert"],
};

/**
 * Crowd levels considered "uncrowded" for the least-crowded intent.
 * Beaches without crowd_level data are excluded (no data = no guarantee of low crowds).
 */
const LEAST_CROWDED_LEVELS = ["light", "moderate"];

/**
 * Shared function to build intent-based beach queries.
 * Applies skill-based filters for intents that have them.
 * Crowd-based intents filter to only matching crowd levels.
 *
 * @param baseQuery - Initial query with location filters already applied
 * @param intent - The surf intent
 */
function applyIntentFilters(
  baseQuery: any,
  intent: string
) {
  // Apply intent-specific skill filters
  const skillFilters = INTENT_SKILL_FILTERS[intent];
  if (skillFilters) {
    const skillConditions = skillFilters
      .map((s) => `skill_level.ilike.%${s}%`)
      .join(",");
    return baseQuery.or(skillConditions);
  }

  // Filter least-crowded to only light/moderate beaches (case-insensitive)
  if (intent === "least-crowded") {
    return baseQuery.or(
      LEAST_CROWDED_LEVELS.map((l) => `crowd_level.ilike.${l}`).join(",")
    );
  }

  return baseQuery;
}

/**
 * Internal function to fetch beaches by intent and city - used by cached wrapper.
 */
async function _getBeachesByIntentAndCityInternal(
  intent: string,
  citySlug: string,
  stateSlug: string
): Promise<Beach[]> {
  const supabase = createPublicReadClient();

  // Start with base query for city
  let query = supabase
    .from("beaches")
    .select(BEACH_DETAIL_FIELDS)
    .or("is_private.is.null,is_private.eq.false");

  // Match city: try both original slug (handles hyphens like "Carmel-by-the-Sea")
  // and space-replaced form (handles "San Diego" stored as "san-diego" in URL)
  const escapedCity = escapeLikePattern(citySlug);
  const cityPattern = citySlug.replace(/-/g, " ");
  const escapedCityPattern = escapeLikePattern(cityPattern);
  query = query.or(`city.ilike.%${escapedCity}%,city.ilike.%${escapedCityPattern}%`);

  // Match state
  query = query.eq("state", stateSlug.toUpperCase());

  // Apply intent filters
  query = applyIntentFilters(query, intent);

  const { data, error } = await query.order("name");
  if (error) throw error;

  return rankBeaches((data ?? []) as Beach[], { compare: () => 0 });
}

/**
 * Cached version of beaches by intent and city - revalidates every 15 minutes.
 * Used by intent pages to reduce database queries for repeated lookups.
 */
const getCachedBeachesByIntentAndCity = unstable_cache(
  _getBeachesByIntentAndCityInternal,
  ["beaches-by-intent-city"],
  {
    revalidate: 900, // 15 minutes
    tags: ["beaches"],
  }
);

/**
 * Fetch beaches matching an intent for a specific city.
 * Used for database-driven intent pages.
 *
 * Uses cross-request caching (15 minutes) for better performance on intent pages.
 *
 * @param intent - The surf intent (beginner, least-crowded, tide, water-temp)
 * @param citySlug - City slug (e.g., "san-diego")
 * @param stateSlug - State slug (e.g., "ca")
 */
export async function getBeachesByIntentAndCity(
  intent: string,
  citySlug: string,
  stateSlug: string
) {
  return withDatabaseOperation<Beach[]>(async () => {
    try {
      // Use cached version for cross-request performance
      const beaches = await getCachedBeachesByIntentAndCity(intent, citySlug, stateSlug);
      return {
        data: beaches,
        error: null,
      };
    } catch {
      // Fallback to uncached on cache infrastructure error
      trackFallback({ domain: 'beach-query', field: 'cache_and_db', fallbackValue: '[]', context: { intent, citySlug } });
      const beaches = await _getBeachesByIntentAndCityInternal(intent, citySlug, stateSlug);
      return {
        data: beaches,
        error: null,
      };
    }
  });
}

/**
 * Internal function to fetch all beaches in a state - used by cached wrapper.
 */
async function _getBeachesByStateInternal(stateSlug: string): Promise<Beach[]> {
  const supabase = createPublicReadClient();

  const { data, error } = await supabase
    .from("beaches")
    .select(BEACH_DETAIL_FIELDS)
    .or("is_private.is.null,is_private.eq.false")
    .eq("state", stateSlug.toUpperCase())
    .order("city")
    .order("name");

  if (error) throw error;
  return rankBeaches((data ?? []) as Beach[], { compare: () => 0 });
}

/**
 * Cached version of beaches by state - revalidates every hour.
 * Used by guides pages that need all beaches regardless of skill level.
 */
const getCachedBeachesByState = unstable_cache(
  _getBeachesByStateInternal,
  ["beaches-by-state"],
  {
    revalidate: 3600, // 1 hour - matches guides page revalidate
    tags: ["beaches"],
  }
);

/**
 * Fetch all beaches in a state (no intent/skill filtering).
 * Used for guides pages that need all beaches regardless of skill level.
 *
 * Uses cross-request caching (1 hour) for better performance on guides pages.
 *
 * @param stateSlug - State slug (e.g., "ca")
 */
export async function getBeachesByState(stateSlug: string) {
  return withDatabaseOperation<Beach[]>(async () => {
    try {
      // Use cached version for cross-request performance
      const beaches = await getCachedBeachesByState(stateSlug);
      return {
        data: beaches,
        error: null,
      };
    } catch {
      // Fallback to uncached on cache infrastructure error
      const beaches = await _getBeachesByStateInternal(stateSlug);
      return {
        data: beaches,
        error: null,
      };
    }
  });
}

/**
 * Internal function to fetch beaches by intent and state - used by cached wrapper.
 */
async function _getBeachesByIntentAndStateInternal(
  intent: string,
  stateSlug: string
): Promise<Beach[]> {
  const supabase = createPublicReadClient();

  let query = supabase
    .from("beaches")
    .select(BEACH_DETAIL_FIELDS)
    .or("is_private.is.null,is_private.eq.false")
    .eq("state", stateSlug.toUpperCase());

  // Apply intent filters
  query = applyIntentFilters(query, intent);

  const { data, error } = await query
    .order("city")
    .order("name");

  if (error) throw error;

  const ranked = await rankBeaches((data ?? []) as Beach[], {
    compare: () => 0,
  });
  return ranked.slice(0, 100);
}

/**
 * Cached version of beaches by intent and state - revalidates every 15 minutes.
 * Used by state-level intent pages to reduce database queries.
 */
const getCachedBeachesByIntentAndState = unstable_cache(
  _getBeachesByIntentAndStateInternal,
  ["beaches-by-intent-state"],
  {
    revalidate: 900, // 15 minutes
    tags: ["beaches"],
  }
);

/**
 * Fetch beaches matching an intent for an entire state.
 * Used for state-level SEO pages like /beginner/ca.
 *
 * Uses cross-request caching (15 minutes) for better performance on intent pages.
 *
 * @param intent - The surf intent
 * @param stateSlug - State slug (e.g., "ca")
 */
export async function getBeachesByIntentAndState(
  intent: string,
  stateSlug: string
) {
  return withDatabaseOperation<Beach[]>(async () => {
    try {
      // Use cached version for cross-request performance
      const beaches = await getCachedBeachesByIntentAndState(intent, stateSlug);
      return {
        data: beaches,
        error: null,
      };
    } catch {
      // Fallback to uncached on cache infrastructure error
      const beaches = await _getBeachesByIntentAndStateInternal(intent, stateSlug);
      return {
        data: beaches,
        error: null,
      };
    }
  });
}
