"use server";

import { unstable_cache } from "next/cache";
import { cache } from "react";
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

const CITY_EDITORIAL_CACHE_SECONDS = 24 * 60 * 60;
const CITY_EDITORIAL_CACHE_TAG = "city-editorial";

type CityEditorialLookup = [
  citySlug: string,
  stateSlug: string,
  countrySlug: string,
  intent: CityEditorialIntent,
  allowBaseCityFallback: boolean,
];

class UncacheableCityEditorial extends Error {
  constructor(readonly editorial: CityEditorialContent | null) {
    super("City editorial RPC failed");
  }
}

const getCityEditorialMemo = cache((..._args: CityEditorialLookup): {
  read?: Promise<CityEditorialContent | null>;
} => ({}));

function readCachedCityEditorial(...args: CityEditorialLookup): Promise<CityEditorialContent | null> {
  // A new key prevents Next from serving stale editorial after a failed refresh.
  const window = Math.floor(Date.now() / (CITY_EDITORIAL_CACHE_SECONDS * 1000));
  return unstable_cache(fetchCityEditorialContent, [CITY_EDITORIAL_CACHE_TAG, String(window)], {
    revalidate: CITY_EDITORIAL_CACHE_SECONDS,
    tags: [CITY_EDITORIAL_CACHE_TAG],
  })(...args);
}

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
  allowBaseCityFallback: boolean = true,
): Promise<CityEditorialContent | null> {
  const args: CityEditorialLookup = [citySlug, stateSlug, countrySlug, intent, allowBaseCityFallback];
  const memo = getCityEditorialMemo(...args);
  const read = process.env.PUBLIC_CITY_EDITORIAL_CACHE === "false"
    ? fetchCityEditorialContent
    : readCachedCityEditorial;

  return (memo.read ??= read(...args).catch((error: unknown) => {
    delete memo.read;
    if (error instanceof UncacheableCityEditorial) return error.editorial;
    throw error;
  }));
}

async function fetchCityEditorialContent(
  ...[citySlug, stateSlug, countrySlug, intent, allowBaseCityFallback]: CityEditorialLookup
): Promise<CityEditorialContent | null> {
  const supabase = createPublicReadClient();

  const fetchEditorial = async (slug: string) => {
    return await supabase.rpc("get_city_editorial", {
      p_city: slug,
      p_state: stateSlug,
      p_country: countrySlug,
      p_intent: intent ?? undefined,
    });
  };

  // First try the requested city slug
  const first = await fetchEditorial(citySlug);
  let { data } = first;

  if (first.error) {
    console.error("[getCityEditorialContent] Error fetching editorial content:", first.error);
    throw new UncacheableCityEditorial(null);
  }

  let fallbackFailed = false;
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
    if (retry.error) fallbackFailed = true;
    else data = retry.data;
  }

  // HI island-suffixed city slugs (Waimea-only to start): fallback to base city slug
  if (!data && allowBaseCityFallback && stateSlug?.toLowerCase() === "hi") {
    const parsed = parseHiIslandCitySlug(citySlug);
    if (parsed.islandSlug && parsed.baseCitySlug && parsed.baseCitySlug !== citySlug) {
      const retry = await fetchEditorial(parsed.baseCitySlug);
      if (retry.error) fallbackFailed = true;
      else data = retry.data;
    }
  }

  const editorial = data ? normalizeCityEditorial(data as unknown as CityEditorialContent, citySlug) : null;
  if (fallbackFailed) throw new UncacheableCityEditorial(editorial);
  return editorial;
}

function normalizeCityEditorial(result: CityEditorialContent, citySlug: string): CityEditorialContent {
  // Parse JSONB fields if they're returned as strings
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
