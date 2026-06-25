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
import { ArrowRight, Waves } from "lucide-react";

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
import { QuiverSticker, ZineSurface } from "@/components/zine";

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
    <>
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

      <ZineSurface
        sectionLabel="Best time to surf"
        editionLabel="Month-by-month surf calendar"
        data-testid="best-time-to-surf-zine-surface"
      >
        <main>
          {/* Hero Section */}
          <ScrollReveal>
            <header className="relative">
              <QuiverSticker
                sticker="orangeMap"
                className="absolute -top-6 right-4 hidden w-20 rotate-3 opacity-90 sm:block"
              />
              <p className="label-black mb-5">Surf season calendar</p>
              <h1 className="zine-h1 font-heading font-black uppercase leading-[0.9] tracking-normal text-[#11100D]">
                Best Time to Surf — Month-by-Month Guide for Every Coast
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-relaxed text-[#11100D]/75 sm:text-xl">
                Find the perfect surf trip window. Monthly wave heights, water temps, wetsuit
                recommendations, and crowd levels for 16 states.
              </p>
              <div className="mt-7 flex flex-wrap gap-3 font-mono text-xs uppercase tracking-[0.14em] text-[#11100D]/65">
                <span>16 states</span>
                <span aria-hidden>/</span>
                <span>12-month profiles</span>
                <span aria-hidden>/</span>
                <span>peak-window picks</span>
              </div>
            </header>
          </ScrollReveal>

          {/* Interactive Enhancements: Comparison + Personalization */}
          <ScrollReveal>
            <div className="mt-12">
              <BestTimeEnhancements stateProfiles={allProfiles} />
            </div>
          </ScrollReveal>

          {/* State Cards Grid */}
          <ScrollReveal stagger staggerDelay={75}>
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                    className="torn border-2 border-[#11100D] bg-[#FBF6E8] p-5 shadow-[2px_3px_0_rgba(17,16,13,0.22)] transition-transform hover:-translate-y-1"
                  >
                    <h2 className="font-heading text-lg font-black uppercase leading-tight text-[#11100D]">
                      {profile.stateName}
                    </h2>
                    <p className="mt-1 mb-3 font-mono text-xs uppercase tracking-[0.12em] text-[#11100D]/55">
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
                              className={`rounded-t-sm ${isPeak ? "bg-[#F78E42]" : "bg-[#11100D]/15"}`}
                              style={{ height: `${height}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div className="mb-4 space-y-1 text-xs text-[#11100D]/65">
                      <div className="flex justify-between">
                        <span>Best month</span>
                        <span className="font-mono font-bold text-[#11100D]">{bestMonth.month}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Wave range</span>
                        <span className="font-mono font-bold text-[#11100D]">{bestMonth.waveHeightRange}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Water temp</span>
                        <span className="font-mono font-bold text-[#11100D]">{bestMonth.waterTemp}°F</span>
                      </div>
                    </div>

                    {/* City links */}
                    {stateCities.length > 0 && (
                      <div className="border-t-2 border-dashed border-[#11100D]/25 pt-3">
                        <p className="mb-1.5 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-[#11100D]/55">
                          City guides ({stateCities.length})
                        </p>
                        <div className="flex flex-wrap gap-x-2 gap-y-1">
                          {stateCities.slice(0, 6).map((c) => {
                            const citySlug = buildCitySlug(c.city, c.state, collisionMap);
                            if (!citySlug) return null;
                            return (
                              <Link
                                key={`${c.city}-${c.state}`}
                                href={`/best-time-to-surf/${citySlug}`}
                                className="text-xs font-semibold text-[#11100D] underline-offset-2 transition-colors hover:text-[#B56A2B] hover:underline"
                              >
                                {c.city}
                              </Link>
                            );
                          })}
                          {stateCities.length > 6 && (
                            <span className="text-xs text-[#11100D]/40">
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
              <section className="mt-14" aria-labelledby="all-city-guides-heading">
                <div className="mb-5 flex items-end justify-between gap-4 border-b-2 border-dashed border-[#11100D]/35 pb-4">
                  <div>
                    <p className="typewriter mb-2">Every coast</p>
                    <h2
                      id="all-city-guides-heading"
                      className="font-heading text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl"
                    >
                      All City Surf Season Guides
                    </h2>
                  </div>
                  <QuiverSticker
                    sticker="spotBestSeason"
                    className="hidden w-16 rotate-3 drop-shadow-sm sm:block"
                  />
                </div>
                <div className="torn torn-tb border-2 border-[#11100D] bg-[#FBF6E8] p-6">
                  <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {stateSlugs.map((slug) => {
                      const stateUpper = slug.toUpperCase();
                      const stateCities = citiesByState.get(stateUpper);
                      if (!stateCities || stateCities.length === 0) return null;

                      const profile = getStateSurfProfile(slug);
                      const stateName = profile?.stateName || stateUpper;

                      return (
                        <div key={slug}>
                          <h3 className="mb-1.5 font-heading text-sm font-black uppercase text-[#11100D]">
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
                                      className="text-sm font-semibold text-[#11100D] underline-offset-2 transition-colors hover:text-[#B56A2B] hover:underline"
                                    >
                                      {c.city}
                                    </Link>
                                    <span className="ml-1 font-mono text-xs text-[#11100D]/45">
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
                          <h3 className="mb-1.5 font-heading text-sm font-black uppercase text-[#11100D]">
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
                                      className="text-sm font-semibold text-[#11100D] underline-offset-2 transition-colors hover:text-[#B56A2B] hover:underline"
                                    >
                                      {c.city}
                                    </Link>
                                    <span className="ml-1 font-mono text-xs text-[#11100D]/45">
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
            className="my-12"
            variant="zine"
          />

          {/* Cross-linking to other features */}
          <ScrollReveal>
            <section className="hazards-panel mt-14" aria-labelledby="check-conditions-heading">
              <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#F2C94C]">
                    Today&apos;s call
                  </p>
                  <h2
                    id="check-conditions-heading"
                    className="mt-3 font-heading text-3xl font-black uppercase leading-none text-[#F4EBD8] sm:text-4xl"
                  >
                    Ready to check today&apos;s conditions?
                  </h2>
                  <p className="mt-4 max-w-lg text-base leading-relaxed text-[#F4EBD8]/75">
                    Get real-time surf forecasts, tide charts, and crowd levels for beaches across the US.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 lg:justify-end">
                  <Link
                    href="/forecast"
                    className="inline-flex min-h-11 items-center rounded-full border-2 border-[#11100D] bg-[#F78E42] px-5 py-2 font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.35)] transition-transform hover:-translate-y-0.5"
                  >
                    7-Day Forecast
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                  </Link>
                  <Link
                    href="/beaches"
                    className="inline-flex min-h-11 items-center rounded-full border-2 border-[#F4EBD8]/70 bg-[#F4EBD8] px-5 py-2 font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.25)] transition-transform hover:-translate-y-0.5"
                  >
                    Browse All Beaches
                    <Waves className="ml-2 h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </div>
            </section>
          </ScrollReveal>
        </main>
      </ZineSurface>

      <StickySignupBar
        source="best-time-hub"
        ctaText="Get Alerts"
        supportingText="Get notified when peak conditions arrive"
      />
    </>
  );
}
