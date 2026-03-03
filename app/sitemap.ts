import type { MetadataRoute } from "next";

import { HUB_REGION_SLUGS } from "@/lib/data/hub-regions";
import { getAllForecastRegionSlugs } from "@/lib/data/forecast-regions";
import { getAllCamRegionSlugs } from "@/lib/data/cam-regions";
import { getCitiesWithBestMonthsData } from "@/actions/city/best-time-actions";
import { getAllBeachLocations } from "@/actions/beach/beach-location-list-actions";
import { getBeaches } from "@/actions/beach/beach-query-actions";
import { getAllCitiesWithBeachSkills } from "@/actions/beach/beach-location-actions";
import {
  buildBeachUrl,
  cityToSlug,
  stateToSlug,
} from "@/lib/utils/beach-url-utils";
import { slugifyAscii } from "@/lib/utils/text-utils";
import { buildCitySlug } from "@/lib/seo/city-slug-utils";
import { COLLISION_CITY_MAP } from "@/lib/seo/city-collision-list";

const baseUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
).replace(/\/$/, "");

// Force dynamic rendering because sitemap generation requires database queries
// at request time to fetch beaches, locations, and cities with skill data.
export const dynamic = "force-dynamic";

/**
 * Generate a single flat sitemap combining all routes.
 *
 * NOTE: Reverted from segmented sitemap pattern due to Next.js 16 bug where
 * generateSitemaps() does NOT auto-generate a sitemap index at /sitemap.xml,
 * causing a 404. This flat approach ensures /sitemap.xml is properly served.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Sitemap protocol limit: 50,000 URLs / 50 MB per file.
  // Current estimate: ~8,500 URLs — well under the limit.

  // Combine all route generators into a single flat sitemap
  const [
    staticRoutes,
    beachRoutes,
    locationRoutes,
    intentRoutes,
    guideRoutes,
    forecastRoutes,
    camRoutes,
    bestTimeRoutes,
  ] = await Promise.all([
    Promise.resolve(getStaticRoutes()),
    getBeachRoutes(),
    getLocationRoutes(),
    getIntentRoutes(),
    Promise.resolve(getGuideRoutes()),
    Promise.resolve(getForecastRoutes()),
    Promise.resolve(getCamRoutes()),
    getBestTimeToSurfRoutes(),
  ]);

  return [
    ...staticRoutes,
    ...beachRoutes,
    ...locationRoutes,
    ...intentRoutes,
    ...guideRoutes,
    ...forecastRoutes,
    ...camRoutes,
    ...bestTimeRoutes,
  ];
}

// =============================================================================
// Route Generators
// =============================================================================

/**
 * Static pages - home, features, about, etc.
 */
function getStaticRoutes(): MetadataRoute.Sitemap {
  // Use fixed date - these pages change when content updates, not per-request
  const staticPageDate = "2026-02-10";

  return [
    "/",
    "/features",
    "/about",
    "/privacy",
    "/terms",
    "/map",
    "/beaches",
    "/beaches/usa",
    "/for-surf-schools",
    "/for-businesses",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: staticPageDate,
    changeFrequency: "daily",
    priority: route === "/" ? 1 : 0.7,
  }));
}

/**
 * Beach detail pages.
 *
 * NOTE: Tides/water-temp sub-pages are excluded to reduce thin content signals.
 * These are discoverable via internal links on beach detail pages.
 */
async function getBeachRoutes(): Promise<MetadataRoute.Sitemap> {
  const beachesResponse = await getBeaches();
  if (!beachesResponse.success || !beachesResponse.data) {
    console.error("Sitemap: Failed to fetch beaches");
    return [];
  }

  const beaches = beachesResponse.data;
  const fallbackDate = "2026-02-10";

  return beaches
    .filter((b) => b.slug && b.city && b.state) // Only include beaches with complete location data
    .map((beach) => {
      const beachUrl = `${baseUrl}${buildBeachUrl(beach)}`;

      const lastModifiedDate =
        (beach as { updated_at?: string | null }).updated_at ||
        beach.created_at ||
        fallbackDate;

      // Main beach page only
      return {
        url: beachUrl,
        lastModified: lastModifiedDate,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      };
    });
}

/**
 * Location pages - city and state listing pages.
 */
