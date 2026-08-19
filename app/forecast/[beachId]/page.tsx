import { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import { Calendar, ArrowLeft, MapPin } from "lucide-react";

import { getBeachById } from "@/actions/beach/beach-query-actions";
import { buildBeachUrlWithTab } from "@/lib/utils/beach-url-utils";
import {
  FORECAST_REGIONS,
  getForecastRegion,
  getGuideSlugForRegion,
  hasHubGuide,
} from "@/lib/data/forecast-regions";
import { formatFullDateWithYear } from "@/lib/utils/date-time";
import { getRegionalSummary } from "@/lib/utils/forecast-hub-utils";
import { getBeachesForRegion } from "@/lib/utils/regional-forecast-utils";
import { getStaticMapImageUrl } from "@/lib/map-utils";
import { getCurrentUser } from "@/lib/auth/admin";
import { getBeaches } from "@/actions/beach/beach-query-actions";
import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import {
  BestDaysSection,
  SwellEventList,
  BeachConditionsGrid,
  TopRankedBeachHero,
} from "@/components/forecast";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { QuiverSticker, ZineSurface } from "@/components/zine";

// Force dynamic rendering — this page fetches live forecast data via service-role
// client (no-store), which is incompatible with static/ISR rendering in Next.js 16.
export const dynamic = "force-dynamic";
// Allow dynamic params for beach UUIDs (not pre-rendered)
export const dynamicParams = true;

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
  const user = await getCurrentUser();
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

  const beaches = getBeachesForRegion(region, beachesResult.data);
  if (beaches.length === 0) {
    console.error(`No beaches found for region: ${region.slug}`);
    return notFound();
  }

  // Reuse the summary pipeline so the top-ranked beach and its approved photo
  // are selected from the same live ranking used by the forecast hub.
  const summary = await getRegionalSummary(region, beaches, {
    includeBestSurfWindows: true,
  });
  const topBeach = summary.beachConditions[0] ?? null;
  const topBeachRecord = topBeach
    ? beaches.find((beach) => beach.id === topBeach.beachId)
    : null;
  const approvedTopBeachImage =
    topBeach && summary.photoBeachName === topBeach.beachName
      ? summary.photoUrl
      : null;
  const fallbackMapUrl =
    !approvedTopBeachImage && topBeachRecord
      ? getStaticMapImageUrl(topBeachRecord.lat, topBeachRecord.lon, {
          style: "mapbox/satellite-streets-v12",
          width: 960,
          height: 540,
          zoom: 13,
        })
      : null;
  const satelliteFallbackUrl = fallbackMapUrl?.startsWith("https://")
    ? fallbackMapUrl
    : null;

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

  // Format dates for display
  const today = new Date();
  const todayFormatted = formatFullDateWithYear(today);

  // Map region slug to guide slug (some regions share guides)
  const guideSlug = getGuideSlugForRegion(region.slug);
  const showGuideLink = hasHubGuide(region.slug);

  return (
    <>
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

      <ZineSurface
        sectionLabel="Regional Forecast"
        editionLabel="Updated hourly"
        data-testid="forecast-zine-surface"
      >
        <main>
          <ScrollReveal variant="fadeIn">
            <nav className="mb-8">
              <Link
                href="/forecast"
                className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#11100D]/62 transition-colors hover:text-[#B56A2B] hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                All Forecasts
              </Link>
            </nav>
          </ScrollReveal>

          <ScrollReveal variant="fadeUp" delay={50}>
            <header className="relative mb-12 grid gap-8 lg:grid-cols-1">
              <QuiverSticker
                sticker="creamCoastMap"
                className="absolute -right-4 -top-6 hidden w-36 rotate-6 opacity-80 lg:block"
              />
              <div>
                <div className="mb-4 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-[#11100D]/62">
                  <Calendar className="h-4 w-4" />
                  <time dateTime={today.toISOString()}>{todayFormatted}</time>
                </div>

                <h1 className="zine-h1 font-black uppercase leading-[0.88] tracking-normal text-[#11100D]">
                  {region.name} Surf Forecast
                </h1>
                <p className="mt-5 text-xl leading-relaxed text-[#11100D]/70">
                  7-day outlook | Updated hourly
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-4 font-mono text-xs uppercase tracking-[0.12em] text-[#11100D]/65">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-[#0B3A75]" />
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
                      <span aria-hidden>/</span>
                      <span className="font-bold text-[#B56A2B]">
                        {summary.upcomingSwells.length} swell
                        {summary.upcomingSwells.length !== 1 ? "s" : ""} incoming
                      </span>
                    </>
                  )}
                </div>
              </div>

            </header>
          </ScrollReveal>

          {topBeach && (
            <TopRankedBeachHero
              beach={topBeach}
              regionName={region.name}
              now={summary.generatedAt}
              imageUrl={approvedTopBeachImage}
              mapImageUrl={satelliteFallbackUrl}
              bestSurfWindow={
                summary.recommendationAvailability?.state === "available"
                  ? summary.bestSurfWindows?.find(
                      (window) => window.beach.id === topBeach.beachId,
                    ) ?? null
                  : null
              }
            />
          )}

          <BestDaysSection
            days={summary.days}
            bestDay={summary.bestDay}
            regionName={region.name}
            className="mb-16"
            variant="zine"
          />

          {summary.upcomingSwells.length > 0 && (
            <ScrollReveal variant="fadeUp" delay={100}>
              <section className="torn torn-tb mb-16 border-2 border-[#11100D] bg-[#FBF6E8]">
                <div className="mb-5 flex items-center gap-3">
                  <QuiverSticker
                    sticker="breakingWave"
                    className="w-20 -rotate-6 drop-shadow-sm"
                  />
                  <h2 className="font-display text-3xl font-black uppercase leading-tight text-[#11100D]">
                    Upcoming Swells
                  </h2>
                </div>
                <SwellEventList
                  events={summary.upcomingSwells}
                  title={null}
                  variant="zine"
                />
              </section>
            </ScrollReveal>
          )}

          <BeachConditionsGrid
            beaches={summary.beachConditions}
            regionSlug={region.slug}
            maxBeaches={12}
            showViewAll={true}
            className="mb-16"
            variant="zine"
            showScores={user !== null}
          />

          <ScrollReveal variant="fadeUp" delay={200}>
            <section className="mb-16">
              <h2 className="label-black mb-6">Explore More</h2>
              <div className={`grid gap-4 ${showGuideLink ? "md:grid-cols-2" : ""}`}>
                {showGuideLink && (
                  <Link
                    href={`/guides/surfing-${guideSlug}`}
                    className="group torn torn-tb relative block min-h-48 overflow-hidden border-2 border-[#11100D] bg-[#F0E5CC] p-6 transition-transform hover:-translate-y-1"
                  >
                    <QuiverSticker
                      sticker="orangeMap"
                      className="absolute -right-4 -top-4 w-16 rotate-12 opacity-80"
                    />
                    <h3 className="relative z-10 font-display text-xl font-black uppercase text-[#11100D] transition-colors group-hover:text-[#B56A2B]">
                      {region.name} Surf Guide
                    </h3>
                    <p className="relative z-10 mt-3 text-sm leading-relaxed text-[#11100D]/68">
                      Explore surf spots, local knowledge, and conditions across{" "}
                      {region.name}
                    </p>
                    <span className="relative z-10 mt-5 inline-flex font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#B56A2B] group-hover:underline">
                      View Guide &rarr;
                    </span>
                  </Link>
                )}

                <Link
                  href="/forecast"
                  className="group torn torn-tb relative block min-h-48 overflow-hidden border-2 border-[#11100D] bg-[#FBF6E8] p-6 transition-transform hover:-translate-y-1"
                >
                  <QuiverSticker
                    sticker="goldRightArrow"
                    className="absolute -right-5 -top-3 w-24 rotate-6 opacity-85"
                  />
                  <h3 className="relative z-10 font-display text-xl font-black uppercase text-[#11100D] transition-colors group-hover:text-[#B56A2B]">
                    Other Regional Forecasts
                  </h3>
                  <p className="relative z-10 mt-3 text-sm leading-relaxed text-[#11100D]/68">
                    Compare conditions across all regions and find the best waves
                  </p>
                  <span className="relative z-10 mt-5 inline-flex font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#B56A2B] group-hover:underline">
                    View All Forecasts &rarr;
                  </span>
                </Link>
              </div>
            </section>
          </ScrollReveal>

          <ScrollReveal variant="scale" delay={300}>
            <section className="hazards-panel text-center">
              <QuiverSticker
                sticker="spotWindRead"
                className="mx-auto mb-4 w-20 rotate-6 drop-shadow-md"
              />
              <h2 className="font-display text-3xl font-black uppercase text-[#F4EBD8]">
                Unlock {region.name} Insights
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-[#F4EBD8]/75">
                Sign up to log sessions at {region.name} breaks and get
                personalized spot recommendations.
              </p>
              <Link
                href="/auth/sign-up"
                className="mt-6 inline-flex items-center justify-center rounded-full border-2 border-[#F4EBD8] bg-[#F78E42] px-6 py-3 font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(244,235,216,0.3)] transition-transform hover:-translate-y-0.5"
              >
                Sign Up for Free
              </Link>
            </section>
          </ScrollReveal>
        </main>
      </ZineSurface>

      {/* Mobile Sticky Signup Bar */}
      <StickySignupBar source={`forecast-${region.slug}`} />
    </>
  );
}
