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
import { Waves } from "lucide-react";

import {
  getBestTimeToSurfData,
  type BestTimeToSurfData,
} from "@/actions/city/best-time-actions";
import { findCityBySlug, getCityExcludeIntents } from "@/actions/city/city-metadata-actions";
import { getBeachesByIntentAndCity } from "@/actions/beach/beach-query-actions";
import {
  getIntentForecastSummary,
  type IntentForecastSummary,
} from "@/actions/forecast/intent-forecast-actions";
import { buildPageMetadata } from "@/lib/seo/meta";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { getStateSurfProfile } from "@/lib/data/monthly-surf-data";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { FAQSchema } from "@/components/seo/faq-schema";
import { ItemListSchema } from "@/components/seo/item-list-schema";
import { IntentGuidesGrid } from "@/components/shared/intent-guides-grid";
import { AnimatedScoreGauge } from "@/components/forecast/animated-score-gauge";
import { MonthlySurfChart } from "@/components/best-time-to-surf/monthly-chart";
import { MonthlyViewToggle } from "@/components/best-time-to-surf/monthly-view-toggle";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { InlineSignupCta } from "@/components/seo/inline-signup-cta";
import {
  SeoFunnelNextSteps,
  type SeoFunnelNextStep,
} from "@/components/seo/seo-funnel-next-steps";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";
import { SITE_URL } from "@/lib/constants/seo";
import { INTENT_DEFINITIONS, buildCityIntentUrl, type IntentKey } from "@/lib/constants/intent-definitions";
import { SeoScenePanel } from "@/components/seo/seo-scene-panel";
import {
  getBestTimeSeoScene,
  getBestTimeSessionSeoScene,
} from "@/lib/constants/seo-scenes";
import { isPhase18BestTimePath } from "@/lib/recommendations/session-intelligence-rollout";

export const revalidate = 86400;

// Constants
const currentMonthIndex = new Date().getMonth(); // 0-based

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

type BestTimeHandoffBeach = Pick<
  BestTimeToSurfData["topBeaches"][number],
  "name" | "slug" | "city" | "state" | "country"
>;

export function buildBestTimeLiveHandoffSteps({
  cityName,
  citySlug,
  path,
  stateSlug,
  topBeaches,
}: {
  cityName: string;
  citySlug: string;
  path?: string;
  stateSlug: string;
  topBeaches: BestTimeHandoffBeach[];
}): SeoFunnelNextStep[] {
  const primarySpot = topBeaches.find(
    (beach) => beach.slug && beach.city && beach.state,
  );
  const primarySpotHref = primarySpot
    ? buildBeachUrl(primarySpot)
    : `/${stateSlug}/${citySlug}`;
  const primarySpotName = primarySpot?.name ?? cityName;

  if (path && isPhase18BestTimePath(path)) {
    return [
      {
        label: `Open live ${primarySpotName} conditions`,
        href: primarySpotHref,
        description:
          "Use the current wave height, wind, tide, and local call before applying the seasonal pattern.",
      },
      {
        label: `Check today's ${cityName} surf hub`,
        href: `/${stateSlug}/${citySlug}`,
        description:
          "Compare live spots in this city before picking the window that fits your plan.",
      },
      {
        label: "Scan the 7-day regional forecast",
        href: "/forecast",
        description:
          "Use the forecast hub to confirm whether this seasonal setup is building or fading.",
      },
    ];
  }

  return [
    {
      label: `Check today's ${primarySpotName} surf report`,
      href: primarySpotHref,
      description:
        "Start with the live wave height, wind, tide, and board call before committing.",
    },
    {
      label: `Find the best current ${cityName} window`,
      href: `/${stateSlug}/${citySlug}`,
      description:
        "Compare the city's current forecast and spot list against the seasonal pattern.",
    },
    {
      label: `Compare nearby ${cityName} spots`,
      href: `/map?search=${encodeURIComponent(cityName)}`,
      description:
        "Use the map to switch beaches when crowd, wind, or tide changes the call.",
    },
  ];
}