async function getLocationRoutes(): Promise<MetadataRoute.Sitemap> {
  const response = await getAllBeachLocations();
  if (!response.success || !response.data) {
    console.error("Sitemap: Failed to load beach locations");
    return [];
  }

  // Use fixed date - location pages change when template updates, not per-request
  const locationPageDate = "2026-02-01";

  const usaStates = new Set<string>();
  const locationRoutes: MetadataRoute.Sitemap = [];

  for (const location of response.data) {
    const isUsa =
      !location.country ||
      String(location.country).toLowerCase() === "usa" ||
      String(location.country).toLowerCase() === "us";

    // HI: replace ambiguous Waimea city URL with island-specific pages
    if (
      isUsa &&
      stateToSlug(location.state) === "hi" &&
      cityToSlug(location.city) === "waimea"
    ) {
      usaStates.add("hi");
      locationRoutes.push(
        {
          url: `${baseUrl}/beaches/usa/hi/waimea-kauai`,
          lastModified: locationPageDate,
          changeFrequency: "weekly",
          priority: 0.75,
        },
        {
          url: `${baseUrl}/beaches/usa/hi/waimea-big-island`,
          lastModified: locationPageDate,
          changeFrequency: "weekly",
          priority: 0.75,
        }
      );
      continue;
    }

    // Filter out locations with fewer than 2 beaches (thin content).
    // Metro areas (beachCount=0 in the listing) are exempt — their content
    // is aggregated from constituent cities at runtime.
    if (!(location as any).isMetro && (location.beachCount ?? 0) < 2) continue;

    if (isUsa) {
      const stateSlug = stateToSlug(location.state);
      const citySlug = slugifyAscii(location.city);
      if (stateSlug && citySlug) {
        usaStates.add(stateSlug);
        locationRoutes.push({
          url: `${baseUrl}/beaches/usa/${stateSlug}/${citySlug}`,
          lastModified: locationPageDate,
          changeFrequency: "weekly",
          priority: 0.75,
        });
      }
    } else {
      const countrySlug = slugifyAscii(location.country);
      const regionSlug = slugifyAscii(location.state);
      const citySlug = slugifyAscii(location.city);
      if (countrySlug && regionSlug && citySlug) {
        locationRoutes.push({
          url: `${baseUrl}/beaches/${countrySlug}/${regionSlug}/${citySlug}`,
          lastModified: locationPageDate,
          changeFrequency: "weekly",
          priority: 0.75,
        });
      }
    }
  }

  // Add state-level pages
  const stateRoutes: MetadataRoute.Sitemap = [...usaStates].map((stateSlug) => ({
    url: `${baseUrl}/beaches/usa/${stateSlug}`,
    lastModified: locationPageDate,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...stateRoutes, ...locationRoutes];
}

/**
 * Intent pages - city and state level intent pages.
 *
 * IMPORTANT: Filters out:
 * 1. Skill-based intent pages (beginner, longboard) for cities without matching beaches
 * 2. Cities with fewer than 2 beaches (thin content)
 * 3. Cities with exactly 2 beaches that lack editorial quality content
 *    (editorial quality = description + at least one of crowd_tips/wave_tips/best_conditions_prose
 *     on both beaches). Cities with 3+ beaches are included without this extra guard.
 *
 * This prevents empty or thin intent pages from being included in the sitemap.
 */
async function getIntentRoutes(): Promise<MetadataRoute.Sitemap> {
  // Use template version date - intent pages change when template updates
  const intentTemplateDate = "2026-02-10";

  // Skill-based intents that require cities to have matching beach skill levels
  const BEGINNER_INTENTS = new Set(["beginner", "longboard"]);
  const FILTERED_INTENTS = new Set(["beginner", "longboard", "least-crowded"]);
  const intents = ["beginner", "least-crowded", "tide", "water-temp", "longboard", "dawn-patrol", "sunset"];

  const routes: MetadataRoute.Sitemap = [];

  // Track which states have beginner/longboard beaches and least-crowded beaches
  // (derived from city data below).
  const statesWithBeginnerBeaches = new Set<string>();
  const statesWithLeastCrowdedBeaches = new Set<string>();

  // City-level intent pages (database-driven)
  try {
    const citiesResult = await getAllCitiesWithBeachSkills(1);
    if (citiesResult.success && citiesResult.data && citiesResult.data.length > 0) {
      // Filter to US-only cities (non-US cities lack state codes for disambiguation)
      const usCities = citiesResult.data.filter(
        (c) => c.country?.toUpperCase() === "USA" || c.country?.toUpperCase() === "US"
      );
      const collisionMap = COLLISION_CITY_MAP;

      // Derive which states have beginner/longboard beaches and least-crowded beaches
      // for state-level filtering below
      for (const c of usCities) {
        if (c.hasBeginnerBeaches && c.state) {
          statesWithBeginnerBeaches.add(c.state.toLowerCase());
        }
        if (c.hasLeastCrowdedBeaches && c.state) {
          statesWithLeastCrowdedBeaches.add(c.state.toLowerCase());
        }
      }

      for (const cityRecord of usCities) {
        const citySlug = buildCitySlug(cityRecord.city, cityRecord.state, collisionMap);
        if (!citySlug) continue;

        // Filter out cities with fewer than 2 beaches (thin content)
        if (cityRecord.beachCount < 2) continue;

        // For cities with exactly 2 beaches, require editorial quality content
        // (description + at least one editorial field on both beaches).
        // Cities with 3+ beaches have sufficient content depth without this check.
        if (cityRecord.beachCount === 2 && !cityRecord.hasEditorialContent) continue;

        for (const intent of intents) {
          // Filter skill-based and crowd-based intents to cities with matching beaches.
          // This ensures empty intent pages are NOT included in the sitemap.
          if (FILTERED_INTENTS.has(intent)) {
            if (BEGINNER_INTENTS.has(intent) && !cityRecord.hasBeginnerBeaches) continue;
            if (intent === "least-crowded" && !cityRecord.hasLeastCrowdedBeaches) continue;
          }

          // Dynamic priority based on beach count
          const priority = cityRecord.beachCount >= 10 ? 0.8 : 0.7;

          routes.push({
            url: `${baseUrl}/${intent}/${citySlug}`,
            lastModified: intentTemplateDate,
            changeFrequency: "daily" as const,
            priority: intent === "beginner" ? Math.min(0.85, priority + 0.05) : priority,
          });
        }
      }
    }
  } catch (error) {
    console.error("Sitemap: Failed to generate city intent routes", error);
  }

  // State-level intent pages for major US surf markets and territories.
  // This is a curated subset (not all coastal states) focusing on states/territories with
  // significant surf communities: CA, HI, FL (Tier 1), plus East Coast, PNW, TX (Tier 2), and PR (territory).
  //
  // Skill-based intents (beginner, longboard) are filtered per-state using the city data
  // already fetched above, preventing empty/thin pages from entering the sitemap.
  const usStates = ["ca", "or", "wa", "hi", "pr", "fl", "nj", "ny", "nc", "sc", "tx", "ma", "me", "nh", "ri", "ga"];
  for (const state of usStates) {
    for (const intent of intents) {
      // Skip skill-based and crowd-based intents for states with no matching beaches.
      if (FILTERED_INTENTS.has(intent)) {
        if (BEGINNER_INTENTS.has(intent) && !statesWithBeginnerBeaches.has(state)) continue;
        if (intent === "least-crowded" && !statesWithLeastCrowdedBeaches.has(state)) continue;
      }

      routes.push({
        url: `${baseUrl}/${intent}/${state}`,
        lastModified: intentTemplateDate,
        changeFrequency: "daily" as const,
        priority: 0.75,
      });
    }
  }

  return routes;
}

/**
 * Hub region guide pages.
 */
function getGuideRoutes(): MetadataRoute.Sitemap {
  // Use fixed date - guide pages change when content is updated
  const guidePageDate = "2026-01-15";

  return HUB_REGION_SLUGS.map((region) => ({
    url: `${baseUrl}/guides/surfing-${region}`,
    lastModified: guidePageDate,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));
}

/**
 * Forecast pages - hub landing page and regional forecast pages.
 */
function getForecastRoutes(): MetadataRoute.Sitemap {
  // Use fixed date - forecast pages are templated, data updates frequently but pages don't
  const forecastTemplateDate = "2026-02-10";

  const routes: MetadataRoute.Sitemap = [];

  // Forecast hub landing page
  routes.push({
    url: `${baseUrl}/forecast`,
    lastModified: forecastTemplateDate,
    changeFrequency: "daily" as const,
    priority: 0.9,
  });

  // Regional forecast pages (e.g., /forecast/southern-california)
  const regionSlugs = getAllForecastRegionSlugs();
  for (const slug of regionSlugs) {
    routes.push({
      url: `${baseUrl}/forecast/${slug}`,
      lastModified: forecastTemplateDate,
      changeFrequency: "daily" as const,
      priority: 0.8,
    });
  }

  return routes;
}

/**
 * Cam directory pages - hub and regional cam listings.
 */
function getCamRoutes(): MetadataRoute.Sitemap {
  const camPageDate = "2026-02-11";

  const routes: MetadataRoute.Sitemap = [];

  // Cam hub page
  routes.push({
    url: `${baseUrl}/cams`,
    lastModified: camPageDate,
    changeFrequency: "daily" as const,
    priority: 0.9,
  });

  // Regional cam pages (e.g., /cams/southern-california)
  const camRegionSlugs = getAllCamRegionSlugs();
  for (const slug of camRegionSlugs) {
    routes.push({
      url: `${baseUrl}/cams/${slug}`,
      lastModified: camPageDate,
      changeFrequency: "daily" as const,
      priority: 0.8,
    });
  }

  return routes;
}

/**
 * Best-time-to-surf city pages.
 * Only includes cities with >= 2 beaches that have best_months data.
 * The threshold was lowered from 3 to 2 to expand coverage to smaller high-quality markets.
 */
async function getBestTimeToSurfRoutes(): Promise<MetadataRoute.Sitemap> {
  const bestTimeDate = "2026-02-12";

  // Hub page
  const routes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/best-time-to-surf`,
      lastModified: bestTimeDate,
      changeFrequency: "monthly" as const,
      priority: 0.85,
    },
  ];

  try {
    const result = await getCitiesWithBestMonthsData();
    if (!result.success || !result.data) return routes;

    const collisionMap = COLLISION_CITY_MAP;
    const cityRoutes = result.data
      .map((c) => {
        const citySlug = buildCitySlug(c.city, c.state, collisionMap);
        if (!citySlug) return null;
        return {
          url: `${baseUrl}/best-time-to-surf/${citySlug}`,
          lastModified: bestTimeDate,
          changeFrequency: "monthly" as const,
          priority: 0.7,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    return [...routes, ...cityRoutes];
  } catch (error) {
    console.error("Sitemap: Failed to generate best-time-to-surf routes", error);
    return routes;
  }
}
