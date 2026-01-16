"use server";

import { withDatabaseOperation } from "@/lib/server-action-utils";
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
 * Intent to crowd_level mapping.
 */
const INTENT_CROWD_FILTERS: Record<string, string[]> = {
  "least-crowded": ["light", "low"],
};

/**
 * Fetch beaches matching an intent for a specific city.
 * Used for database-driven intent pages.
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
  return withDatabaseOperation<Beach[]>(async (supabase) => {
    // Start with base query for city
    let query = supabase
      .from("beaches")
      .select(BEACH_DETAIL_FIELDS)
      .or("is_private.is.null,is_private.eq.false");

    // Match city by slug pattern (handles hyphenated city names)
    const cityPattern = citySlug.replace(/-/g, " ");
    query = query.ilike("city", `%${cityPattern}%`);

    // Match state
    const stateUpper = stateSlug.toUpperCase();
    query = query.or(`state.eq.${stateUpper},state.ilike.%${stateSlug}%`);

    // Apply intent-specific filters
    const skillFilters = INTENT_SKILL_FILTERS[intent];
    if (skillFilters) {
      const skillConditions = skillFilters
        .map((s) => `skill_level.ilike.%${s}%`)
        .join(",");
      query = query.or(skillConditions);
    }

    const crowdFilters = INTENT_CROWD_FILTERS[intent];
    if (crowdFilters) {
      const crowdConditions = crowdFilters
        .map((c) => `crowd_level.ilike.%${c}%`)
        .join(",");
      query = query.or(crowdConditions);
    }

    // tide and water-temp intents return all beaches (no filtering)

    const { data, error } = await query.order("name");

    if (error) throw error;

    return { data: (data ?? []) as Beach[], error: null };
  });
}

/**
 * Fetch beaches matching an intent for an entire state.
 * Used for state-level SEO pages like /beginner/ca.
 *
 * @param intent - The surf intent
 * @param stateSlug - State slug (e.g., "ca")
 */
export async function getBeachesByIntentAndState(
  intent: string,
  stateSlug: string
) {
  return withDatabaseOperation<Beach[]>(async (supabase) => {
    let query = supabase
      .from("beaches")
      .select(BEACH_DETAIL_FIELDS)
      .or("is_private.is.null,is_private.eq.false");

    // Match state
    const stateUpper = stateSlug.toUpperCase();
    query = query.or(`state.eq.${stateUpper},state.ilike.%${stateSlug}%`);

    // Apply intent-specific filters (same as city version)
    const skillFilters = INTENT_SKILL_FILTERS[intent];
    if (skillFilters) {
      const skillConditions = skillFilters
        .map((s) => `skill_level.ilike.%${s}%`)
        .join(",");
      query = query.or(skillConditions);
    }

    const crowdFilters = INTENT_CROWD_FILTERS[intent];
    if (crowdFilters) {
      const crowdConditions = crowdFilters
        .map((c) => `crowd_level.ilike.%${c}%`)
        .join(",");
      query = query.or(crowdConditions);
    }

    const { data, error } = await query
      .order("city")
      .order("name")
      .limit(100); // Limit for performance

    if (error) throw error;

    return { data: (data ?? []) as Beach[], error: null };
  });
}
