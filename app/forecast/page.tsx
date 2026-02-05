import { Metadata } from "next";
import Link from "next/link";
import { Calendar, MapPin, TrendingUp } from "lucide-react";

import {
  FORECAST_REGIONS,
  getAllForecastRegionSlugs,
  getGuideSlugForRegion,
  type ForecastRegion,
} from "@/lib/data/forecast-regions";
import { formatFullDateWithYear } from "@/lib/utils/time-formatters";
import {
  aggregateRegionalForecast,
  getBeachesForRegion,
  type RegionalForecastSummary,
} from "@/lib/utils/regional-forecast-utils";
import { getBatchFreshForecastsFromCache } from "@/lib/utils/forecast-service-utils";
import { getBeaches } from "@/actions/beach/beach-query-actions";
import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import {
  RegionalForecastCard,
  RegionalForecastCardGrid,
} from "@/components/forecast/regional-forecast-card";
import type { Beach } from "@/types/database";

// Force dynamic rendering - database calls use no-store fetch
export const dynamic = "force-dynamic";
export const revalidate = 3600; // Revalidate every hour for fresh forecasts

export const metadata: Metadata = buildPageMetadata({
  title: "Surf Forecast - 7 Day Regional Surf Conditions | Quiver",
  description:
    "Get the surf forecast for California, Hawaii, Puerto Rico and more. 7-day outlooks with best days, swell analysis, and beach-by-beach conditions.",
  path: "/forecast",
  keywords: [
    "surf forecast",
    "surf conditions",
    "7 day surf forecast",
    "regional surf forecast",
    "California surf forecast",
    "Hawaii surf forecast",
    "Puerto Rico surf forecast",
    "surf report",
  ],
});

/**
 * Get regional forecast summaries for all regions
 *
 * Fetches beaches for each region, retrieves cached forecasts in batches,
 * and aggregates into regional summaries.
 */
async function getRegionalSummaries(): Promise<
  Record<string, RegionalForecastSummary>
> {
  const regions = Object.values(FORECAST_REGIONS);
  const summaries: Record<string, RegionalForecastSummary> = {};

  // Fetch all beaches once
  const beachesResult = await getBeaches();
  if (!beachesResult.success || !beachesResult.data) {
    console.error("Failed to fetch beaches for forecast hub");
    return summaries;
  }

  const allBeaches = beachesResult.data;

  // Collect all beach IDs across all regions for batch fetch
  const allBeachIds = new Set<string>();
  const regionBeachesMap = new Map<string, Beach[]>();

  for (const region of regions) {
    const regionBeaches = getBeachesForRegion(region, allBeaches);
    regionBeachesMap.set(region.slug, regionBeaches);
    regionBeaches.forEach((beach) => allBeachIds.add(beach.id));
  }

  // Batch fetch all forecasts at once (2 queries total instead of N*2)
  const forecastMap = await getBatchFreshForecastsFromCache(
    Array.from(allBeachIds),
    168 // 7 days in hours
  );

  // Build summaries for each region
  for (const region of regions) {
    const regionBeaches = regionBeachesMap.get(region.slug) || [];

    // Filter forecast map to only this region's beaches
    const regionForecastMap = new Map();
    for (const beach of regionBeaches) {
      const result = forecastMap.get(beach.id);
      if (result && result.forecasts.length > 0) {
        regionForecastMap.set(beach.id, result.forecasts);
      }
    }

    // Aggregate into regional summary
    summaries[region.slug] = aggregateRegionalForecast(
      region,
      regionBeaches,
      regionForecastMap
    );
  }

  return summaries;
}

/**
 * Get the best region for today based on current conditions
 */
function getBestRegionToday(
  summaries: Record<string, RegionalForecastSummary>
): { region: ForecastRegion; summary: RegionalForecastSummary } | null {
  let bestRegion: ForecastRegion | null = null;
  let bestSummary: RegionalForecastSummary | null = null;
  let bestScore = 0;

  for (const [slug, summary] of Object.entries(summaries)) {
    // Use first day's score as "today" score
    const todayScore = summary.days[0]?.score || 0;

    if (todayScore > bestScore) {
      bestScore = todayScore;
      bestRegion = summary.region;
      bestSummary = summary;
    }
  }

  if (bestRegion && bestSummary) {
    return { region: bestRegion, summary: bestSummary };
  }

  return null;
}

