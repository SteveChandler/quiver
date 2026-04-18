/**
 * Best Time to Surf - Hub/Index Page
 *
 * Lists all surf states with monthly profiles and links to city-specific pages.
 * Serves as an internal linking hub for the best-time-to-surf programmatic pages.
 *
 * URL: /best-time-to-surf
 */

import Link from "next/link";
import type { Metadata } from "next";

import { getCitiesWithBestMonthsData } from "@/actions/city/best-time-actions";
import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { getStateSurfProfile, getAvailableStateProfiles } from "@/lib/data/monthly-surf-data";
import { buildCitySlug } from "@/lib/seo/city-slug-utils";
import { COLLISION_CITY_MAP } from "@/lib/seo/city-collision-list";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { InlineSignupCta } from "@/components/seo/inline-signup-cta";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";
import { BestTimeEnhancements } from "@/components/best-time-to-surf/best-time-enhancements";

export const revalidate = 86400;

const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app"
).replace(/\/$/, "");

const currentYear = new Date().getFullYear();

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: `Best Time to Surf — Month-by-Month Guide for Every Coast (${currentYear})`,
    description: `Find the perfect surf trip window. Monthly wave heights, water temps, wetsuit recommendations, and crowd levels for 16 states. Updated for ${currentYear}.`,
    path: "/best-time-to-surf",
    keywords: [
      "best time to surf",
      "surf season calendar",
      "when to surf",
      "US surf season",
      "monthly surf guide",
    ],
  });
}

