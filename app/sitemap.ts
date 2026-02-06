import type { MetadataRoute } from "next";

import { HUB_REGION_SLUGS } from "@/lib/data/hub-regions";
import { getAllForecastRegionSlugs } from "@/lib/data/forecast-regions";
import { getAllBeachLocations } from "@/actions/beach/beach-location-list-actions";
import { getBeaches } from "@/actions/beach/beach-query-actions";
import { getAllCitiesWithBeachSkills } from "@/actions/beach/beach-location-actions";
import {
  buildBeachUrl,
  cityToSlug,
  stateToSlug,
} from "@/lib/utils/beach-url-utils";
import { slugifyAscii } from "@/lib/utils/text-utils";
import {
  detectCityCollisions,
  buildCitySlug,
} from "@/lib/seo/city-slug-utils";

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
  const now = new Date();
  const lastmod = now.toISOString();

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
  ] = await Promise.all([
    Promise.resolve(getStaticRoutes(lastmod)),
    getBeachRoutes(lastmod),
    getLocationRoutes(lastmod),
    getIntentRoutes(lastmod),
    Promise.resolve(getGuideRoutes(lastmod)),
    Promise.resolve(getForecastRoutes(lastmod)),
  ]);

  return [
    ...staticRoutes,
    ...beachRoutes,
    ...locationRoutes,
    ...intentRoutes,
    ...guideRoutes,
    ...forecastRoutes,
  ];
}

// =============================================================================
// Route Generators
// =============================================================================

/**
 * Static pages - home, features, about, etc.
 */
function getStaticRoutes(lastmod: string): MetadataRoute.Sitemap {
  return [
    "/",
    "/features",
    "/about",
    "/privacy",
    "/map",
    "/beaches/usa",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: lastmod,
    changeFrequency: "daily",
    priority: route === "/" ? 1 : 0.7,
  }));
}

/**
 * Beach detail pages + beach-level intent pages (tides, water-temp).
 */
async function getBeachRoutes(lastmod: string): Promise<MetadataRoute.Sitemap> {
  const beachesResponse = await getBeaches();
  if (!beachesResponse.success || !beachesResponse.data) {
    console.error("Sitemap: Failed to fetch beaches");
    return [];
  }

  const beaches = beachesResponse.data;

  return beaches
    .filter((b) => b.slug) // Only include beaches with a slug
    .flatMap((beach) => {
      // Use hierarchical URL if we have complete location data
      const beachUrl = beach.city && beach.state
        ? `${baseUrl}${buildBeachUrl(beach)}`
        : `${baseUrl}/spots/${beach.slug}`;

      const lastModifiedDate =
        (beach as { updated_at?: string | null }).updated_at ||
        beach.created_at ||
        lastmod;

      // Main beach page
      const mainEntry = {
        url: beachUrl,
        lastModified: lastModifiedDate,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      };

      // Tide and water-temp intent pages (only for beaches with hierarchical URLs)
      if (beach.city && beach.state) {
        const tidesEntry = {
          url: `${beachUrl}/tides`,
          lastModified: lastModifiedDate,
          changeFrequency: "daily" as const,
          priority: 0.55,
        };
        const waterTempEntry = {
          url: `${beachUrl}/water-temp`,
          lastModified: lastModifiedDate,
          changeFrequency: "daily" as const,
          priority: 0.55,
        };
        return [mainEntry, tidesEntry, waterTempEntry];
      }

      return [mainEntry];
    });
}

/**
 * Location pages - city and state listing pages.
 */