/**
 * Forecast Hub Landing Page
 *
 * Main forecast index page linking to all regional forecasts.
 * Displays summary cards for each region with best days, wave heights,
 * and conditions quality.
 */
export default async function ForecastHubPage() {
  const summaries = await getRegionalSummaries();
  const regions = Object.values(FORECAST_REGIONS);
  const bestToday = getBestRegionToday(summaries);

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

  // Get today's date for display
  const today = new Date();
  const todayFormatted = formatFullDateWithYear(today);

  return (
    <div className="bg-white min-h-screen">
      {/* Structured Data */}
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: baseUrl },
          { name: "Surf Forecast", url: `${baseUrl}/forecast` },
        ]}
      />

      {/* JSON-LD for WebPage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Surf Forecast - 7 Day Regional Surf Conditions",
            description:
              "Get the surf forecast for California, Hawaii, Puerto Rico and more. 7-day outlooks with best days, swell analysis, and beach-by-beach conditions.",
            url: `${baseUrl}/forecast`,
            breadcrumb: {
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "Quiver",
                  item: baseUrl,
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: "Surf Forecast",
                  item: `${baseUrl}/forecast`,
                },
              ],
            },
            publisher: {
              "@type": "Organization",
              name: "Quiver Surf",
              url: baseUrl,
            },
          }),
        }}
      />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Hero Section */}
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Calendar className="h-4 w-4" />
            <time dateTime={today.toISOString()}>{todayFormatted}</time>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Surf Forecast
          </h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
            7-day forecasts for every region. Find the best waves, track swell
            events, and plan your sessions.
          </p>
        </header>

        {/* Best Today Section */}
        {bestToday && bestToday.summary.days[0] && (
          <section className="mb-12 bg-gradient-to-br from-sky-50 to-blue-50 rounded-xl p-6 border border-sky-200">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-sky-500 rounded-full flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Best Conditions Today
                </h2>
                <div className="flex flex-wrap items-center gap-4 text-gray-700">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-sky-600" />
                    <Link
                      href={`/forecast/${bestToday.region.slug}`}
                      className="font-medium hover:text-sky-600 hover:underline"
                    >
                      {bestToday.region.name}
                    </Link>
                  </div>
                  <span className="text-gray-400">•</span>
                  <span>
                    {Math.round(bestToday.summary.days[0].avgWaveHeight)}ft waves
                  </span>
                  <span className="text-gray-400">•</span>
                  <span>
                    Score: {bestToday.summary.days[0].score}/100
                  </span>
                  {bestToday.summary.upcomingSwells.length > 0 && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="text-blue-600 font-medium">
                        {bestToday.summary.upcomingSwells[0].size} swell incoming
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Regional Forecast Cards */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">
              Choose Your Region
            </h2>
            <p className="text-sm text-muted-foreground">
              {regions.length} regions available
            </p>
          </div>

          <RegionalForecastCardGrid>
            {regions.map((region) => (
              <RegionalForecastCard
                key={region.slug}
                region={region}
                summary={summaries[region.slug]}
              />
            ))}
          </RegionalForecastCardGrid>
        </section>

        {/* Cross-Links to Hub Guides */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            Regional Surf Guides
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {regions.map((region) => {
              const guideSlug = getGuideSlugForRegion(region.slug);

              return (
                <Link
                  key={region.slug}
                  href={`/guides/surfing-${guideSlug}`}
                  className="block p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors group"
                >
                  <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                    {region.name} Guide
                  </h3>
                  <p className="text-sm text-gray-600">
                    Explore surf spots, local knowledge, and conditions
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-slate-50 rounded-xl p-8 border border-slate-200 text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Get Personalized Forecast Alerts
          </h2>
          <p className="text-gray-700 mb-6 max-w-2xl mx-auto">
            Sign up to receive notifications when conditions are firing at your
            favorite spots. Never miss a good session again.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign Up for Free
          </Link>
        </section>
      </div>
    </div>
  );
}
