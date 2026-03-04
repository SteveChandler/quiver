import { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import { Calendar, ArrowLeft, MapPin } from "lucide-react";

import { getBeachById } from "@/actions/beach/beach-query-actions";
import { buildBeachUrlWithTab } from "@/lib/utils/beach-url-utils";
import {
  FORECAST_REGIONS,
  getForecastRegion,
  getAllForecastRegionSlugs,
  getGuideSlugForRegion,
  hasHubGuide,
} from "@/lib/data/forecast-regions";
import { formatFullDateWithYear } from "@/lib/utils/time-formatters";
import {
  aggregateRegionalForecast,
  getBeachesForRegion,
} from "@/lib/utils/regional-forecast-utils";
import { getBatchFreshForecastsFromCache } from "@/lib/utils/forecast-service-utils";
import { getBeaches } from "@/actions/beach/beach-query-actions";
import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import {
  BestDaysSection,
  SwellEventList,
  BeachConditionsGrid,
  AnimatedScoreGauge,
} from "@/components/forecast";
import { OceanBackground } from "@/components/ui/ocean-background";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";
import { WebPageSchema } from "@/components/seo/web-page-schema";

// Force dynamic rendering - database calls use no-store fetch
// Note: revalidate is not used with force-dynamic; caching is handled by the database layer
export const dynamic = "force-dynamic";
// Allow dynamic params for beach UUIDs (not pre-rendered)
export const dynamicParams = true;

/**
 * Generate static paths for all forecast regions
 * Beach IDs are dynamic and not pre-rendered
 */
export async function generateStaticParams() {
  return getAllForecastRegionSlugs().map((slug) => ({
    beachId: slug,
  }));
}

/**
 * Generate metadata for both regional forecasts and beach redirects
 */
export async function generateMetadata(props: {
  params: Promise<{ beachId: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const region = getForecastRegion(params.beachId);

  // If this is a regional forecast, return region metadata
  if (region) {
    return buildPageMetadata({
      title: region.title,
      description: region.metaDescription,
      path: `/forecast/${region.slug}`,
      keywords: [
        `${region.name} surf forecast`,
        `${region.name} surf conditions`,
        `${region.name} 7 day forecast`,
        "surf forecast",
        "surf report",
        "wave forecast",
      ],
    });
  }

  // For beach IDs, return minimal metadata (they redirect anyway)
  return {};
}

/**
 * Unified Forecast Page
 *
 * Handles two cases:
 * 1. Regional forecast slugs (e.g., "san-diego", "orange-county") - displays full regional forecast
 * 2. Beach UUIDs - redirects to canonical beach detail page with Forecast tab (deprecated)
 */
export default async function ForecastPage(props: {
  params: Promise<{ beachId: string }>;
}) {
  const params = await props.params;
  const { beachId } = params;

  // Check if this is a regional forecast slug
  const region = getForecastRegion(beachId);

  if (region) {
    // This is a regional forecast - render the full regional forecast page
    return renderRegionalForecast(region);
  }

  // Otherwise, treat as a beach ID (UUID) and redirect to canonical beach page
  const result = await getBeachById(beachId);

  if (!result.success || !result.data) {
    notFound();
  }

  const beach = result.data;
  const canonicalUrl = buildBeachUrlWithTab(beach, "forecast");

  // Redirect to canonical beach page with Forecast tab
  permanentRedirect(canonicalUrl);
}

/**
 * Render Regional Forecast Page
 *
 * Detailed 7-day surf forecast for a specific region.
 * Enhanced with ocean background, animated gauges, and scroll reveals.
 */
async function renderRegionalForecast(region: typeof FORECAST_REGIONS[string]) {
  // Fetch all beaches once
  const beachesResult = await getBeaches();
  if (!beachesResult.success || !beachesResult.data) {
    console.error("Failed to fetch beaches for regional forecast");
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Unable to Load Forecast
        </h1>
        <p className="text-gray-600">
          We&apos;re experiencing issues loading forecast data. Please try again
          later.
        </p>
        <Link
          href="/forecast"
          className="text-blue-600 hover:underline mt-4 inline-block"
        >
          &larr; Back to Forecast Hub
        </Link>
      </div>
    );
  }

  // Filter beaches for this region
  const beaches = getBeachesForRegion(region, beachesResult.data);

  if (beaches.length === 0) {
    console.error(`No beaches found for region: ${region.slug}`);
    return notFound();
  }

  // Fetch forecasts for all beaches in the region (batch fetch for performance)
  const beachIds = beaches.map((b) => b.id);
  const forecastMap = await getBatchFreshForecastsFromCache(
    beachIds,
    168 // 7 days in hours
  );

  // Build regional forecast map from batch results
  const regionForecastMap = new Map();
  for (const beach of beaches) {
    const result = forecastMap.get(beach.id);
    if (result && result.forecasts.length > 0) {
      regionForecastMap.set(beach.id, result.forecasts);
    }
  }

  // Aggregate into regional summary
  const summary = aggregateRegionalForecast(
    region,
    beaches,
    regionForecastMap
  );

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

  // Format dates for display
  const today = new Date();
  const todayFormatted = formatFullDateWithYear(today);

  // Map region slug to guide slug (some regions share guides)
  const guideSlug = getGuideSlugForRegion(region.slug);
  const showGuideLink = hasHubGuide(region.slug);

  return (
    <OceanBackground variant="ocean" showWaves animated={false}>
      {/* Structured Data */}
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: baseUrl },
          { name: "Surf Forecast", url: `${baseUrl}/forecast` },
          {
            name: region.name,
            url: `${baseUrl}/forecast/${region.slug}`,
          },
        ]}
      />

      {/* JSON-LD for WebPage */}
      <WebPageSchema
        name={region.title}
        url={`${baseUrl}/forecast/${region.slug}`}
        description={region.metaDescription}
        additionalData={{
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
              {
                "@type": "ListItem",
                position: 3,
                name: region.name,
                item: `${baseUrl}/forecast/${region.slug}`,
              },
            ],
          },
          publisher: {
            "@type": "Organization",
            name: "Quiver Surf",
            url: baseUrl,
          },
          datePublished: today.toISOString(),
        }}
      />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Breadcrumb Navigation */}
        <ScrollReveal variant="fadeIn">
          <nav className="mb-6">
            <Link
              href="/forecast"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              All Forecasts
            </Link>
          </nav>
        </ScrollReveal>

        {/* Hero Section */}
        <ScrollReveal variant="fadeUp" delay={50}>
          <header className="mb-12">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Calendar className="h-4 w-4" />
              <time dateTime={today.toISOString()}>{todayFormatted}</time>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-4">
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-2">
                  {region.name} Surf Forecast
                </h1>
                <p className="text-lg text-gray-600">
                  7-day outlook | Updated hourly
                </p>
              </div>

              {/* Regional Score Gauge */}
              {summary.stats.avgRegionScore > 0 && (
                <div className="flex items-center gap-4">
                  <AnimatedScoreGauge
                    score={summary.stats.avgRegionScore}
                    size="lg"
                    showLabel
                  />
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-blue-500" />
                <span>
                  <AnimatedCounter
                    value={summary.stats.beachesWithData}
                    duration={400}
                  />{" "}
                  of{" "}
                  <AnimatedCounter
                    value={summary.stats.totalBeaches}
                    duration={400}
                  />{" "}
                  beaches with data
                </span>
              </div>
              {summary.upcomingSwells.length > 0 && (
                <>
                  <span className="text-gray-400">|</span>
                  <span className="text-blue-600 font-medium animate-pulse">
                    {summary.upcomingSwells.length} swell
                    {summary.upcomingSwells.length !== 1 ? "s" : ""} incoming
                  </span>
                </>
              )}
            </div>
          </header>
        </ScrollReveal>

        {/* Best Days Section */}
        <BestDaysSection
          days={summary.days}
          bestDay={summary.bestDay}
          regionName={region.name}
          className="mb-16"
        />

        {/* Upcoming Swells Section */}
        {summary.upcomingSwells.length > 0 && (
          <ScrollReveal variant="fadeUp" delay={100}>
            <section className="mb-16">
              <SwellEventList
                events={summary.upcomingSwells}
                title="Upcoming Swells"
              />
            </section>
          </ScrollReveal>
        )}

        {/* Beach Conditions Grid */}
        <BeachConditionsGrid
          beaches={summary.beachConditions}
          regionSlug={region.slug}
          maxBeaches={12}
          showViewAll={true}
          className="mb-16"
        />

        {/* Cross-Links Section */}
        <ScrollReveal variant="fadeUp" delay={200}>
          <section className="mb-16 bg-gradient-to-br from-slate-50 to-gray-50 dark:from-[#0F1A2E] dark:to-[#111D35] rounded-xl p-8 border border-slate-200 dark:border-[#1E2D4A]">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
              Explore More
            </h2>
            <div className={`grid ${showGuideLink ? "md:grid-cols-2" : ""} gap-4`}>
              {/* Link to Regional Guide - only if hub guide exists */}
              {showGuideLink && (
                <Link
                  href={`/guides/surfing-${guideSlug}`}
                  className="block p-6 rounded-lg border border-gray-200 dark:border-[#1E2D4A] bg-white dark:bg-[#111D35] hover:border-blue-500 hover:bg-gradient-to-br hover:from-sky-50/50 hover:to-blue-50/30 dark:hover:from-[#172544]/50 dark:hover:to-[#1E2D4A]/30 transition-all duration-200 group"
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-blue-600 transition-colors">
                    {region.name} Surf Guide
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Explore surf spots, local knowledge, and conditions across{" "}
                    {region.name}
                  </p>
                  <span className="text-sm font-medium text-blue-600 group-hover:underline">
                    View Guide &rarr;
                  </span>
                </Link>
              )}

              {/* Link back to Forecast Hub */}
              <Link
                href="/forecast"
                className="block p-6 rounded-lg border border-gray-200 dark:border-[#1E2D4A] bg-white dark:bg-[#111D35] hover:border-blue-500 hover:bg-gradient-to-br hover:from-sky-50/50 hover:to-blue-50/30 dark:hover:from-[#172544]/50 dark:hover:to-[#1E2D4A]/30 transition-all duration-200 group"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-blue-600 transition-colors">
                  Other Regional Forecasts
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Compare conditions across all regions and find the best waves
                </p>
                <span className="text-sm font-medium text-blue-600 group-hover:underline">
                  View All Forecasts &rarr;
                </span>
              </Link>
            </div>
          </section>
        </ScrollReveal>

        {/* CTA Section */}
        <ScrollReveal variant="scale" delay={300}>
          <section className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-8 text-center text-white relative overflow-hidden">
            {/* Decorative wave pattern */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <svg
                className="absolute bottom-0 left-0 w-full h-24"
                viewBox="0 0 1440 96"
                preserveAspectRatio="none"
              >
                <path
                  d="M0,48 Q360,96 720,48 T1440,48 L1440,96 L0,96 Z"
                  fill="currentColor"
                />
              </svg>
            </div>

            <div className="relative z-10">
              <h2 className="text-2xl font-semibold mb-4">
                Unlock {region.name} Insights
              </h2>
              <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
                Sign up to log sessions at {region.name} breaks and get
                personalized spot recommendations.
              </p>
              <Link
                href="/auth/sign-up"
                className="inline-flex items-center justify-center px-6 py-3 bg-white text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors"
              >
                Sign Up for Free
              </Link>
            </div>
          </section>
        </ScrollReveal>
      </div>

      {/* Mobile Sticky Signup Bar */}
      <StickySignupBar source={`forecast-${region.slug}`} />
    </OceanBackground>
  );
}
