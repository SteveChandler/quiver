"use server";

import { unstable_cache } from "next/cache";
import { withDatabaseOperation } from "@/lib/server-action-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Beach } from "@/types/database";

// Selective field query for beach list - only fetch commonly needed fields
// Note: Only includes fields that exist in the beaches table schema
// Updated after 20251025 migrations: location→city, latitude→lat, longitude→lon, region→state
// WARNING: Some environments may still use legacy columns (location/region) and may not have updated_at.
// We avoid selecting `updated_at` and fall back to legacy fields on schema-mismatch errors.
const BEACH_LIST_FIELDS =
  "id, name, slug, city, lat, lon, state, country, created_at, is_private";
const BEACH_LIST_FIELDS_LEGACY =
  "id, name, location, region, lat, lon, country, created_at, is_private";

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

export async function getBeaches() {
  return withDatabaseOperation<Beach[]>(async (supabase) => {
    try {
      // Use selective fields instead of * to reduce data transfer
      let result: any = await supabase
        .from("beaches")
        .select(BEACH_LIST_FIELDS)
        .order("name");

      // If schema mismatch (unknown column), retry with legacy field set.
      if (result.error && (result.error as any)?.code === "42703") {
        result = (await supabase
          .from("beaches")
          .select(BEACH_LIST_FIELDS_LEGACY)
          .order("name")) as any;

        // Normalize legacy location/region into city/state for downstream match strategies
        if (Array.isArray((result as any).data)) {
          (result as any).data = (result as any).data.map((b: any) => ({
            ...b,
            city: b.city ?? b.location ?? null,
            state: b.state ?? b.region ?? null,
            slug: b.slug ?? null,
            updated_at: b.updated_at ?? null,
          }));
        }
      }

      return result;
    } catch (err) {
      // Normalize non-Error throws to a standard shape
      return { data: null, error: { message: err instanceof Error ? err.message : "Unknown error" } } as any;
    }
  });
}

export async function getBeachById(id: string) {
  return withDatabaseOperation<Beach>(async (supabase) => {
    // Fetch full details for single beach view
    return supabase
      .from("beaches")
      .select(BEACH_DETAIL_FIELDS)
      .eq("id", id)
      .single();
  });
}

/**
 * Fetch 0..N beaches by slug without throwing on 0 results or duplicates.
 *
 * - Use this for public routing where duplicate slugs can exist and should be
 *   disambiguated by URL context (state/city/country).
 * - Excludes private beaches.
 */
export async function getBeachesBySlug(slug: string) {
  return withDatabaseOperation<Beach[]>(async (supabase) => {
    const normalized = slug.trim().toLowerCase();

    if (!normalized) {
      return { data: [], error: null };
    }

    const { data, error } = await supabase
      .from("beaches")
      .select(BEACH_DETAIL_FIELDS)
      .eq("slug", normalized)
      .or("is_private.is.null,is_private.eq.false")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return { data: (data ?? []) as Beach[], error: null };
  });
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
 * Intent to crowd_level mapping for SORTING (not filtering).
 * These intents show all beaches but prioritize beaches with matching crowd levels.
 */
const INTENT_CROWD_SORT_PRIORITY: Record<string, string[]> = {
  "least-crowded": ["light", "low"],
};

/**
 * Sort beaches by crowd_level priority.
 * Beaches with crowd_level in priorityLevels appear first, others at the end.
 * Secondary sort by name for consistent ordering.
 */
function sortByIntentCrowdPriority(
  beaches: Beach[],
  priorityLevels: string[]
): Beach[] {
  const prioritySet = new Set(priorityLevels.map((l) => l.toLowerCase()));
  return [...beaches].sort((a, b) => {
    const aMatch = a.crowd_level && prioritySet.has(a.crowd_level.toLowerCase());
    const bMatch = b.crowd_level && prioritySet.has(b.crowd_level.toLowerCase());
    if (aMatch && !bMatch) return -1;
    if (!aMatch && bMatch) return 1;
    // Secondary sort by name for consistent ordering
    return (a.name || "").localeCompare(b.name || "");
  });
}

/**
 * Shared function to build intent-based beach queries.
 * Applies skill-based filters for intents that have them.
 * Crowd-based intents use post-query sorting instead of filtering.
 *
 * @param supabase - Supabase client
 * @param intent - The surf intent
 * @param baseQuery - Initial query with location filters already applied
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

  // NOTE: crowd-based intents (least-crowded) use SORTING not FILTERING
  // to ensure pages always render content even without crowd_level data
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
  const supabase = await createSupabaseServerClient();

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

  let beaches = (data ?? []) as Beach[];

  // Apply post-query sorting for crowd-based intents
  const crowdSortPriority = INTENT_CROWD_SORT_PRIORITY[intent];
  if (crowdSortPriority) {
    beaches = sortByIntentCrowdPriority(beaches, crowdSortPriority);
  }

  return beaches;
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
      return { data: beaches, error: null };
    } catch {
      // Fallback to uncached on cache infrastructure error
      const beaches = await _getBeachesByIntentAndCityInternal(intent, citySlug, stateSlug);
      return { data: beaches, error: null };
    }
  });
}

/**
 * Fetch all beaches in a state (no intent/skill filtering).
 * Used for guides pages that need all beaches regardless of skill level.
 *
 * @param stateSlug - State slug (e.g., "ca")
 */
export async function getBeachesByState(stateSlug: string) {
  return withDatabaseOperation<Beach[]>(async (supabase) => {
    const { data, error } = await supabase
      .from("beaches")
      .select(BEACH_DETAIL_FIELDS)
      .or("is_private.is.null,is_private.eq.false")
      .eq("state", stateSlug.toUpperCase())
      .order("city")
      .order("name")
      .limit(100);

    if (error) throw error;
    return { data: (data ?? []) as Beach[], error: null };
  });
}

/**
 * Internal function to fetch beaches by intent and state - used by cached wrapper.
 */
async function _getBeachesByIntentAndStateInternal(
  intent: string,
  stateSlug: string
): Promise<Beach[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("beaches")
    .select(BEACH_DETAIL_FIELDS)
    .or("is_private.is.null,is_private.eq.false")
    .eq("state", stateSlug.toUpperCase());

  // Apply intent filters
  query = applyIntentFilters(query, intent);

  const { data, error } = await query
    .order("city")
    .order("name")
    .limit(100);

  if (error) throw error;

  let beaches = (data ?? []) as Beach[];

  // Apply post-query sorting for crowd-based intents
  const crowdSortPriority = INTENT_CROWD_SORT_PRIORITY[intent];
  if (crowdSortPriority) {
    beaches = sortByIntentCrowdPriority(beaches, crowdSortPriority);
  }

  return beaches;
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
      return { data: beaches, error: null };
    } catch {
      // Fallback to uncached on cache infrastructure error
      const beaches = await _getBeachesByIntentAndStateInternal(intent, stateSlug);
      return { data: beaches, error: null };
    }
  });
}