interface BestTimeTodayAnswerCopyArgs {
  cityName: string;
  currentMonthName: string;
  currentMonthScore: number;
  currentBestMonthCount: number;
  totalBeaches: number;
  peakMonthName: string;
  waveHeightRange?: string | null;
  waterTempF?: number | null;
  forecastSummary?: IntentForecastSummary | null;
}

export function buildBestTimeTodayAnswerCopy({
  cityName,
  currentMonthName,
  currentMonthScore,
  currentBestMonthCount,
  totalBeaches,
  peakMonthName,
  waveHeightRange,
  waterTempF,
  forecastSummary,
}: BestTimeTodayAnswerCopyArgs): {
  eyebrow: string;
  heading: string;
  weekHeading: string;
  todayAnswer: string;
  thisWeekAnswer: string;
  surfReportCue: string;
} {
  const seasonStrength =
    currentBestMonthCount > 0
      ? `${currentBestMonthCount} of ${totalBeaches} local beaches are in peak season`
      : `${cityName} is between peak-season windows`;
  const waveText = waveHeightRange ? ` with ${waveHeightRange} surf` : "";
  const waterText = waterTempF != null ? ` and ${waterTempF}°F water` : "";
  const forecastDay = forecastSummary?.isTomorrow ? "tomorrow" : "today";
  const topPick = forecastSummary?.topPicks[0];
  const liveTodayAnswer =
    forecastSummary?.bestWindow
      ? `${cityName}'s best surf window ${forecastDay} is ${forecastSummary.bestWindow.start}-${forecastSummary.bestWindow.end}: ${forecastSummary.bestWindow.reason}. ${
          topPick
            ? `${topPick.name} is the top pick at ${topPick.waveHeight}.`
            : "Check the live report before you drive."
        }`
      : null;
  const liveSurfReportCue = forecastSummary
    ? `${forecastSummary.conditions.tide} tide, ${forecastSummary.conditions.wind} wind, and ${forecastSummary.conditions.swell} swell are the live surf report cues to confirm first.`
    : null;

  return {
    eyebrow: "Live surf planning",
    heading: `Best time to surf ${cityName} today`,
    weekHeading: `Best time to surf ${cityName} this week`,
    todayAnswer:
      liveTodayAnswer ??
      `${cityName}'s best surf window today starts with the live report: check tide, wind, and swell before you drive${waveText}${waterText}.`,
    thisWeekAnswer: `${currentMonthName} rates ${currentMonthScore}/100 for ${cityName}. ${seasonStrength}; ${peakMonthName} is the historical peak if this week's surf report looks marginal.`,
    surfReportCue:
      liveSurfReportCue ??
      `Use the surf report first, then treat this seasonal guide as the tiebreaker for which ${cityName} spot and window to choose.`,
  };
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
    title: `Best Time to Surf ${cityName} Today & This Week`,
    description: `Best time to surf ${cityName} today and this week. Start with the live surf report, then use seasonal windows, tides, wind, and nearby spots.`,
    path: `/best-time-to-surf/${citySlug}`,
    keywords: [
      `best time to surf ${cityName}`,
      `best time to surf ${cityName} today`,
      `${cityName} surf report today`,
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
  const heroScene = getBestTimeSeoScene(citySlug);
  const sessionScene = getBestTimeSessionSeoScene(citySlug);

  const [dataResult, excludeIntents, forecastBeachesResult] = await Promise.all([
    getBestTimeToSurfData(cityName, state),
    getCityExcludeIntents(cityName, state),
    getBeachesByIntentAndCity("best-time", citySlug, stateSlug),
  ]);
  if (!dataResult.success || !dataResult.data) {
    return notFound();
  }

  const data = dataResult.data;
  const forecastBeaches =
    forecastBeachesResult.success && forecastBeachesResult.data
      ? forecastBeachesResult.data
      : [];
  const forecastSummary = await getIntentForecastSummary(
    forecastBeaches.slice(0, 5).map((beach) => ({
      id: beach.id,
      name: beach.name,
      slug: beach.slug ?? "",
      city: beach.city ?? undefined,
      state: beach.state ?? undefined,
      skill_level: beach.skill_level,
      swell_window_center_deg: beach.swell_window_center_deg,
      swell_window_halfwidth_deg: beach.swell_window_halfwidth_deg,
      wind_offshore_deg: beach.wind_offshore_deg,
      wind_offshore_tol_deg: beach.wind_offshore_tol_deg,
      preferred_tide_ft_min: beach.preferred_tide_ft_min,
      preferred_tide_ft_max: beach.preferred_tide_ft_max,
    })),
    "best-time"
  );
  const liveHandoffSteps = buildBestTimeLiveHandoffSteps({
    cityName,
    citySlug,
    path: `/best-time-to-surf/${citySlug}`,
    stateSlug,
    topBeaches: data.topBeaches,
  });

  // Get hardcoded state-level monthly data for enriched grid
  const stateProfile = getStateSurfProfile(stateSlug);
  const currentMonthData = data.monthly[currentMonthIndex];
  const currentStateMonth = stateProfile?.monthly[currentMonthIndex];
  const liveAnswerCopy = buildBestTimeTodayAnswerCopy({
    cityName,
    currentMonthName: currentMonthData.monthName,
    currentMonthScore: currentMonthData.score,
    currentBestMonthCount: currentMonthData.bestMonthCount,
    totalBeaches: data.totalBeaches,
    peakMonthName: data.peakMonthName,
    waveHeightRange: currentStateMonth?.waveHeightRange,
    waterTempF: currentStateMonth?.waterTemp,
    forecastSummary,
  });

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
    <div className="seo-paper-page">
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
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,460px)] lg:items-stretch">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                  Best Time to Surf {cityName} Today
                </h1>
                <p className="text-lg text-gray-600 mb-6">
                  {cityName}, {stateName} &mdash; today, this week, and the seasonal pattern
                </p>

                <div className="mb-5 rounded-lg border border-[#11100D]/15 bg-white p-5 text-[#11100D] shadow-sm">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#655C4C]">
                    {liveAnswerCopy.eyebrow}
                  </p>
                  <h2 className="mb-3 text-2xl font-semibold text-gray-900">
                    Today&apos;s surf call
                  </h2>
                  <p className="text-sm leading-6 text-gray-700">
                    {liveAnswerCopy.todayAnswer}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md bg-[#FBF6E8] p-3">
                      <h3 className="text-sm font-semibold text-gray-900">
                        This week&apos;s surf window
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-gray-700">
                        {liveAnswerCopy.thisWeekAnswer}
                      </p>
                    </div>
                    <div className="rounded-md bg-[#EEF6FB] p-3">
                      <h3 className="text-sm font-semibold text-gray-900">
                        Match the surf report
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-gray-700">
                        {liveAnswerCopy.surfReportCue}
                      </p>
                    </div>
                  </div>
                  {liveHandoffSteps[0] && (
                    <Link
                      href={liveHandoffSteps[0].href}
                      className="mt-4 inline-flex text-sm font-semibold text-ocean-blue underline-offset-2 hover:underline"
                    >
                      {liveHandoffSteps[0].label}
                    </Link>
                  )}
                </div>

                {/* Current month hero card */}
                <div className="flex flex-col items-center gap-6 rounded-lg border border-[#11100D]/15 bg-gradient-to-br from-[#FBF6E8]/95 to-[#EEE3C9]/75 p-6 text-[#11100D] shadow-[0_18px_38px_rgba(17,16,13,0.14)] md:flex-row md:p-8">
                  <AnimatedScoreGauge
                    score={currentMonthData.score}
                    size="xl"
                    showLabel
                  />
                  <div className="text-center md:text-left">
                    <p className="mb-1 text-sm font-medium uppercase tracking-wide text-[#655C4C]">
                      Seasonal pattern in {currentMonthData.monthName}
                    </p>
                    <p className="mb-2 text-3xl font-bold text-[#11100D] md:text-4xl">
                      {currentMonthData.monthName}
                    </p>
                    <p className="max-w-md text-[#655C4C]">
                      {currentMonthData.bestMonthCount > 0
                        ? `${currentMonthData.bestMonthCount} of ${data.totalBeaches} beaches are in peak season right now.`
                        : `${cityName} is between peak seasons right now.`}
                      {currentStateMonth
                        ? ` Expect ${currentStateMonth.waveHeightRange} waves and ${currentStateMonth.waterTemp}°F water.`
                        : data.waterTempRange
                          ? ` Water temperatures range ${data.waterTempRange}°F year-round.`
                          : ""}
                      {data.peakMonth !== currentMonthIndex + 1
                        ? ` Peak month: ${data.peakMonthName}.`
                        : ""}
                    </p>
                  </div>
                </div>
              </div>
              {heroScene && (
                <SeoScenePanel
                  scene={heroScene}
                  priority
                  mediaClassName="h-full min-h-[300px] lg:min-h-full"
                />
              )}
            </div>
          </header>
        </ScrollReveal>

        <SeoFunnelNextSteps
          variant="paper"
          title={`Turn ${cityName}'s season guide into today's surf call`}
          description="The calendar shows when this zone usually works. Start with the live report before you load boards."
          steps={liveHandoffSteps}
          className="mb-12"
        />

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

        {/* Monthly Breakdown Grid / Heatmap */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Monthly Breakdown
          </h2>
          <MonthlyViewToggle
            monthly={data.monthly}
            waterTempRange={data.waterTempRange}
            summerWetsuit={data.summerWetsuit}
            winterWetsuit={data.winterWetsuit}
            stateMonthly={stateProfile?.monthly}
            peakMonths={stateProfile?.peakMonths}
            stateName={stateName}
          />
        </section>

        {/* Dawn Patrol vs Afternoon */}
        <ScrollReveal>
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Dawn Patrol vs Afternoon Sessions
            </h2>
            {sessionScene && (
              <SeoScenePanel
                scene={sessionScene}
                className="mb-4"
                mediaClassName="aspect-auto h-[240px] sm:h-[280px] lg:h-[320px]"
              />
            )}
            <div className="grid gap-4 md:grid-cols-2">
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
                        <div className="flex items-start gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#252D6B]/10 text-[#252D6B]">
                            <Waves className="h-5 w-5" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
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
                            {beach.bestMonths.length > 0 && (
                              <p className="mt-2 text-xs text-gray-500">
                                Peak: {beach.bestMonths
                                  .map((m) => MONTH_ABBREVS[m - 1])
                                  .join(", ")}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollReveal>
            </section>
          </ScrollReveal>
        )}

        <InlineSignupCta
          title={`Save ${cityName}'s best surf windows`}
          description={`Dawn patrol, after work, weekends. We'll ping you when ${cityName} lines up for your session.`}
          primaryButtonText="Save best windows"
          source={`best-time-${citySlug}-inline`}
          ctaCopyVariant="city_specific_v1"
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
            {INTENT_DEFINITIONS.filter(
              (intent) => !excludeIntents.includes(intent.key as IntentKey)
            ).map((intent) => (
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
          excludeIntents={excludeIntents.length > 0 ? excludeIntents : undefined}
        />
      </div>
      <StickySignupBar
        source={`best-time-${citySlug}`}
        ctaText="Save Window"
        supportingText={`Best surf windows for ${cityName}`}
      />
    </div>
  );
}
