/**
 * Best Time to Surf - City Page
 *
 * Shows month-by-month surf quality for a city using aggregated
 * best_months data from beaches, enriched with regional water temp
 * and wetsuit recommendations, plus hardcoded state-level monthly data.
 *
 * URL pattern: /best-time-to-surf/[city]
 * Example: /best-time-to-surf/san-diego
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  getBestTimeToSurfData,
} from "@/actions/city/best-time-actions";
import { findCityBySlug } from "@/actions/city/city-metadata-actions";
import { buildPageMetadata } from "@/lib/seo/meta";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { getStateSurfProfile } from "@/lib/data/monthly-surf-data";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { FAQSchema } from "@/components/seo/faq-schema";
import { ItemListSchema } from "@/components/seo/item-list-schema";
import { IntentGuidesGrid } from "@/components/shared/intent-guides-grid";
import { AnimatedScoreGauge } from "@/components/forecast/animated-score-gauge";
import { MonthlySurfChart } from "@/components/best-time-to-surf/monthly-chart";
import { MonthlyGrid } from "@/components/best-time-to-surf/monthly-grid";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { InlineSignupCta } from "@/components/seo/inline-signup-cta";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";
import { SITE_URL } from "@/lib/constants/seo";
import { INTENT_DEFINITIONS, buildCityIntentUrl } from "@/lib/constants/intent-definitions";

export const revalidate = 86400;

// Constants
const now = new Date();
const currentYear = now.getFullYear();
const currentMonthIndex = now.getMonth(); // 0-based

const MONTH_ABBREVS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const YEAR_ROUND_THRESHOLD = 10;
const SOLID_SEASON_THRESHOLD = 6;

/**
 * Helper function to generate year-round surfing answer based on how many months
 * score above 50 (average).
 */
function generateYearRoundAnswer(cityName: string, monthsAbove50: number, peakMonthName: string): string {
  if (monthsAbove50 >= YEAR_ROUND_THRESHOLD) {
    return `Yes, ${cityName} offers good surf conditions nearly year-round, with ${monthsAbove50} months scoring above average. The peak season around ${peakMonthName} is particularly consistent.`;
  }
  if (monthsAbove50 >= SOLID_SEASON_THRESHOLD) {
    return `${cityName} has a solid surf season spanning roughly ${monthsAbove50} months. Conditions are best around ${peakMonthName}, but there are surfable waves most of the year.`;
  }
  return `${cityName} has a more concentrated surf season, with the best conditions around ${peakMonthName}. Plan your trip during the peak months for the most consistent waves.`;
}

interface PageParams {
  params: Promise<{ city: string }>;
}

// NOTE: generateStaticParams removed — pages are rendered on-demand via ISR.

export async function generateMetadata(props: PageParams): Promise<Metadata> {
  const { city: citySlug } = await props.params;

  const cityResult = await findCityBySlug(citySlug);
  if (!cityResult.success || !cityResult.data) {
    return { title: "Page Not Found" };
  }

  const { cityName, stateName } = cityResult.data;

  return buildPageMetadata({
    title: `Best Time to Surf in ${cityName}, ${stateName} (${currentYear})`,
    description: `Find the best months to surf in ${cityName}, ${stateName}. Month-by-month wave heights, water temperatures, wetsuit guide, and crowd levels. Updated for ${currentYear}.`,
    path: `/best-time-to-surf/${citySlug}`,
    keywords: [
      `best time to surf ${cityName}`,
      `${cityName} surf season`,
      `when to surf ${cityName}`,
      `${cityName} wave season`,
      `${stateName} surf calendar`,
    ],
  });
}

