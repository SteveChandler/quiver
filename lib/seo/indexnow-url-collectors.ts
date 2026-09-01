import { getIndexableCamRegionSlugs } from "@/lib/data/cam-regions";
import { getAllForecastRegionSlugs } from "@/lib/data/forecast-regions";
import { HUB_REGION_SLUGS } from "@/lib/data/hub-regions";
import { SITE_URL } from "@/lib/constants/seo";
import { createPublicReadClient } from "@/lib/supabase/server";
import { COLLISION_CITY_MAP } from "@/lib/seo/city-collision-list";
import { buildCitySlug } from "@/lib/seo/city-slug-utils";
import { getIndexableSeoFunnelRoutes } from "@/lib/seo/funnel-pages";
import { evaluateBeachForecastIndexability } from "@/lib/seo/indexability";
import { getForecastIndexabilityForBeaches } from "@/lib/seo/forecast-indexability";
import {
  buildBeachUrl,
  isValidCountrySlug,
  isValidStateSlug,
  stateToSlug,
} from "@/lib/utils/beach-url-utils";
import { slugifyAscii } from "@/lib/utils/text-utils";

export interface IndexNowUrlGroups {
  intentUrls: string[];
  locationUrls: string[];
  staticSeoUrls: string[];
  beachDetailUrls: string[];
  bestTimeCityUrls: string[];
}

const INTENTS = [
  "beginner",
  "least-crowded",
  "tide",
  "water-temp",
  "longboard",
  "dawn-patrol",
  "sunset",
] as const;

const US_INTENT_STATES = [
  "ca", "or", "wa", "hi", "pr", "fl", "nj", "ny", "nc", "sc", "tx", "ma",
  "me", "nh", "ri", "ga",
] as const;

const STATIC_INDEXNOW_ROUTES = [
  "/",
  "/features",
  "/about",
  "/privacy",
  "/terms",
  "/plans",
  "/map",
  "/beaches",
  "/beaches/usa",
  "/beaches/mexico",
  "/for-surf-schools",
  "/for-businesses",
  "/best-time-to-surf",
  "/tools",
  "/learn",
  "/free-surf-reports",
  "/vs/surfline",
  "/forecast-accuracy",
] as const;

export async function collectIndexNowUrlGroups(): Promise<IndexNowUrlGroups> {
  const [
    intentUrls,
    locationUrls,
    staticSeoUrls,
    beachDetailUrls,
    bestTimeCityUrls,
  ] = await Promise.all([
    collectIntentUrls(),
    collectLocationUrls(),
    Promise.resolve(collectStaticSeoUrls()),
    collectBeachDetailUrls(),
    collectBestTimeCityUrls(),
  ]);

  return {
    intentUrls,
    locationUrls,
    staticSeoUrls,
    beachDetailUrls,
    bestTimeCityUrls,
  };
}

export function flattenIndexNowUrlGroups(groups: IndexNowUrlGroups): string[] {
  return [
    ...new Set([
      ...groups.intentUrls,
      ...groups.locationUrls,
      ...groups.staticSeoUrls,
      ...groups.beachDetailUrls,
      ...groups.bestTimeCityUrls,
    ]),
  ];
}

/**
 * Collect intent page URLs (city-level + state-level).
 * Mirrors the filtering logic in app/sitemap.ts getIntentRoutes().
 */
