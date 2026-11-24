import type { MetadataRoute } from "next";

import { US_COUNTRY_SLUG } from "./geography";
import { loadRegionCounts } from "./hubs";
import { listTideStationSlugsForSitemap } from "./queries";
import { tideStationPath } from "./slug";

/**
 * Tide hubs and every active station. Empty before the registry migration is
 * applied; a query failure drops only these URLs, never the whole sitemap.
 * Stations whose predictions fail at render serve noindex; the sitemap lists
 * them anyway because one fetch per station here would cost ~7k NOAA calls.
 */
export async function getTideStationSitemapRoutes(baseUrl: string): Promise<MetadataRoute.Sitemap> {
  try {
    const [rows, slugs] = await Promise.all([loadRegionCounts(), listTideStationSlugsForSitemap()]);
    if (!rows || !slugs.length) return [];
    const hubPaths = new Set<string>(["/tides"]);
    for (const row of rows) {
      hubPaths.add(`/tides/${row.country_slug}`);
      if (row.country_slug === US_COUNTRY_SLUG && row.region_slug) {
        hubPaths.add(`/tides/${row.country_slug}/${row.region_slug}`);
      }
    }
    return [
      ...[...hubPaths].map((path) => ({ url: `${baseUrl}${path}` })),
      ...slugs.map((slug) => ({ url: `${baseUrl}${tideStationPath(slug)}` })),
    ];
  } catch (error) {
    console.error("Sitemap: tide station routes failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return [];
  }
}