async function getLocationRoutes(lastmod: string): Promise<MetadataRoute.Sitemap> {
  const response = await getAllBeachLocations();
  if (!response.success || !response.data) {
    console.error("Sitemap: Failed to load beach locations");
    return [];
  }

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
          lastModified: lastmod,
          changeFrequency: "weekly",
          priority: 0.75,
        },
        {
          url: `${baseUrl}/beaches/usa/hi/waimea-big-island`,
          lastModified: lastmod,
          changeFrequency: "weekly",
          priority: 0.75,
        }
      );
      continue;
    }

    if (isUsa) {
      const stateSlug = stateToSlug(location.state);
      const citySlug = slugifyAscii(location.city);
      if (stateSlug && citySlug) {
        usaStates.add(stateSlug);
        locationRoutes.push({
          url: `${baseUrl}/beaches/usa/${stateSlug}/${citySlug}`,
          lastModified: lastmod,
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
          lastModified: lastmod,
          changeFrequency: "weekly",
          priority: 0.75,
        });
      }
    }
  }

  // Add state-level pages
  const stateRoutes: MetadataRoute.Sitemap = [...usaStates].map((stateSlug) => ({
    url: `${baseUrl}/beaches/usa/${stateSlug}`,
    lastModified: lastmod,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...stateRoutes, ...locationRoutes];
}

/**
 * Intent pages - city and state level intent pages.
 *
 * IMPORTANT: Filters out skill-based intent pages (beginner, longboard, advanced)
 * for cities that don't have beaches matching those skill levels.
 * This prevents empty intent pages from being included in the sitemap.
 */
async function getIntentRoutes(lastmod: string): Promise<MetadataRoute.Sitemap> {
  // Skill-based intents that require cities to have matching beach skill levels
  const BEGINNER_INTENTS = new Set(["beginner", "longboard"]);
  const intents = ["beginner", "least-crowded", "tide", "water-temp", "longboard", "dawn-patrol", "sunset"];

  const routes: MetadataRoute.Sitemap = [];

  // City-level intent pages (database-driven)
  try {
    const citiesResult = await getAllCitiesWithBeachSkills(1);
    if (citiesResult.success && citiesResult.data) {
      // Filter to US-only cities (non-US cities lack state codes for disambiguation)
      const usCities = citiesResult.data.filter(
        (c) => c.country?.toUpperCase() === "USA" || c.country?.toUpperCase() === "US"
      );
      const collisionMap = detectCityCollisions(usCities);

      for (const cityRecord of usCities) {
        const citySlug = buildCitySlug(cityRecord.city, cityRecord.state, collisionMap);
        if (!citySlug) continue;

        for (const intent of intents) {
          // Filter skill-based intents to cities with matching beaches.
          // This ensures empty intent pages are NOT included in the sitemap.
          // Cities without beginner-friendly beaches skip beginner/longboard intents.
          if (BEGINNER_INTENTS.has(intent) && !cityRecord.hasBeginnerBeaches) continue;

          routes.push({
            url: `${baseUrl}/${intent}/${citySlug}`,
            lastModified: lastmod,
            changeFrequency: "daily" as const,
            priority: intent === "beginner" ? 0.85 : 0.8,
          });
        }
      }
    }
  } catch (error) {
    console.error("Sitemap: Failed to generate city intent routes", error);
  }

  // State-level intent pages for major US surf markets.
  // This is a curated subset (not all coastal states) focusing on states with
  // significant surf communities: CA, HI, FL (Tier 1), plus East Coast, PNW, TX (Tier 2).
  const usStates = ["ca", "or", "wa", "hi", "fl", "nj", "ny", "nc", "sc", "tx", "ma", "me", "nh", "ri", "ga"];
  for (const state of usStates) {
    for (const intent of intents) {
      routes.push({
        url: `${baseUrl}/${intent}/${state}`,
        lastModified: lastmod,
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
function getGuideRoutes(lastmod: string): MetadataRoute.Sitemap {
  return HUB_REGION_SLUGS.map((region) => ({
    url: `${baseUrl}/guides/surfing-${region}`,
    lastModified: lastmod,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));
}

/**
 * Forecast pages - hub landing page and regional forecast pages.
 */
function getForecastRoutes(lastmod: string): MetadataRoute.Sitemap {
  const routes: MetadataRoute.Sitemap = [];

  // Forecast hub landing page
  routes.push({
    url: `${baseUrl}/forecast`,
    lastModified: lastmod,
    changeFrequency: "daily" as const,
    priority: 0.9,
  });

  // Regional forecast pages (e.g., /forecast/southern-california)
  const regionSlugs = getAllForecastRegionSlugs();
  for (const slug of regionSlugs) {
    routes.push({
      url: `${baseUrl}/forecast/${slug}`,
      lastModified: lastmod,
      changeFrequency: "daily" as const,
      priority: 0.8,
    });
  }

  return routes;
}