async function collectIntentUrls(): Promise<string[]> {
  const urls: string[] = [];

  try {
    const supabase = createPublicReadClient();
    const { data, error } = await supabase.rpc(
      "get_cities_with_beach_skills",
      { min_beaches: 1 }
    );

    if (error || !data) {
      console.error("IndexNow: Failed to fetch cities with beach skills", error);
      return urls;
    }

    type RpcRow = {
      city: string;
      state: string;
      country: string;
      beach_count: number;
      has_beginner: boolean;
      has_advanced: boolean;
      has_least_crowded?: boolean;
      has_editorial_content?: boolean;
    };

    const rows = data as unknown as RpcRow[];
    const usCities = rows.filter(
      (c) =>
        c.country?.toUpperCase() === "USA" || c.country?.toUpperCase() === "US"
    );

    const collisionMap = COLLISION_CITY_MAP;
    const beginnerIntents = new Set(["beginner", "longboard"]);
    const filteredIntents = new Set(["beginner", "longboard", "least-crowded"]);

    const statesWithBeginnerBeaches = new Set<string>();
    const statesWithLeastCrowdedBeaches = new Set<string>();

    const stateBeachCounts = new Map<string, number>();
    for (const city of usCities) {
      if (city.state) {
        stateBeachCounts.set(
          city.state,
          (stateBeachCounts.get(city.state) ?? 0) + city.beach_count
        );
        if (city.has_beginner) {
          statesWithBeginnerBeaches.add(city.state.toLowerCase());
        }
        if (city.has_least_crowded) {
          statesWithLeastCrowdedBeaches.add(city.state.toLowerCase());
        }
      }
    }

    for (const city of usCities) {
      const citySlug = buildCitySlug(city.city, city.state, collisionMap);
      if (!citySlug) continue;

      if (city.beach_count === 1) {
        const stateTotal = stateBeachCounts.get(city.state) ?? 0;
        if (stateTotal >= 20 || !city.has_editorial_content) continue;
      }
      if (city.beach_count === 2 && !city.has_editorial_content) continue;

      for (const intent of INTENTS) {
        if (filteredIntents.has(intent)) {
          if (beginnerIntents.has(intent) && !city.has_beginner) continue;
          if (intent === "least-crowded" && !city.has_least_crowded) continue;
        }
        urls.push(`${SITE_URL}/${intent}/${citySlug}`);
      }
    }

    for (const state of US_INTENT_STATES) {
      for (const intent of INTENTS) {
        if (filteredIntents.has(intent)) {
          if (
            beginnerIntents.has(intent) &&
            !statesWithBeginnerBeaches.has(state)
          ) {
            continue;
          }
          if (
            intent === "least-crowded" &&
            !statesWithLeastCrowdedBeaches.has(state)
          ) {
            continue;
          }
        }
        urls.push(`${SITE_URL}/${intent}/${state}`);
      }
    }
  } catch (error) {
    console.error("IndexNow: Error collecting intent URLs", error);
  }

  return urls;
}

/**
 * Collect city hub / location page URLs.
 * Mirrors getLocationRoutes() in app/sitemap.ts.
 */
async function collectLocationUrls(): Promise<string[]> {
  const urls: string[] = [];

  try {
    const supabase = createPublicReadClient();
    const { data, error } = await supabase.rpc("get_all_beach_locations");

    if (error || !data) {
      console.error("IndexNow: Failed to fetch beach locations", error);
      return urls;
    }

    type LocationRow = {
      city: string;
      state: string;
      country?: string | null;
      beachCount?: number;
      isMetro?: boolean;
    };

    const locations = data as unknown as LocationRow[];
    const usaStates = new Set<string>();
    const internationalHubs = new Set<string>();

    for (const loc of locations) {
      const isUsa =
        !loc.country ||
        loc.country.toLowerCase() === "usa" ||
        loc.country.toLowerCase() === "us";

      if (isUsa) {
        const stateSlug = stateToSlug(loc.state);
        const citySlug = slugifyAscii(loc.city);
        if (stateSlug && citySlug) {
          usaStates.add(stateSlug);
          urls.push(`${SITE_URL}/${stateSlug}/${citySlug}`);
        }
      } else {
        const countrySlug = slugifyAscii(loc.country ?? "");
        const regionSlug = slugifyAscii(loc.state);
        const citySlug = slugifyAscii(loc.city);
        if (countrySlug && regionSlug && citySlug) {
          if (isValidCountrySlug(countrySlug)) {
            internationalHubs.add(`${SITE_URL}/beaches/${countrySlug}`);
            internationalHubs.add(`${SITE_URL}/beaches/${countrySlug}/${regionSlug}`);
          }
          urls.push(`${SITE_URL}/${countrySlug}/${regionSlug}/${citySlug}`);
        }
      }
    }

    for (const state of usaStates) {
      urls.push(`${SITE_URL}/beaches/usa/${state}`);
    }

    urls.push(...internationalHubs);
  } catch (error) {
    console.error("IndexNow: Error collecting location URLs", error);
  }

  return urls;
}

/**
 * Collect beach detail pages and their US-only tide/water-temp subpages.
 * Mirrors buildBeachRoutes() in app/sitemap.ts.
 */
