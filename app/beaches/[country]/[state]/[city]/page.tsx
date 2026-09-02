/**
 * Location Listing Page
 *
 * Displays all beaches in a specific city/state/country with ranking.
 * Example URLs:
 * - /beaches/usa/ca/la-jolla-san-diego
 * - /beaches/usa/ca/newport-beach
 * - /beaches/mexico/baja-california/rosarito
 *
 * Delegates rendering to EditorialLayout (curated cities) or
 * StandardLayout (data-driven cities).
 */

import { notFound, redirect } from "next/navigation";
import {
  getLocationPageData,
} from "@/actions/beach/beach-location-list-actions";
import {
  parseLocationFromSlug,
} from "@/lib/utils/location-slug";
import {
  getBeachHrefSafe,
  isValidCountrySlug,
} from "@/lib/utils/beach-url-utils";
import { getCityEditorialContent } from "@/actions/city/city-editorial-actions";
import { getTopCitiesInState } from "@/actions/beach/beach-location-actions";
import { getCitySurfReport } from "@/actions/city/city-conditions-actions";
import { buildLocationPlaceStructuredData } from "@/lib/seo/location-structured-data";
import { getBestTimeToSurfUrl } from "@/lib/utils/best-time-to-surf-utils";
import {
  SITE_ORIGIN,
  resolveDisplayCityName,
  resolveMetroConfig,
  buildItemListItems,
} from "./city-page-utils";
import type { LocationPageProps } from "./city-page-utils";
import { EditorialLayout } from "./editorial-layout";
import { StandardLayout } from "./standard-layout";

// Re-export Next.js named exports from extracted modules
export { generateMetadata } from "./city-page-metadata";
// NOTE: generateStaticParams removed — pages are rendered on-demand via ISR.

export default async function LocationPage(props: LocationPageProps) {
  const params = await props.params;
  // Validate country parameter - reject non-country values like "beginner", "sunset", etc.
  if (!isValidCountrySlug(params.country)) {
    notFound();
  }

  // Fetch location page data
  const response = await getLocationPageData(
    params.city,
    params.state,
    params.country
  );

  if (!response.success || !response.data) {
    if (response.error === "CITY_EXISTS_NO_DATA") {
      const cityName = parseLocationFromSlug(params.city);
      redirect(`/map?search=${encodeURIComponent(cityName)}`);
    }
    notFound();
  }

  const { location, stats, beaches } = response.data;

  const displayCityName = resolveDisplayCityName(
    location.city,
    params.state,
    params.city
  );

  const metroConfig = resolveMetroConfig(params.city);

  // Fetch editorial content, best time to surf URL, sibling cities, and surf report
  const [editorial, bestTimeToSurfUrl, siblingCities, surfReport] = await Promise.all([
    getCityEditorialContent(params.city, params.state, params.country),
    getBestTimeToSurfUrl(params.city, location.city, location.state),
    params.country === "usa" ? getTopCitiesInState(params.state, 10) : Promise.resolve([]),
    params.country === "usa"
      ? getCitySurfReport(location.city, params.state)
      : Promise.resolve(null),
  ]);

  // JSON-LD structured data for SEO
  const jsonLd = buildLocationPlaceStructuredData({
    city: location.city,
    state: location.state,
    topBeaches: beaches.slice(0, 5).flatMap((beach) => {
      const href = getBeachHrefSafe(beach);
      if (!href) return [];
      return [{ name: beach.name, url: `${SITE_ORIGIN}${href}` }];
    }),
  });

  const itemListItems = buildItemListItems(beaches);

  if (editorial) {
    return (
      <EditorialLayout
        params={params}
        displayCityName={displayCityName}
        stats={stats}
        beaches={beaches}
        editorial={editorial}
        jsonLd={jsonLd}
        itemListItems={itemListItems}
        bestTimeToSurfUrl={bestTimeToSurfUrl}
        siblingCities={siblingCities}
        surfReport={surfReport}
      />
    );
  }

  return (
    <StandardLayout
      params={params}
      displayCityName={displayCityName}
      stats={stats}
      location={location}
      beaches={beaches}
      metroConfig={metroConfig}
      jsonLd={jsonLd}
      itemListItems={itemListItems}
      bestTimeToSurfUrl={bestTimeToSurfUrl}
      siblingCities={siblingCities}
      surfReport={surfReport}
    />
  );
}

// Force static rendering. These routes read Supabase through the cookie-free
// public client, whose fetch is cache: "no-store"; without force-static that
// single uncached fetch opts the whole route into dynamic rendering, so Vercel
// served it with private/no-store on every request (measured 2026-09-01:
// x-vercel-cache MISS, TTFB 1.2-4.9s) instead of the hourly ISR page.
export const dynamic = "force-static";
export const revalidate = 3600;
