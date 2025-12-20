import type { MetadataRoute } from "next";

import {
  SURF_CITY_SLUGS,
  getCityBySlug,
} from "@/lib/data/surf-spots";
import { getAllBeachLocations } from "@/actions/beach/beach-location-list-actions";
import { getBeaches } from "@/actions/beach/beach-query-actions";
import {
  buildBeachUrl,
  buildCityUrl,
  buildInternationalCityUrl,
} from "@/lib/utils/beach-url-utils";

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
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: lastmod,
    changeFrequency: "daily",
    priority: route === "/" ? 1 : 0.7,
  }));

  const cityRoutes: MetadataRoute.Sitemap = SURF_CITY_SLUGS.map((slug) => {
    const city = getCityBySlug(slug)!;
    // All curated cities are in California - use canonical short URL (/ca/{city})
    const cityUrl = buildCityUrl("CA", city.name);
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

  // Location pages (AllTrails-style beach listings by city)
  let locationRoutes: MetadataRoute.Sitemap = [];
  try {
    const response = await getAllBeachLocations();
    if (response.success && response.data) {
      locationRoutes = response.data.map((location) => {
        // Canonical city URL:
        // - USA:  /{state}/{city}
        // - Intl: /{country}/{state}/{city}
        const isUsa =
          !location.country ||
          String(location.country).toLowerCase() === "usa" ||
          String(location.country).toLowerCase() === "us";
        const locationUrl = isUsa
          ? buildCityUrl(location.state, location.city)
          : buildInternationalCityUrl(
              location.country,
              location.state,
              location.city
            );
        return {
          url: `${baseUrl}${locationUrl}`,
          lastModified: lastmod,
          changeFrequency: "weekly",
          priority: 0.75, // High priority for location pages
        };
      });
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

  return [
    ...staticRoutes,
    ...cityRoutes,
    ...intentRoutes,
    ...locationRoutes,
    ...beachEntries,
  ];
}
