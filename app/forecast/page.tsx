import { Metadata } from "next";
import Link from "next/link";
import { Calendar, MapPin, TrendingUp } from "lucide-react";

import {
  FORECAST_REGIONS,
  getGuideSlugForRegion,
  hasHubGuide,
} from "@/lib/data/forecast-regions";
import { REGION_GROUPS } from "@/lib/data/region-groups";
import { formatFullDateWithYear } from "@/lib/utils/date-time";
import {
  getRegionalSummaries,
  getBestRegionForUser,
} from "@/lib/utils/forecast-hub-utils";
import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import {
  RegionalForecastCard,
  RegionalForecastCardGrid,
  AnimatedScoreGauge,
  BestRightNow,
} from "@/components/forecast";
import { OceanBackground } from "@/components/ui/ocean-background";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";
import { WebPageSchema } from "@/components/seo/web-page-schema";

// ISR: revalidate every hour — forecasts update every ~3 hours, this is conservative
export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: "Surf Forecast - 7 Day Regional Surf Conditions",
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
    "Florida surf forecast",
    "Oregon surf forecast",
    "New Jersey surf forecast",
    "Outer Banks surf forecast",
    "surf report",
  ],
});

/**
 * Forecast Hub Landing Page
 *
 * Main forecast index page linking to all regional forecasts.
 * Displays summary cards for each region with best days, wave heights,
 * and conditions quality. Enhanced with ocean background and animations.
 */
