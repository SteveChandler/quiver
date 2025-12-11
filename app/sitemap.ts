import type { MetadataRoute } from "next";

import {
  SURF_CITY_SLUGS,
  getCityBySlug,
} from "@/lib/data/surf-spots";
import { getAllBeachLocations } from "@/actions/beach/beach-location-list-actions";
import { getBeaches } from "@/actions/beach/beach-query-actions";
import { buildLocationUrl } from "@/lib/utils/location-slug";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";

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
    // All curated cities are in California - using buildLocationUrl for consistency
    const cityUrl = buildLocationUrl(city.name, 'CA', 'USA');
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
        const locationUrl = buildLocationUrl(
          location.city,
          location.state,
          location.country
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
  let forecastEntries: MetadataRoute.Sitemap = [];
  
  // Use direct DB call instead of fetch to avoid self-request issues
  const beachesResponse = await getBeaches();
  if (beachesResponse.success && beachesResponse.data) {
    const beaches = beachesResponse.data;

    // Generate hierarchical URLs for beaches
    beachEntries = beaches
      .filter((b) => b.slug && b.city && b.state) // Only include beaches with complete URL data
      .map((beach) => ({
        url: `${baseUrl}${buildBeachUrl(beach)}`,
        lastModified: beach.created_at || lastmod,
        changeFrequency: "weekly",
        priority: 0.6,
      }));

    // Add forecast pages for each beach (still using ID for now)
    forecastEntries = beaches.map((b) => ({
      url: `${baseUrl}/forecast/${b.id}`,
      lastModified: lastmod, // Use current date for forecasts as they update frequently
      changeFrequency: "daily",
      priority: 0.8, // High priority for forecast pages
    }));
  }

  return [
    ...staticRoutes,
    ...cityRoutes,
    ...intentRoutes,
    ...locationRoutes,
    ...beachEntries,
    ...forecastEntries,
  ];
}
