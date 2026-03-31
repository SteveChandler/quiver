"use server";

import { createPublicReadClient } from "@/lib/supabase/server";
import { parseLocationFromSlug } from "@/lib/utils/location-slug";
import { parseHiIslandCitySlug } from "@/lib/utils/beach-url-utils";

/**
 * Session timing module structure
 */
export interface SessionTimingModule {
  icon: "sun" | "clock" | "calendar";
  title: string;
  summary: string;
}

/**
 * Quick action link structure
 */
export interface QuickLink {
  label: string;
  href: string;
}

/**
 * City editorial content from the database
 */
export interface CityEditorialContent {
  id: string;
  city_slug: string;
  state_slug: string;
  country_slug: string;
  city_name: string;
  region_label: string;
  description: string[];
  session_timing: SessionTimingModule[];
  quick_links: QuickLink[];
  featured_intents: string[];
  planning_checklist: string[];
  created_at: string;
  updated_at: string;
}

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
  countrySlug: string = "usa"
): Promise<CityEditorialContent | null> {
  const supabase = createPublicReadClient();

  const fetchEditorial = async (slug: string) => {
    return await supabase.rpc("get_city_editorial", {
      p_city: slug,
      p_state: stateSlug,
      p_country: countrySlug,
    });
  };

  // First try the requested city slug
  let { data, error } = await fetchEditorial(citySlug);

  if (error) {
    console.error("[getCityEditorialContent] Error fetching editorial content:", error);
    return null;
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
    session_timing:
      typeof result.session_timing === "string"
        ? JSON.parse(result.session_timing)
        : result.session_timing || [],
    quick_links:
      typeof result.quick_links === "string"
        ? JSON.parse(result.quick_links)
        : result.quick_links || [],
  };
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
