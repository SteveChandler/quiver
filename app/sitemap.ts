import type { MetadataRoute } from "next";

import { HUB_REGION_SLUGS } from "@/lib/data/hub-regions";
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

export const dynamic = "force-dynamic";

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

  // Generate intent routes for cities with at least 1 beach (database-driven)
  // Skill-based intents (beginner/longboard/advanced) are only included for cities
  // that have beaches matching those skill levels, to avoid thin-content URLs.
  const BEGINNER_INTENTS = new Set(["beginner", "longboard"]);
  const ADVANCED_INTENTS = new Set(["advanced"]);

  let dynamicIntentRoutes: MetadataRoute.Sitemap = [];
  try {
    const citiesResult = await getAllCitiesWithBeachSkills(1);
    if (citiesResult.success && citiesResult.data) {
      // Filter to US-only cities for intent pages (non-US cities lack state codes for disambiguation)
      const usCities = citiesResult.data.filter(
        (c) => c.country?.toUpperCase() === "USA" || c.country?.toUpperCase() === "US"
      );
      const collisionMap = detectCityCollisions(usCities);
      const intents = ["beginner", "least-crowded", "tide", "water-temp", "longboard", "dawn-patrol", "sunset"];

      dynamicIntentRoutes = usCities.flatMap((cityRecord) => {
        const citySlug = buildCitySlug(cityRecord.city, cityRecord.state, collisionMap);
        if (!citySlug) return [];

        // Filter skill-based intents to cities with matching beaches
        const applicableIntents = intents.filter((intent) => {
          if (BEGINNER_INTENTS.has(intent)) return cityRecord.hasBeginnerBeaches;
          if (ADVANCED_INTENTS.has(intent)) return cityRecord.hasAdvancedBeaches;
          return true; // Non-skill intents always included
        });

        return applicableIntents.map((intent) => ({
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
    ["beginner", "least-crowded", "tide", "water-temp", "longboard", "dawn-patrol", "sunset"].map((intent) => ({
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

    // Generate canonical URLs for beaches:
    // - Hierarchical URL for beaches with complete data (slug + city + state)
    // - /spots/{slug} fallback for beaches missing city or state
    beachEntries = beaches
      .filter((b) => b.slug) // Only include beaches with a slug
      .map((beach) => {
        // Use hierarchical URL if we have complete location data (matches redirect logic in /spots/[slug])
        const url = beach.city && beach.state
          ? `${baseUrl}${buildBeachUrl(beach)}`
          : `${baseUrl}/spots/${beach.slug}`;

        return {
          url,
          // Prefer updated_at when present so the sitemap reflects freshness.
          lastModified:
            // getBeaches() selects a subset; treat updated_at as optional.
            (beach as { updated_at?: string | null }).updated_at ||
            beach.created_at ||
            lastmod,
          changeFrequency: "weekly" as const,
          priority: 0.6,
        };
      });
  }

  return [
    ...staticRoutes,
    ...dynamicIntentRoutes,
    ...stateIntentRoutes,
    ...hubRoutes,
    ...usaStateRoutes,
    ...locationRoutes,
    ...beachEntries,
  ];
}