async function collectBeachDetailUrls(): Promise<string[]> {
  const urls: string[] = [];
  const pageSize = 1000;
  let from = 0;

  type BeachRow = {
    id: string;
    slug: string | null;
    city: string | null;
    state: string | null;
    country?: string | null;
    timezone?: string | null;
  };

  const beaches: BeachRow[] = [];

  try {
    const supabase = createPublicReadClient();

    while (true) {
      const { data, error } = await supabase
        .from("beaches")
        .select("id, slug, city, state, country, timezone")
        .not("slug", "is", null)
        .not("city", "is", null)
        .not("state", "is", null)
        .range(from, from + pageSize - 1);

      if (error || !data) {
        console.error("IndexNow: Failed to fetch beach detail URLs", error);
        return urls;
      }

      const rows = data as BeachRow[];
      beaches.push(...rows);

      if (rows.length < pageSize) break;
      from += pageSize;
    }

    const forecastIndexabilityByBeachId = await getForecastIndexabilityForBeaches(
      beaches.map((beach) => ({ id: beach.id, timezone: beach.timezone })),
    );

    for (const beach of beaches) {
      const beachPath = buildBeachUrl(beach);
      const snapshot = forecastIndexabilityByBeachId.get(beach.id);
      const forecastIndexable = evaluateBeachForecastIndexability({
        canonicalValid: !beachPath.startsWith("/beach/"),
        forecastAvailable: snapshot?.forecastAvailable ?? false,
        selectedStateComplete: snapshot?.selectedStateComplete ?? false,
        forecastFresh: snapshot?.forecastFresh ?? false,
      }).indexable;
      if (!forecastIndexable) continue;

      urls.push(`${SITE_URL}${beachPath}`);

      const stateSlug = stateToSlug(beach.state);
      if (isValidStateSlug(stateSlug)) {
        urls.push(`${SITE_URL}${beachPath}/tides`);
        urls.push(`${SITE_URL}${beachPath}/water-temp`);
      }
    }
  } catch (error) {
    console.error("IndexNow: Error collecting beach detail URLs", error);
  }

  return urls;
}

/**
 * Collect city-level best-time-to-surf pages.
 * Mirrors getBestTimeToSurfRoutes() in app/sitemap.ts.
 */
async function collectBestTimeCityUrls(): Promise<string[]> {
  const urls: string[] = [];

  try {
    const supabase = createPublicReadClient();
    const { data, error } = await supabase
      .from("beaches")
      .select("city, state")
      .not("best_months", "is", null)
      .or("is_private.is.null,is_private.eq.false")
      .not("city", "is", null)
      .not("state", "is", null);

    if (error || !data) {
      console.error("IndexNow: Failed to fetch best-time city URLs", error);
      return urls;
    }

    type CityRow = {
      city: string | null;
      state: string | null;
    };

    const cityKeys = new Set<string>();
    for (const row of data as CityRow[]) {
      if (!row.city || !row.state) continue;
      cityKeys.add(`${row.city}|${row.state}`);
    }

    for (const key of cityKeys) {
      const [city, state] = key.split("|");
      if (!city || !state) continue;

      const citySlug = buildCitySlug(city, state, COLLISION_CITY_MAP);
      if (citySlug) {
        urls.push(`${SITE_URL}/best-time-to-surf/${citySlug}`);
      }
    }
  } catch (error) {
    console.error("IndexNow: Error collecting best-time city URLs", error);
  }

  return urls;
}

/**
 * Collect static SEO-important URLs that benefit from proactive indexing:
 * high-value static pages, forecast/cam regions, guides, tools, and funnel pages.
 */
export function collectStaticSeoUrls(): string[] {
  const urls = STATIC_INDEXNOW_ROUTES.map((route) => `${SITE_URL}${route}`);

  urls.push(`${SITE_URL}/forecast`);
  for (const slug of getAllForecastRegionSlugs()) {
    urls.push(`${SITE_URL}/forecast/${slug}`);
  }

  urls.push(`${SITE_URL}/cams`);
  for (const slug of getIndexableCamRegionSlugs()) {
    urls.push(`${SITE_URL}/cams/${slug}`);
  }

  for (const region of HUB_REGION_SLUGS) {
    urls.push(`${SITE_URL}/guides/surfing-${region}`);
  }

  for (const route of getIndexableSeoFunnelRoutes()) {
    urls.push(`${SITE_URL}${route}`);
  }

  return [...new Set(urls)];
}