export default async function BestTimeToSurfPage(props: PageParams) {
  const { city: citySlug } = await props.params;

  const cityResult = await findCityBySlug(citySlug);
  if (!cityResult.success || !cityResult.data) {
    return notFound();
  }

  const { cityName, state, stateName } = cityResult.data;
  const stateSlug = state.toLowerCase();

  const dataResult = await getBestTimeToSurfData(cityName, state);
  if (!dataResult.success || !dataResult.data) {
    return notFound();
  }

  const data = dataResult.data;

  // Get hardcoded state-level monthly data for enriched grid
  const stateProfile = getStateSurfProfile(stateSlug);

  // Parse water temperature range once (Issue 3: bounds checking)
  const [minTemp, maxTemp] = (data.waterTempRange ?? "").split("-");
  const lowTemp = minTemp ?? "";
  const highTemp = maxTemp ?? minTemp ?? "";

  // Build ItemList items for structured data
  const itemListItems = data.topBeaches
    .filter((b) => b.slug)
    .map((b, i) => ({
      name: b.name,
      url: `${SITE_URL}${buildBeachUrl(b)}`,
      position: i + 1,
    }));

  // Build FAQ items
  const faqItems = [
    {
      question: `What is the best month to surf in ${cityName}?`,
      answer: `${data.peakMonthName} is the peak surf month in ${cityName}, when the most beaches hit their optimal conditions. ${data.topBeaches.length > 0 ? `Top spots like ${data.topBeaches.slice(0, 3).map((b) => b.name).join(", ")} peak during this window.` : ""}`,
    },
    {
      question: `What water temperature should I expect when surfing in ${cityName}?`,
      answer: stateProfile
        ? `Water temperatures in ${cityName} range from ${Math.min(...stateProfile.monthly.map((m) => m.waterTemp))}°F to ${Math.max(...stateProfile.monthly.map((m) => m.waterTemp))}°F throughout the year. ${stateProfile.monthly[6].wetsuit !== "boardshorts" ? `In summer, a ${stateProfile.monthly[6].wetsuit} is recommended.` : "Summer sessions are comfortable in boardshorts."} ${stateProfile.monthly[0].wetsuit !== "boardshorts" ? `In winter, bring a ${stateProfile.monthly[0].wetsuit}.` : ""}`
        : data.waterTempRange
          ? `Water temperatures in ${cityName} range from ${data.waterTempRange}°F throughout the year. ${data.summerWetsuit ? `In summer, a ${data.summerWetsuit} is recommended.` : ""} ${data.winterWetsuit ? `In winter, bring a ${data.winterWetsuit}.` : ""}`
          : `Water temperatures in ${cityName} vary by season. Check our beach pages for current conditions and wetsuit recommendations.`,
    },
    {
      question: `Is ${cityName} good for surfing year-round?`,
      answer: generateYearRoundAnswer(
        cityName,
        data.monthly.filter((m) => m.score >= 50).length,
        data.peakMonthName
      ),
    },
  ];

  // Dawn patrol context from state profile
  const dawnWinterTemp = stateProfile
    ? `${stateProfile.monthly[0].waterTemp}°F`
    : lowTemp
      ? `~${lowTemp}°F`
      : null;
  const afternoonSummerTemp = stateProfile
    ? `${stateProfile.monthly[7].waterTemp}°F`
    : highTemp
      ? `~${highTemp}°F`
      : null;

  return (
    <div className="bg-gradient-to-b from-sky-50 via-blue-50/30 to-white min-h-screen">
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${SITE_URL}/` },
          { name: "Best Time to Surf", url: `${SITE_URL}/best-time-to-surf` },
          {
            name: cityName,
            url: `${SITE_URL}/best-time-to-surf/${citySlug}`,
          },
        ]}
      />
      <FAQSchema items={faqItems} />
      <ItemListSchema
        items={itemListItems}
        name={`Best Surf Spots in ${cityName}`}
      />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Breadcrumb */}
        <nav
          aria-label="breadcrumb"
          className="flex items-center gap-1 text-sm mb-6"
        >
          <Link
            href="/best-time-to-surf"
            className="text-ocean-blue hover:underline"
          >
            Best Time to Surf
          </Link>
          <span className="text-gray-400 mx-1">&rsaquo;</span>
          <Link
            href={`/${stateSlug}/${citySlug}`}
            className="inline-flex items-center gap-1 text-ocean-blue hover:underline"
          >
            {cityName}
          </Link>
          <span className="text-gray-400 mx-1">&rsaquo;</span>
          <span className="text-gray-800 font-medium">Surf Calendar</span>
        </nav>

        {/* Hero Section */}
        <ScrollReveal>
          <header className="mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Best Time to Surf {cityName} ({currentYear})
            </h1>
            <p className="text-lg text-gray-600 mb-6">
              {cityName}, {stateName} &mdash; Month-by-month surf guide
            </p>

            {/* Current month hero card */}
            <div className="rounded-2xl bg-gradient-to-br from-ocean-blue to-blue-700 p-6 md:p-8 text-white flex flex-col md:flex-row items-center gap-6">
              <AnimatedScoreGauge
                score={data.monthly[currentMonthIndex].score}
                size="xl"
                showLabel
                variant="hero"
              />
              <div className="text-center md:text-left">
                <p className="text-white/80 text-sm font-medium uppercase tracking-wide mb-1">
                  Surfing in {data.monthly[currentMonthIndex].monthName}
                </p>
                <p className="text-3xl md:text-4xl font-bold mb-2">
                  {data.monthly[currentMonthIndex].monthName}
                </p>
                <p className="text-white/90 max-w-md">
                  {data.monthly[currentMonthIndex].bestMonthCount > 0
                    ? `${data.monthly[currentMonthIndex].bestMonthCount} of ${data.totalBeaches} beaches are in peak season right now.`
                    : `${cityName} is between peak seasons right now.`}
                  {stateProfile
                    ? ` Expect ${stateProfile.monthly[currentMonthIndex].waveHeightRange} waves and ${stateProfile.monthly[currentMonthIndex].waterTemp}°F water.`
                    : data.waterTempRange
                      ? ` Water temperatures range ${data.waterTempRange}°F year-round.`
                      : ""}
                  {data.peakMonth !== currentMonthIndex + 1
                    ? ` Peak month: ${data.peakMonthName}.`
                    : ""}
                </p>
              </div>
            </div>
          </header>
        </ScrollReveal>

        {/* Month-by-Month Chart */}
        <ScrollReveal>
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Surf Score by Month
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Score reflects overall surf quality each month — combining peak
              season activity, water temperature, and crowd levels.
            </p>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <MonthlySurfChart monthly={data.monthly} />
            </div>
          </section>
        </ScrollReveal>

        {/* Monthly Breakdown Grid */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Monthly Breakdown
          </h2>
          <MonthlyGrid
            monthly={data.monthly}
            waterTempRange={data.waterTempRange}
            summerWetsuit={data.summerWetsuit}
            winterWetsuit={data.winterWetsuit}
            stateMonthly={stateProfile?.monthly}
            peakMonths={stateProfile?.peakMonths}
          />
        </section>

        {/* Dawn Patrol vs Afternoon */}
        <ScrollReveal>
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Dawn Patrol vs Afternoon Sessions
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-200 bg-white p-5 hover:-translate-y-1 hover:shadow-xl transition-all duration-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Dawn Patrol
                </h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li>Typically glassier conditions before onshore winds build</li>
                  <li>Smaller crowds, especially on weekdays</li>
                  <li>
                    {dawnWinterTemp
                      ? `Water temps at their coolest — plan your wetsuit for the low end (${dawnWinterTemp} in winter)`
                      : "Water is coolest in the early morning — bring a thicker wetsuit"}
                  </li>
                  <li>Best for beach breaks and exposed reef setups in {cityName}</li>
                </ul>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 hover:-translate-y-1 hover:shadow-xl transition-all duration-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Afternoon Sessions
                </h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li>Onshore winds can create chop, but swell is often more consistent</li>
                  <li>Higher crowds on popular beaches, especially weekends</li>
                  <li>
                    {afternoonSummerTemp
                      ? `Water warms through the day — upper end (${afternoonSummerTemp} in summer)`
                      : "Water temperature is warmer by afternoon"}
                  </li>
                  <li>Sunset sessions can be magic when winds die down</li>
                </ul>
              </div>
            </div>
          </section>
        </ScrollReveal>

        {/* Top Beaches for This City */}
        {data.topBeaches.length > 0 && (
          <ScrollReveal>
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Top Surf Spots in {cityName}
              </h2>
              <ScrollReveal stagger staggerDelay={75}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.topBeaches.map((beach) => {
                    const href = beach.slug
                      ? buildBeachUrl(beach)
                      : null;

                    return (
                      <div
                        key={beach.slug || beach.name}
                        className="rounded-xl border border-gray-200 bg-white p-4 hover:-translate-y-1 hover:shadow-xl transition-all duration-200"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            {href ? (
                              <Link
                                href={href}
                                className="text-base font-semibold text-gray-900 hover:text-ocean-blue transition-colors"
                              >
                                {beach.name}
                              </Link>
                            ) : (
                              <span className="text-base font-semibold text-gray-900">
                                {beach.name}
                              </span>
                            )}
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {beach.skillLevel && (
                                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                                  {beach.skillLevel}
                                </span>
                              )}
                              {beach.crowdLevel && (
                                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                                  {beach.crowdLevel.replace(/_/g, " ")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {beach.bestMonths.length > 0 && (
                          <p className="mt-2 text-xs text-gray-500">
                            Peak: {beach.bestMonths
                              .map((m) => MONTH_ABBREVS[m - 1])
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollReveal>
            </section>
          </ScrollReveal>
        )}

        <InlineSignupCta
          title={`Get Alerts for ${cityName}`}
          description={`Get notified when conditions are ideal in ${cityName}. Personalized surf calls, 12-day outlooks, and condition alerts.`}
          primaryButtonText="Get Alerts — Free"
          source={`best-time-${citySlug}-inline`}
          className="mb-8"
        />

        {/* Continue Exploring */}
        <aside className="overflow-hidden rounded-2xl backdrop-blur-sm bg-gradient-to-br from-white/80 to-blue-50/60 border border-blue-200/50 shadow-lg p-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Continue exploring
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm text-sky-700">
            <li>
              <Link
                href={`/${stateSlug}/${citySlug}`}
                className="underline-offset-2 hover:underline"
              >
                Back to the {cityName} surf hub
              </Link>
            </li>
            {INTENT_DEFINITIONS.map((intent) => (
              <li key={intent.key}>
                <Link
                  href={buildCityIntentUrl(intent.key, citySlug)}
                  className="underline-offset-2 hover:underline"
                >
                  {intent.label} in {cityName}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/forecast"
                className="underline-offset-2 hover:underline"
              >
                7-Day Surf Forecast
              </Link>
            </li>
          </ul>
        </aside>

        {/* Cross-linking: Intent Guides Grid */}
        <IntentGuidesGrid
          locationSlug={citySlug}
          locationName={cityName}
          locationType="city"
          stateAbbrev={state}
        />
      </div>
      <StickySignupBar
        source={`best-time-${citySlug}`}
        ctaText="Get Alerts"
        supportingText={`Best conditions alerts for ${cityName}`}
      />
    </div>
  );
}
