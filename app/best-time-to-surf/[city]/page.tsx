/**
 * Best Time to Surf - City Page
 *
 * Shows month-by-month surf quality for a city using aggregated
 * best_months data from beaches, enriched with regional water temp
 * and wetsuit recommendations.
 *
 * URL pattern: /best-time-to-surf/[city]
 * Example: /best-time-to-surf/san-diego
 */

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getBestTimeToSurfData } from "@/actions/city/best-time-actions";
import { findCityBySlug } from "@/actions/city/city-metadata-actions";
import { buildPageMetadata } from "@/lib/seo/meta";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { FAQSchema } from "@/components/seo/faq-schema";
import { ItemListSchema } from "@/components/seo/item-list-schema";
import { IntentGuidesGrid } from "@/components/shared/intent-guides-grid";
import { AnimatedScoreGauge } from "@/components/forecast/animated-score-gauge";
import { MonthlySurfChart } from "@/components/best-time-to-surf/monthly-chart";
import { MonthlyGrid } from "@/components/best-time-to-surf/monthly-grid";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

export const revalidate = 86400; // 24 hours — monthly data changes infrequently

const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app"
).replace(/\/$/, "");

interface PageParams {
  params: Promise<{ city: string }>;
}

export async function generateMetadata(props: PageParams): Promise<Metadata> {
  const { city: citySlug } = await props.params;

  const cityResult = await findCityBySlug(citySlug);
  if (!cityResult.success || !cityResult.data) {
    return { title: "Page Not Found | Quiver" };
  }

  const { cityName, stateName } = cityResult.data;

  return buildPageMetadata({
    title: `Best Time to Surf ${cityName}, ${stateName} — Month-by-Month Guide`,
    description: `Find the best months to surf in ${cityName}, ${stateName}. Month-by-month wave quality scores, water temperatures, wetsuit guide, and crowd levels.`,
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

  // Build ItemList items for structured data
  const itemListItems = data.topBeaches
    .filter((b) => b.slug)
    .map((b, i) => ({
      name: b.name,
      url: `${SITE_ORIGIN}${buildBeachUrl(b)}`,
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
      answer: data.waterTempRange
        ? `Water temperatures in ${cityName} range from ${data.waterTempRange}°F throughout the year. ${data.summerWetsuit ? `In summer, a ${data.summerWetsuit} is recommended.` : ""} ${data.winterWetsuit ? `In winter, bring a ${data.winterWetsuit}.` : ""}`
        : `Water temperatures in ${cityName} vary by season. Check our beach pages for current conditions and wetsuit recommendations.`,
    },
    {
      question: `Is ${cityName} good for surfing year-round?`,
      answer: (() => {
        const monthsAbove50 = data.monthly.filter((m) => m.score >= 50).length;
        if (monthsAbove50 >= 10) {
          return `Yes, ${cityName} offers good surf conditions nearly year-round, with ${monthsAbove50} months scoring above average. The peak season around ${data.peakMonthName} is particularly consistent.`;
        }
        if (monthsAbove50 >= 6) {
          return `${cityName} has a solid surf season spanning roughly ${monthsAbove50} months. Conditions are best around ${data.peakMonthName}, but there are surfable waves most of the year.`;
        }
        return `${cityName} has a more concentrated surf season, with the best conditions around ${data.peakMonthName}. Plan your trip during the peak months for the most consistent waves.`;
      })(),
    },
  ];

  return (
    <div className="bg-gradient-to-b from-white via-gray-50/30 to-white">
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${SITE_ORIGIN}/` },
          {
            name: `${cityName} Surf`,
            url: `${SITE_ORIGIN}/beaches/usa/${stateSlug}/${citySlug}`,
          },
          {
            name: "Best Time to Surf",
            url: `${SITE_ORIGIN}/best-time-to-surf/${citySlug}`,
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
            href={`/beaches/usa/${stateSlug}/${citySlug}`}
            className="inline-flex items-center gap-1 text-ocean-blue hover:underline"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to {cityName}
          </Link>
          <span className="text-gray-400 mx-2">&rsaquo;</span>
          <span className="text-gray-800 font-medium">Best Time to Surf</span>
        </nav>

        {/* Hero Section */}
        <ScrollReveal>
          <header className="mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Best Time to Surf {cityName}
            </h1>
            <p className="text-lg text-gray-600 mb-6">
              {cityName}, {stateName} &mdash; Month-by-month surf guide
            </p>

            {/* Peak month hero card */}
            <div className="rounded-2xl bg-gradient-to-br from-ocean-blue to-blue-700 p-6 md:p-8 text-white flex flex-col md:flex-row items-center gap-6">
              <AnimatedScoreGauge
                score={data.peakScore}
                size="xl"
                showLabel
                variant="hero"
              />
              <div className="text-center md:text-left">
                <p className="text-white/80 text-sm font-medium uppercase tracking-wide mb-1">
                  Peak Surf Month
                </p>
                <p className="text-3xl md:text-4xl font-bold mb-2">
                  {data.peakMonthName}
                </p>
                <p className="text-white/90 max-w-md">
                  {data.topBeaches.length} of {data.totalBeaches} beaches hit
                  their best conditions during {data.peakMonthName}.
                  {data.waterTempRange
                    ? ` Water temperatures range ${data.waterTempRange}°F year-round.`
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
              Score reflects how many {cityName} beaches are in their peak
              season each month, normalized to 100.
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
          />
        </section>

        {/* Dawn Patrol vs Afternoon */}
        <ScrollReveal>
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Dawn Patrol vs Afternoon Sessions
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Dawn Patrol
                </h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li>Typically glassier conditions before onshore winds build</li>
                  <li>Smaller crowds, especially on weekdays</li>
                  <li>
                    {data.waterTempRange
                      ? `Water temps at their coolest — plan your wetsuit for the low end (~${data.waterTempRange.split("-")[0]}°F in winter)`
                      : "Water is coolest in the early morning — bring a thicker wetsuit"}
                  </li>
                  <li>Best for beach breaks and exposed reef setups in {cityName}</li>
                </ul>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Afternoon Sessions
                </h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li>Onshore winds can create chop, but swell is often more consistent</li>
                  <li>Higher crowds on popular beaches, especially weekends</li>
                  <li>
                    {data.waterTempRange
                      ? `Water warms through the day — upper end (~${data.waterTempRange.split("-")[1]}°F in summer)`
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
              <div className="grid gap-3 sm:grid-cols-2">
                {data.topBeaches.map((beach) => {
                  const href = beach.slug
                    ? buildBeachUrl(beach)
                    : null;

                  return (
                    <div
                      key={beach.slug || beach.name}
                      className="rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md transition-shadow"
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
                            .map((m) => [
                              "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
                            ][m - 1])
                            .join(", ")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </ScrollReveal>
        )}

        {/* Cross-linking: Intent Guides Grid */}
        <IntentGuidesGrid
          locationSlug={citySlug}
          locationName={cityName}
          locationType="city"
          stateAbbrev={state}
        />
      </div>
    </div>
  );
}
