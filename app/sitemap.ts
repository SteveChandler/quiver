import type { MetadataRoute } from "next";

import {
  SURF_CITY_SLUGS,
  getCityBySlug,
} from "@/lib/data/surf-spots";
import { HUB_REGION_SLUGS } from "@/lib/data/hub-regions";
import { getAllBeachLocations } from "@/actions/beach/beach-location-list-actions";
import { getBeaches } from "@/actions/beach/beach-query-actions";
import { getAllCitiesWithBeaches } from "@/actions/beach/beach-location-actions";
import {
  buildBeachUrl,
  cityToSlug,
  stateToSlug,
} from "@/lib/utils/beach-url-utils";
import { slugifyAscii } from "@/lib/utils/text-utils";

const baseUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
).replace(/\/$/, "");

export const dynamic = "force-dynamic" as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const lastmod = now.toISOString();

  const staticRoutes: MetadataRoute.Sitemap = [
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

  const cityRoutes: MetadataRoute.Sitemap = SURF_CITY_SLUGS.map((slug) => {
    const city = getCityBySlug(slug)!;
    // All curated cities are in California - canonical listing URL is /beaches/usa/ca/{city}
    const cityUrl = `/beaches/usa/ca/${slugifyAscii(city.name)}`;
    return {
      url: `${baseUrl}${cityUrl}`,
      lastModified: lastmod,
      changeFrequency: "daily",
      priority: 0.9,
    };
  });

  const intentRoutes: MetadataRoute.Sitemap = SURF_CITY_SLUGS.flatMap(
    (citySlug) => {
      const city = getCityBySlug(citySlug);
      if (!city) return [];
      return city.featuredIntents.map((intent) => ({
        url: `${baseUrl}/${intent}/${city.slug}`,
        lastModified: lastmod,
        changeFrequency: "daily",
        priority: intent === "beginner" ? 0.85 : 0.8,
      }));
    }
  );

  // Generate intent routes for ALL cities with 3+ beaches
  let dynamicIntentRoutes: MetadataRoute.Sitemap = [];
  try {
    const citiesResult = await getAllCitiesWithBeaches(3);
    if (citiesResult.success && citiesResult.data) {
      const intents = ["beginner", "least-crowded", "tide", "water-temp"];

      dynamicIntentRoutes = citiesResult.data.flatMap((city) => {
        const citySlug = slugifyAscii(city.city);
        if (!citySlug) return [];

        return intents.map((intent) => ({
          url: `${baseUrl}/${intent}/${citySlug}`,
          lastModified: lastmod,
          changeFrequency: "daily" as const,
          priority: intent === "beginner" ? 0.85 : 0.8,
        }));
      });
    }
  } catch (error) {
    console.error("Sitemap: Failed to generate dynamic intent routes", error);
  }

  // State-level intent routes for major surf states
  const usStates = ["ca", "or", "wa", "hi", "fl", "nj", "ny", "nc", "sc", "tx"];
  const stateIntentRoutes: MetadataRoute.Sitemap = usStates.flatMap((state) =>
    ["beginner", "least-crowded", "tide", "water-temp"].map((intent) => ({
      url: `${baseUrl}/${intent}/${state}`,
      lastModified: lastmod,
      changeFrequency: "daily" as const,
      priority: 0.75,
    }))
  );

  // Hub region routes (e.g., /guides/surfing-southern-california)
  const hubRoutes: MetadataRoute.Sitemap = HUB_REGION_SLUGS.map((region) => ({
    url: `${baseUrl}/guides/surfing-${region}`,
    lastModified: lastmod,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  // Location pages (AllTrails-style beach listings by city)
  let locationRoutes: MetadataRoute.Sitemap = [];
  let usaStateRoutes: MetadataRoute.Sitemap = [];
  try {
    const response = await getAllBeachLocations();
    if (response.success && response.data) {
      // Build a state index (USA-only) under /beaches/usa/{state}
      const usaStates = new Set<string>();

      locationRoutes = response.data.flatMap((location) => {
        // Canonical city URL:
        // - USA:  /beaches/usa/{state}/{city}
        // - Intl: /beaches/{country}/{state}/{city}
        const isUsa =
          !location.country ||
          String(location.country).toLowerCase() === "usa" ||
          String(location.country).toLowerCase() === "us";

        // HI: replace ambiguous Waimea city URL with island-specific pages.
        if (
          isUsa &&
          stateToSlug(location.state) === "hi" &&
          cityToSlug(location.city) === "waimea"
        ) {
          usaStates.add("hi");
          return [
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
            },
          ];
        }

        const locationUrl = isUsa
          ? (() => {
              const stateSlug = stateToSlug(location.state);
              const citySlug = slugifyAscii(location.city);
              if (!stateSlug || !citySlug) return "/";
              usaStates.add(stateSlug);
              return `/beaches/usa/${stateSlug}/${citySlug}`;
            })()
          : (() => {
              const countrySlug = slugifyAscii(location.country);
              const regionSlug = slugifyAscii(location.state);
              const citySlug = slugifyAscii(location.city);
              if (!countrySlug || !regionSlug || !citySlug) return "/";
              return `/beaches/${countrySlug}/${regionSlug}/${citySlug}`;
            })();

        return [
          {
            url: `${baseUrl}${locationUrl}`,
            lastModified: lastmod,
            changeFrequency: "weekly",
            priority: 0.75, // High priority for location pages
          },
        ];
      });

      usaStateRoutes = [...usaStates].map((stateSlug) => ({
        url: `${baseUrl}/beaches/usa/${stateSlug}`,
        lastModified: lastmod,
        changeFrequency: "weekly",
        priority: 0.7,
      }));
    }
  } catch (error) {
    console.error("Sitemap: Failed to load beach locations", error);
    // Fail silently; return empty location routes
  }

  // Dynamic beaches and forecasts
  let beachEntries: MetadataRoute.Sitemap = [];
  
  // Use direct DB call instead of fetch to avoid self-request issues
  const beachesResponse = await getBeaches();
  if (beachesResponse.success && beachesResponse.data) {
    const beaches = beachesResponse.data;

    // Generate hierarchical URLs for beaches
    beachEntries = beaches
      .filter((b) => b.slug && b.city && b.state) // Only include beaches with complete URL data
      .map((beach) => ({
        url: `${baseUrl}${buildBeachUrl(beach)}`,
        // Prefer updated_at when present so the sitemap reflects freshness.
        lastModified:
          // getBeaches() selects a subset; treat updated_at as optional.
          (beach as { updated_at?: string | null }).updated_at ||
          beach.created_at ||
          lastmod,
        changeFrequency: "weekly",
        priority: 0.6,
      }));
  }

  // Deduplicate URLs: intentRoutes (curated cities) take precedence over dynamicIntentRoutes
  const intentUrls = new Set(intentRoutes.map((route) => route.url));
  const deduplicatedDynamicIntentRoutes = dynamicIntentRoutes.filter(
    (route) => !intentUrls.has(route.url)
  );

  return [
    ...staticRoutes,
    ...cityRoutes,
    ...intentRoutes,
    ...deduplicatedDynamicIntentRoutes,
    ...stateIntentRoutes,
    ...hubRoutes,
    ...usaStateRoutes,
    ...locationRoutes,
    ...beachEntries,
  ];
}
