"use server";

import { createPublicReadClient } from "@/lib/supabase/server";
import { parseLocationFromSlug } from "@/lib/utils/location-slug";
import { parseHiIslandCitySlug } from "@/lib/utils/beach-url-utils";
import type {
  CityEditorialContent,
  CityEditorialIntent,
  EditorialSource,
  QuickLink,
  SessionTimingModule,
} from "@/types/editorial-content";

export type {
  CityEditorialContent,
  CityEditorialIntent,
  EditorialSource,
  QuickLink,
  SessionTimingModule,
};

function parseArrayField<T>(value: T[] | string | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

/**
 * Session timing module structure
 */
/**
 * Fetch editorial content for a city page.
 * Returns null if no editorial content exists for this location.
 *
 * @param citySlug - City slug (e.g., "san-diego")
 * @param stateSlug - State slug (e.g., "ca")
 * @param countrySlug - Country slug (e.g., "usa")
 */
export async function getCityEditorialContent(
  citySlug: string,
  stateSlug: string = "ca",
  countrySlug: string = "usa",
  intent: CityEditorialIntent = null,
): Promise<CityEditorialContent | null> {
  const supabase = createPublicReadClient();

  const fetchEditorial = async (slug: string) => {
    return await supabase.rpc("get_city_editorial", {
      p_city: slug,
      p_state: stateSlug,
      p_country: countrySlug,
      p_intent: intent,
    });
  };

  // First try the requested city slug
  let { data, error } = await fetchEditorial(citySlug);

  if (error) {
    console.error("[getCityEditorialContent] Error fetching editorial content:", error);
    return null;
  }

  // General city content was historically stored as either NULL or "general".
  // Intent pages always request their exact entry, so this fallback applies only
  // to the city/location content lookup.
  if (!data && intent === null) {
    const retry = await supabase.rpc("get_city_editorial", {
      p_city: citySlug,
      p_state: stateSlug,
      p_country: countrySlug,
      p_intent: "general",
    });
    if (!retry.error) data = retry.data;
  }

  // HI island-suffixed city slugs (Waimea-only to start): fallback to base city slug
  if (!data && stateSlug?.toLowerCase() === "hi") {
    const parsed = parseHiIslandCitySlug(citySlug);
    if (parsed.islandSlug && parsed.baseCitySlug && parsed.baseCitySlug !== citySlug) {
      const retry = await fetchEditorial(parsed.baseCitySlug);
      if (!retry.error) {
        data = retry.data as any;
      }
    }
  }

  if (!data) return null;

  // Parse JSONB fields if they're returned as strings
  const result = data as unknown as CityEditorialContent;

  // Defensive fallback: avoid blank city labels in UI/SEO if DB row has empty city_name
  const normalizedCityName = (() => {
    const fromDb = (result.city_name || "").trim();
    if (fromDb) return fromDb;
    const fromSlug = (parseLocationFromSlug(citySlug) || "").trim();
    return fromSlug || citySlug;
  })();

  return {
    ...result,
    city_name: normalizedCityName,
    session_timing: parseArrayField<SessionTimingModule>(result.session_timing),
    quick_links: parseArrayField<QuickLink>(result.quick_links),
    editorial_sources: parseArrayField<EditorialSource>(result.editorial_sources),
  };
}

export async function getReviewedCityEditorialContent(): Promise<
  CityEditorialContent[]
> {
  const supabase = createPublicReadClient();
  const { data, error } = await supabase
    .from("city_editorial_content")
    .select("*");

  if (error) {
    console.error("[getReviewedCityEditorialContent] Error fetching editorial content:", error);
    return [];
  }

  return (data ?? []).map((row) => {
    const result = row as unknown as CityEditorialContent;
    return {
      ...result,
      description: parseArrayField<string>(result.description),
      session_timing: parseArrayField<SessionTimingModule>(result.session_timing),
      quick_links: parseArrayField<QuickLink>(result.quick_links),
      editorial_sources: parseArrayField<EditorialSource>(result.editorial_sources),
    };
  });
}

/**
 * Check if a city has editorial content without fetching the full content.
 * Useful for determining layout strategy before the full data fetch.
 */
export async function hasCityEditorialContent(
  citySlug: string,
  stateSlug: string = "ca",
  countrySlug: string = "usa"
): Promise<boolean> {
  const supabase = createPublicReadClient();

  const { data, error } = await supabase
    .from("city_editorial_content")
    .select("id")
    .eq("city_slug", citySlug)
    .eq("state_slug", stateSlug)
    .eq("country_slug", countrySlug)
    .maybeSingle();

  if (error) {
    console.error("[hasCityEditorialContent] Error checking editorial content:", error);
    return false;
  }

  return !!data;
}