export default async function ForecastHubPage() {
  const summaries = await getRegionalSummaries();
  const regions = Object.values(FORECAST_REGIONS);

  // Server always renders global best — client-side personalization via cookie
  // is handled inside BestRightNow (reads quiver_ip_region cookie on mount).
  const bestResult = getBestRegionForUser(summaries, null);

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

  // Get today's date for display
  const today = new Date();
  const todayFormatted = formatFullDateWithYear(today);

  return (
    <OceanBackground variant="ocean" showWaves animated={false}>
      {/* Structured Data */}
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: baseUrl },
          { name: "Surf Forecast", url: `${baseUrl}/forecast` },
        ]}
      />

      {/* JSON-LD for WebPage */}
      <WebPageSchema
        name="Surf Forecast - 7 Day Regional Surf Conditions"
        url={`${baseUrl}/forecast`}
        description="Get the surf forecast for California, Hawaii, Puerto Rico and more. 7-day outlooks with best days, swell analysis, and beach-by-beach conditions."
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
            ],
          },
          publisher: {
            "@type": "Organization",
            name: "Quiver Surf",
            url: baseUrl,
          },
        }}
      />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Hero Section */}
        <ScrollReveal variant="fadeUp">
          <header className="text-center mb-8">
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
        </ScrollReveal>

        {/* Best Today Section - Enhanced Hero */}
        {bestResult && bestResult.summary.days[0] && (
          <ScrollReveal variant="scale" delay={100}>
            <section className="mb-10 bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 rounded-xl p-6 border border-sky-200 relative overflow-hidden">
              {/* Subtle wave pattern */}
              <div className="absolute inset-0 opacity-10 pointer-events-none">
                <svg
                  className="absolute bottom-0 left-0 w-full h-16"
                  viewBox="0 0 1440 60"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0,30 Q360,60 720,30 T1440,30 L1440,60 L0,60 Z"
                    fill="currentColor"
                    className="text-sky-500"
                  />
                </svg>
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center gap-6 relative z-10">
                {/* Animated Score Gauge */}
                <div className="flex-shrink-0">
                  <AnimatedScoreGauge
                    score={bestResult.summary.days[0].score}
                    size="lg"
                    showLabel
                  />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    {bestResult.isLocationPersonalized
                      ? "Your Local Forecast"
                      : "Best Conditions Today"}
                  </h2>
                  <div className="flex flex-wrap items-center gap-4 text-gray-700">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-sky-600" />
                      <Link
                        href={`/forecast/${bestResult.region.slug}`}
                        className="font-medium hover:text-sky-600 hover:underline transition-colors"
                      >
                        {bestResult.region.name}
                      </Link>
                    </div>
                    <span className="text-gray-400">|</span>
                    <span>
                      {Math.round(bestResult.summary.days[0].avgWaveHeight)}ft{" "}
                      waves
                    </span>
                    <span className="text-gray-400">|</span>
                    <span>
                      Score: {bestResult.summary.days[0].score}/100
                    </span>
                    {bestResult.summary.upcomingSwells.length > 0 && (
                      <>
                        <span className="text-gray-400">|</span>
                        <span className="text-blue-600 font-medium animate-pulse">
                          {bestResult.summary.upcomingSwells[0].size} swell incoming
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* CTA */}
                <Link
                  href={`/forecast/${bestResult.region.slug}`}
                  className="hidden md:inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white font-medium rounded-lg hover:bg-sky-700 transition-colors"
                >
                  <TrendingUp className="h-4 w-4" />
                  View Forecast
                </Link>
              </div>
            </section>
          </ScrollReveal>
        )}

        {/* Best Right Now - Top Beaches Leaderboard */}
        {/* userCoords are read client-side from the quiver_ip_region cookie */}
        <ScrollReveal variant="fadeUp" delay={125}>
          <BestRightNow />
        </ScrollReveal>

        {/* Regional Forecast Cards - Grouped */}
        <section className="mb-10">
          <ScrollReveal variant="fadeUp" delay={150}>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Choose Your Region
            </h2>
          </ScrollReveal>

          {REGION_GROUPS.map((group, groupIndex) => {
            const groupRegions = group.slugs
              .map((slug) => FORECAST_REGIONS[slug])
              .filter(Boolean);
            if (groupRegions.length === 0) return null;

            return (
              <div key={group.label} className="mb-8 last:mb-0">
                <ScrollReveal variant="fadeUp" delay={175 + groupIndex * 50}>
                  <h3 className="text-lg font-semibold text-gray-700 mb-3">
                    {group.label}
                  </h3>
                </ScrollReveal>
                <ScrollReveal variant="fadeUp" delay={200 + groupIndex * 50} stagger staggerDelay={75}>
                  <RegionalForecastCardGrid>
                    {groupRegions.map((region) => (
                      <RegionalForecastCard
                        key={region.slug}
                        region={region}
                        summary={summaries[region.slug]}
                      />
                    ))}
                  </RegionalForecastCardGrid>
                </ScrollReveal>
              </div>
            );
          })}
        </section>

        {/* Cross-Links to Hub Guides */}
        <ScrollReveal variant="fadeUp" delay={300}>
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Regional Surf Guides
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(() => {
                // Deduplicate by guide slug (e.g. LA and SoCal both map to southern-california)
                const seen = new Set<string>();
                return regions
                  .filter((region) => {
                    if (!hasHubGuide(region.slug)) return false;
                    const guideSlug = getGuideSlugForRegion(region.slug);
                    if (seen.has(guideSlug)) return false;
                    seen.add(guideSlug);
                    return true;
                  })
                  .map((region) => {
                    const guideSlug = getGuideSlugForRegion(region.slug);

                    return (
                      <Link
                        key={guideSlug}
                        href={`/guides/surfing-${guideSlug}`}
                        className="block p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-gradient-to-br hover:from-sky-50/50 hover:to-blue-50/30 transition-all duration-200 group"
                      >
                        <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                          {region.name} Guide
                        </h3>
                        <p className="text-sm text-gray-600">
                          Explore surf spots, local knowledge, and conditions
                        </p>
                      </Link>
                    );
                  });
              })()}
            </div>
          </section>
        </ScrollReveal>

        {/* Browse Beaches & Guides */}
        <ScrollReveal variant="fadeUp" delay={350}>
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Browse Beaches
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { href: "/beaches/usa", title: "United States", desc: "All U.S. surf beaches by state" },
                { href: "/beaches/mexico", title: "Mexico", desc: "Baja, mainland, and island spots" },
                { href: "/beginner/ca", title: "Beginner Spots", desc: "Gentle waves for learning" },
                { href: "/tide/san-diego", title: "Tide Charts", desc: "Tidal conditions and timing" },
              ].map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className="block p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-gradient-to-br hover:from-sky-50/50 hover:to-blue-50/30 transition-all duration-200 group"
                >
                  <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-sm text-gray-600">{card.desc}</p>
                </Link>
              ))}
            </div>
          </section>
        </ScrollReveal>

        {/* CTA Section */}
        <ScrollReveal variant="scale" delay={400}>
          <section className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 text-center relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl" />

            <div className="relative z-10">
              <h2 className="text-2xl font-semibold text-white mb-4">
                Track Your Sessions & Spots
              </h2>
              <p className="text-slate-300 mb-6 max-w-2xl mx-auto">
                Sign up to log sessions, save your favorite breaks, and get
                personalized recommendations.
              </p>
              <Link
                href="/auth/sign-up"
                className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Sign Up for Free
              </Link>
            </div>
          </section>
        </ScrollReveal>
      </div>

      {/* Mobile Sticky Signup Bar */}
      <StickySignupBar source="forecast-hub" />
    </OceanBackground>
  );
}