export default async function BestTimeToSurfHubPage() {
  // Fetch cities with best_months data for linking
  const citiesResult = await getCitiesWithBestMonthsData();
  const cities = citiesResult.success && citiesResult.data ? citiesResult.data : [];

  // Group cities by state
  const citiesByState = new Map<string, Array<{ city: string; state: string; beachCount: number }>>();
  for (const city of cities) {
    const stateUpper = city.state.toUpperCase();
    const existing = citiesByState.get(stateUpper) || [];
    existing.push(city);
    citiesByState.set(stateUpper, existing);
  }

  // Get state profiles for display
  const stateSlugs = getAvailableStateProfiles();
  const collisionMap = COLLISION_CITY_MAP;

  // Build all profiles for client-side enhancements
  const allProfiles = stateSlugs
    .map((slug) => getStateSurfProfile(slug))
    .filter(Boolean) as NonNullable<ReturnType<typeof getStateSurfProfile>>[];

  return (
    <div className="bg-gradient-to-b from-sky-50 via-blue-50/30 to-white min-h-screen">
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${SITE_ORIGIN}/` },
          { name: "Best Time to Surf", url: `${SITE_ORIGIN}/best-time-to-surf` },
        ]}
      />
      {/* WebPage JSON-LD with dateModified signals content freshness to Google */}
      <WebPageSchema
        name={`Best Time to Surf — Month-by-Month Guide for Every Coast (${currentYear})`}
        url={`${SITE_ORIGIN}/best-time-to-surf`}
      />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Hero Section */}
        <ScrollReveal>
          <header className="mb-8 text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Best Time to Surf — Month-by-Month Guide for Every Coast
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Find the perfect surf trip window. Monthly wave heights, water temps, wetsuit
              recommendations, and crowd levels for 16 states.
            </p>
          </header>
        </ScrollReveal>

        {/* Interactive Enhancements: Comparison + Personalization */}
        <ScrollReveal>
          <div className="mb-12">
            <BestTimeEnhancements stateProfiles={allProfiles} />
          </div>
        </ScrollReveal>

        {/* State Cards Grid */}
        <ScrollReveal stagger staggerDelay={75}>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-16">
            {stateSlugs.map((slug) => {
              const profile = getStateSurfProfile(slug);
              if (!profile) return null;

              const bestMonth = profile.monthly.reduce((best, entry) =>
                entry.overallScore > best.overallScore ? entry : best
              );

              const stateCities = citiesByState.get(profile.stateSlug.toUpperCase()) || [];

              return (
                <div
                  key={slug}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:-translate-y-1 hover:shadow-xl transition-all duration-200"
                >
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">
                    {profile.stateName}
                  </h2>
                  <p className="text-sm text-gray-500 mb-3">
                    Peak: {profile.peakSeason}
                  </p>

                  {/* Mini score bar */}
                  <div className="flex gap-0.5 mb-3 h-8">
                    {profile.monthly.map((m, i) => {
                      const isPeak = profile.peakMonths.includes(i + 1);
                      const height = Math.max(15, (m.overallScore / 100) * 100);
                      return (
                        <div
                          key={i}
                          className="flex-1 flex flex-col justify-end"
                          title={`${m.month}: ${m.overallScore}`}
                        >
                          <div
                            className={`rounded-t-sm ${isPeak ? "bg-ocean-blue" : "bg-gray-200"}`}
                            style={{ height: `${height}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-1 text-xs text-gray-600 mb-4">
                    <div className="flex justify-between">
                      <span>Best month</span>
                      <span className="font-medium text-gray-900">{bestMonth.month}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Wave range</span>
                      <span className="font-medium text-gray-900">{bestMonth.waveHeightRange}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Water temp</span>
                      <span className="font-medium text-gray-900">{bestMonth.waterTemp}°F</span>
                    </div>
                  </div>

                  {/* City links */}
                  {stateCities.length > 0 && (
                    <div className="border-t border-gray-100 pt-3">
                      <p className="text-xs font-medium text-gray-500 mb-1.5">
                        City guides ({stateCities.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {stateCities.slice(0, 6).map((c) => {
                          const citySlug = buildCitySlug(c.city, c.state, collisionMap);
                          if (!citySlug) return null;
                          return (
                            <Link
                              key={`${c.city}-${c.state}`}
                              href={`/best-time-to-surf/${citySlug}`}
                              className="text-xs text-ocean-blue hover:underline"
                            >
                              {c.city}
                            </Link>
                          );
                        })}
                        {stateCities.length > 6 && (
                          <span className="text-xs text-gray-400">
                            +{stateCities.length - 6} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollReveal>

        {/* All City Links Section */}
        {cities.length > 0 && (
          <ScrollReveal>
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                All City Surf Season Guides
              </h2>
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {stateSlugs.map((slug) => {
                    const stateUpper = slug.toUpperCase();
                    const stateCities = citiesByState.get(stateUpper);
                    if (!stateCities || stateCities.length === 0) return null;

                    const profile = getStateSurfProfile(slug);
                    const stateName = profile?.stateName || stateUpper;

                    return (
                      <div key={slug}>
                        <h3 className="text-sm font-semibold text-gray-900 mb-1.5">
                          {stateName}
                        </h3>
                        <ul className="space-y-0.5">
                          {stateCities
                            .sort((a, b) => a.city.localeCompare(b.city))
                            .map((c) => {
                              const citySlug = buildCitySlug(c.city, c.state, collisionMap);
                              if (!citySlug) return null;
                              return (
                                <li key={`${c.city}-${c.state}`}>
                                  <Link
                                    href={`/best-time-to-surf/${citySlug}`}
                                    className="text-sm text-ocean-blue hover:underline"
                                  >
                                    {c.city}
                                  </Link>
                                  <span className="text-xs text-gray-400 ml-1">
                                    ({c.beachCount} spots)
                                  </span>
                                </li>
                              );
                            })}
                        </ul>
                      </div>
                    );
                  })}

                  {/* Cities from states without profiles */}
                  {Array.from(citiesByState.entries())
                    .filter(([stateUpper]) => !stateSlugs.includes(stateUpper.toLowerCase()))
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([stateUpper, stateCities]) => (
                      <div key={stateUpper}>
                        <h3 className="text-sm font-semibold text-gray-900 mb-1.5">
                          {stateUpper}
                        </h3>
                        <ul className="space-y-0.5">
                          {stateCities
                            .sort((a, b) => a.city.localeCompare(b.city))
                            .map((c) => {
                              const citySlug = buildCitySlug(c.city, c.state, collisionMap);
                              if (!citySlug) return null;
                              return (
                                <li key={`${c.city}-${c.state}`}>
                                  <Link
                                    href={`/best-time-to-surf/${citySlug}`}
                                    className="text-sm text-ocean-blue hover:underline"
                                  >
                                    {c.city}
                                  </Link>
                                  <span className="text-xs text-gray-400 ml-1">
                                    ({c.beachCount} spots)
                                  </span>
                                </li>
                              );
                            })}
                        </ul>
                      </div>
                    ))}
                </div>
              </div>
            </section>
          </ScrollReveal>
        )}

        <InlineSignupCta
          title="Your best window, every day"
          description="Pick your home beach. We score every hour by tide, wind, and swell, then tell you when to paddle out."
          primaryButtonText="Pick your home beach"
          source="best-time-hub-inline"
          ctaCopyVariant="best_time_hub_v1"
          className="mb-8"
        />

        {/* Cross-linking to other features */}
        <ScrollReveal>
          <section className="rounded-2xl bg-gradient-to-br from-ocean-blue to-blue-700 p-6 md:p-8 text-white text-center">
            <h2 className="text-xl md:text-2xl font-bold mb-2">
              Ready to check today&apos;s conditions?
            </h2>
            <p className="text-white/80 mb-4 max-w-lg mx-auto">
              Get real-time surf forecasts, tide charts, and crowd levels for beaches across the US.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/forecast"
                className="inline-flex items-center px-5 py-2.5 rounded-lg bg-white text-ocean-blue font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                7-Day Forecast
              </Link>
              <Link
                href="/beaches"
                className="inline-flex items-center px-5 py-2.5 rounded-lg bg-white/10 text-white font-semibold text-sm hover:bg-white/20 transition-colors border border-white/30"
              >
                Browse All Beaches
              </Link>
            </div>
          </section>
        </ScrollReveal>
      </div>
      <StickySignupBar
        source="best-time-hub"
        ctaText="Get Alerts"
        supportingText="Get notified when peak conditions arrive"
      />
    </div>
  );
}
