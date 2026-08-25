import Link from "next/link";
import { ChevronLeft, MapPin } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";

import {
  SURF_INTENTS,
  type SurfIntentSlug,
} from "@/lib/constants/surf-intents";
import type { SurfSpot } from "@/lib/data/surf-spots";
import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { FAQSection } from "@/components/seo/faq-schema";
import { ItemListSchema } from "@/components/seo/item-list-schema";
import { generateIntentFAQ } from "@/lib/seo/intent-faq-generator";
import { CityMapView } from "@/components/city/city-map-view";
import type { BeachWithMetrics } from "@/types/location";
import { isValidStateSlug, getUsStateDisplayNameFromSlug, COASTAL_STATE_SUFFIXES, buildBeachUrl, cityToSlug } from "@/lib/utils/beach-url-utils";
import { parseLocationFromSlug } from "@/lib/utils/location-slug";
import { getBeachesByIntentAndCity, getBeachesByIntentAndState } from "@/actions/beach/beach-query-actions";
import { transformBeachesToSurfSpots } from "@/lib/utils/beach-to-surfspot-transformer";
import { StateMapView } from "@/components/state/state-map-view";
import { findCityBySlug, getCityMetadata, getCityBeachEditorialData, getCityExcludeIntents, type CityMetadata } from "@/actions/city/city-metadata-actions";
import { buildIntentPageContent } from "@/lib/seo/intent-content-templates";
import { buildLocationPlaceStructuredData } from "@/lib/seo/location-structured-data";
import { getTopCitiesInState, getTopCitiesInStateForIntent } from "@/actions/beach/beach-location-actions";
import { buildCitySlug } from "@/lib/seo/city-slug-utils";
import { COLLISION_CITY_MAP } from "@/lib/seo/city-collision-list";
import {
  PopularCitiesForIntent,
  TideOverviewSection,
  TidePageContent,
  WaterTempOverviewSection,
  TodaysIntentPlan,
  SmartChecklist,
  MiniLogTeaser,
  BeachEditorialSection,
  WaterTempPageContent,
  DawnPatrolPageContent,
  SunsetPageContent,
  ConditionsStateOverview,
} from "@/components/intent";
import { CTASection } from "@/components/landing-page/cta-section";
import { SeoScenePanel } from "@/components/seo/seo-scene-panel";
import { SeoFunnelNextSteps } from "@/components/seo/seo-funnel-next-steps";
import { SeoLocationPage } from "@/components/seo/funnel/SeoLocationPage";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";
import type { IntentKey } from "@/lib/constants/intent-definitions";
import { isConditionsIntent } from "@/lib/constants/intent-definitions";
import {
  getCityIntentSeoScene,
  getCityIntentPlanSeoScene,
  getStateIntentSeoScene,
} from "@/lib/constants/seo-scenes";
import { ContinueExploring } from "@/components/shared/continue-exploring";
import { IntentGuidesGrid } from "@/components/shared/intent-guides-grid";
import { ZeroState } from "@/components/ui/zero-state";
import {
  getCityTideData,
  getCityTideDataExpanded,
  getCityIntentDataAvailability,
  getCityWaterTempHistory,
  getIntentForecastSummary,
  getCityWaterTempExpanded,
  getCitySunTimesData,
  type CityIntentDataAvailability,
  type CityTideData,
  type CityTideDataExpanded,
  type CityWaterTempData,
  type CityWaterTempExpanded,
  type CitySunTimesData,
} from "@/actions/forecast/intent-forecast-actions";
import { findCitiesMatchingPattern } from "@/actions/city/city-metadata-actions";
import {
  getBeginnerConditionsData,
  getBeginnerBeachesWithEditorial,
  getBeginnerCityEditorial,
} from "@/actions/beginner/beginner-actions";
import { BeginnerPageContent } from "@/components/beginner/BeginnerPageContent";
import { getBestTimeToSurfUrl } from "@/lib/utils/best-time-to-surf-utils";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { WaterTempDatasetSchema } from "@/components/seo/water-temp-dataset-schema";
import { getSeoFunnelPageByIntentRoute } from "@/lib/seo/funnel-pages";
import { getCityEditorialContent } from "@/actions/city/city-editorial-actions";
import {
  applyIndexabilityToMetadata,
  evaluateCityDataIntentIndexability,
  evaluateCityEditorialIndexability,
  isDataBackedCityIntent,
  toCityEditorialInput,
} from "@/lib/seo/indexability";
import { ReviewedCityEditorialSection } from "@/components/seo/reviewed-city-editorial-section";

// Hold transitions explicitly revalidate every affected intent path.
export const dynamic = "force-static";
export const revalidate = 3600;

/**
 * Try to resolve a city slug with automatic state suffix detection.
 * Uses a single batched database query instead of 13 parallel queries to avoid
 * connection pool exhaustion under concurrent load.
 *
 * @param baseSlug - The city slug without state suffix (e.g., "belmar")
 * @returns Object with cityMetadata and the resolved slug, or nulls if not found
 */
const resolveCityWithStateSuffix = cache(async function resolveCityWithStateSuffix(
  baseSlug: string
): Promise<{ cityMetadata: CityMetadata | null; resolvedSlug: string }> {
  // First try the base slug directly (e.g., "santa-cruz" or "newport-ca")
  const baseResult = await findCityBySlug(baseSlug);
  if (baseResult.success && baseResult.data) {
    return { cityMetadata: baseResult.data, resolvedSlug: baseSlug };
  }

  // If already has state suffix, don't try adding more
  if (baseSlug.match(/-[a-z]{2}$/)) {
    return { cityMetadata: null, resolvedSlug: baseSlug };
  }

  // Find all cities matching the pattern across all states with a SINGLE query
  const citiesResult = await findCitiesMatchingPattern(baseSlug);
  if (!citiesResult.success || !citiesResult.data || citiesResult.data.length === 0) {
    return { cityMetadata: null, resolvedSlug: baseSlug };
  }

  // Filter to only coastal states and sort by priority (COASTAL_STATE_SUFFIXES order)
  const coastalStateSet = new Set(COASTAL_STATE_SUFFIXES.map(s => s.toUpperCase()));
  const coastalCities = citiesResult.data
    .filter((c) => coastalStateSet.has(c.state))
    .sort((a, b) => {
      const aIndex = COASTAL_STATE_SUFFIXES.indexOf(a.state.toLowerCase() as any);
      const bIndex = COASTAL_STATE_SUFFIXES.indexOf(b.state.toLowerCase() as any);
      return aIndex - bIndex;
    });

  if (coastalCities.length === 0) {
    return { cityMetadata: null, resolvedSlug: baseSlug };
  }

  // Get full metadata for the first (highest priority) match
  const topMatch = coastalCities[0];
  const resolvedSlug = buildCitySlug(topMatch.city, topMatch.state, COLLISION_CITY_MAP);

  const metadataResult = await getCityMetadata(topMatch.city, topMatch.state);
  if (!metadataResult.success || !metadataResult.data) {
    return { cityMetadata: null, resolvedSlug: baseSlug };
  }

  return {
    cityMetadata: metadataResult.data,
    resolvedSlug: resolvedSlug || baseSlug,
  };
});

/**
 * Shared empty state component for intent pages.
 * Shows when no beaches match the intent criteria for a location.
 */
interface IntentEmptyStateProps {
  intentLabel: string;
  locationName: string;
  stateSlug?: string;
  stateName?: string;
}

function IntentEmptyState({
  intentLabel,
  locationName,
  stateSlug,
  stateName
}: IntentEmptyStateProps) {
  return (
    <section className="mb-8">
      <ZeroState
        icon={MapPin}
        title={`No ${intentLabel.toLowerCase()} spots found in ${locationName}`}
        description={
          stateSlug && stateName
            ? "We're expanding our coverage. Explore other regions or browse all surf spots."
            : `Explore other categories or browse all surf spots in ${locationName}.`
        }
        action={{
          label: "Explore the Map",
          href: "/map",
        }}
        secondaryAction={
          stateSlug && stateName
            ? {
                label: `All ${stateName} Beaches`,
                href: `/beaches/usa/${stateSlug}`,
              }
            : undefined
        }
      />
    </section>
  );
}

const BEGINNER_INTENTS = new Set(["beginner", "longboard"]);
const STATE_INTENT_SLUG_ALIASES: Record<string, string> = {
  "puerto-rico": "pr",
};

/** Intents that may return zero beaches and should noindex at state level when empty */
const NOINDEX_WHEN_EMPTY_INTENTS = new Set(["beginner", "longboard", "least-crowded"]);

// NOTE: generateStaticParams is not used; pages render on demand and use ISR.
// State-level routes (e.g., /beginner/ca) are handled by the dynamic catch-all.

interface IntentPageParams {
  // NOTE: although this page is primarily for surf intents, this route also
  // receives legacy 2-segment state/city URLs (e.g. /ca/encinitas).
  params: Promise<{ intent: string; city: string }>;
}

export async function generateMetadata(props: IntentPageParams): Promise<Metadata> {
  const params = await props.params;

  // State intent pages have not received independently reviewed state-level
  // editorial content. Check this before funnel-page lookups because a funnel
  // page may share the same two-segment route.
  if (isValidStateSlug(params.city) && SURF_INTENTS[params.intent as SurfIntentSlug]) {
    const stateName = getUsStateDisplayNameFromSlug(params.city);
    const definition = SURF_INTENTS[params.intent as SurfIntentSlug];
    const metadata = buildPageMetadata({
      title: `${definition.label} Spots in ${stateName}`,
      description: `Find the best ${definition.label.toLowerCase()} surf spots across ${stateName}. Live conditions, crowd data & surf windows — updated hourly.`,
      path: `/${params.intent}/${params.city}`,
      image: `/api/og/intent?intent=${params.intent}&city=${encodeURIComponent(stateName)}`,
    });
    return { ...metadata, robots: { index: false, follow: true } };
  }

  const seoFunnelPage = getSeoFunnelPageByIntentRoute(params.intent, params.city);
  if (seoFunnelPage) {
    return buildPageMetadata({
      title: seoFunnelPage.title,
      description: seoFunnelPage.metaDescription,
      path: seoFunnelPage.path,
      image: seoFunnelPage.heroImage.src,
    });
  }

  // If this is a legacy state/city URL, we redirect in the page render.
  // Metadata can't redirect, so just avoid surf-intent metadata generation.
  if (isValidStateSlug(params.intent)) {
    const cityName = parseLocationFromSlug(params.city);
    const metadata = buildPageMetadata({
      title: `Surf spots in ${cityName}`,
      description: `Open the surf map filtered to ${cityName}.`,
      path: `/${params.intent}/${params.city}`,
    });
    return {
      ...metadata,
      robots: {
        index: false,
        follow: true,
        googleBot: { index: false, follow: true },
      },
    };
  }

  // Database-driven city metadata
  const definition = SURF_INTENTS[params.intent as SurfIntentSlug];
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

  // Unknown intent: return 404-safe metadata with self-referential canonical
  // This prevents Google from selecting an arbitrary canonical URL
  if (!definition) {
    return {
      title: "Page Not Found",
      description: "This page could not be found.",
      alternates: {
        canonical: `${baseUrl}/${params.intent}/${params.city}`,
      },
      robots: { index: false, follow: true },
    };
  }

  // Resolve city with automatic state suffix detection (parallel lookup for performance)
  const { cityMetadata, resolvedSlug: canonicalCitySlug } =
    await resolveCityWithStateSuffix(params.city);

  // City lookup failed: return 404-safe metadata with self-referential canonical
  // CRITICAL: Without this, Google picks an arbitrary canonical (e.g., /tide/hull for /beginner/nags-head)
  if (!cityMetadata) {
    return {
      title: "Page Not Found",
      description: "This page could not be found.",
      alternates: {
        canonical: `${baseUrl}/${params.intent}/${params.city}`,
      },
      robots: { index: false, follow: true },
    };
  }

  let excludedCityIntents: IntentKey[] = [];
  if (NOINDEX_WHEN_EMPTY_INTENTS.has(params.intent)) {
    try {
      excludedCityIntents = await getCityExcludeIntents(
        cityMetadata.cityName,
        cityMetadata.state
      );
    } catch {
      // Fail-open: allow indexing if the eligibility lookup is unavailable.
    }
  }

  // For tide/water-temp intents, fetch live data to inject into meta description
  let tideDataForMeta: CityTideData | null = null;
  let waterTempDataForMeta: CityWaterTempData | null = null;
  let intentDataAvailability: CityIntentDataAvailability = "available";
  if (params.intent === "tide") {
    tideDataForMeta = await getCityTideData(cityMetadata.cityName, cityMetadata.state);
    intentDataAvailability = tideDataForMeta
      ? "available"
      : await getCityIntentDataAvailability("tide", cityMetadata.cityName, cityMetadata.state);
  } else if (params.intent === "water-temp") {
    waterTempDataForMeta = await getCityWaterTempHistory(cityMetadata.cityName, cityMetadata.state);
    intentDataAvailability = waterTempDataForMeta
      ? "available"
      : await getCityIntentDataAvailability("water-temp", cityMetadata.cityName, cityMetadata.state);
  }

  const pageContent = buildIntentPageContent(
    params.intent as SurfIntentSlug,
    cityMetadata,
    {
      tideData: tideDataForMeta ? { nextTideType: tideDataForMeta.nextTideType, nextTideTime: tideDataForMeta.nextTideTime, nextTideHeight: tideDataForMeta.nextTideHeight } : null,
      waterTempData: waterTempDataForMeta ? { currentTemp: waterTempDataForMeta.currentTemp } : null,
    }
  );

  // Determine if this skill-intent will produce results based on city skill counts
  const hasMatchingBeaches = (() => {
    if (params.intent === "beginner" || params.intent === "longboard") {
      return cityMetadata.beginnerCount > 0;
    }
    if (params.intent === "advanced") {
      return cityMetadata.advancedCount > 0;
    }
    return true; // Non-skill intents always have results
  })();

  const intentKeywords: Record<string, string[]> = {
    beginner: [`best beginner surf spots ${cityMetadata.cityName}`, `learn to surf ${cityMetadata.cityName}`, `where to learn to surf ${cityMetadata.cityName}`, `easy surf spots ${cityMetadata.cityName}`],
    "least-crowded": [`least crowded surf spots ${cityMetadata.cityName}`, `uncrowded surf ${cityMetadata.cityName}`, `where to surf today ${cityMetadata.cityName}`, `best surf today ${cityMetadata.cityName}`],
    "dawn-patrol": [`best time to surf ${cityMetadata.cityName}`, `best time to surf today ${cityMetadata.cityName}`, `dawn patrol ${cityMetadata.cityName}`, `surf forecast ${cityMetadata.cityName}`],
    tide: [`${cityMetadata.cityName} tide chart`, `${cityMetadata.cityName} tide chart today`, `${cityMetadata.cityName} high tide today`],
    "water-temp": [`${cityMetadata.cityName} water temperature`, `water temp ${cityMetadata.cityName}`, `what wetsuit for ${cityMetadata.cityName}`],
    longboard: [`best longboard waves ${cityMetadata.cityName}`, `longboard spots ${cityMetadata.cityName}`, `mellow waves ${cityMetadata.cityName}`],
    sunset: [`sunset surf ${cityMetadata.cityName}`, `best time to surf today ${cityMetadata.cityName}`, `after work surf ${cityMetadata.cityName}`],
  };
  const keywords = [
    ...(intentKeywords[params.intent] || [`${cityMetadata.cityName} ${definition.label}`, `${cityMetadata.cityName} surf`]),
    "surf report",
    "surf forecast",
    "surf conditions today",
  ];

  const metadata = buildPageMetadata({
    title: pageContent.title,
    description: pageContent.metaDescription,
    path: `/${params.intent}/${canonicalCitySlug}`,
    keywords,
    image: `/api/og/intent?intent=${params.intent}&city=${encodeURIComponent(cityMetadata.cityName)}`,
  });

  const cityEditorial = await getCityEditorialContent(
    cityToSlug(cityMetadata.cityName),
    cityMetadata.state.toLowerCase(),
    "usa",
    params.intent as SurfIntentSlug,
  );
  const dataRich =
    hasMatchingBeaches &&
    intentDataAvailability !== "missing" &&
    !excludedCityIntents.includes(params.intent as IntentKey);
  const canonicalPath = `/${params.intent}/${canonicalCitySlug}`;
  const decision = isDataBackedCityIntent(params.intent)
    ? evaluateCityDataIntentIndexability(
        toCityEditorialInput(cityEditorial),
        canonicalPath,
        {
          hasIntentData:
            params.intent === "tide"
              ? tideDataForMeta != null
              : waterTempDataForMeta != null,
          dataRich,
        },
      )
    : evaluateCityEditorialIndexability(
        toCityEditorialInput(cityEditorial),
        params.intent,
        canonicalPath,
        dataRich,
      );

  return applyIndexabilityToMetadata(metadata, decision);
}

export default async function IntentPage(props: IntentPageParams) {
  const params = await props.params;
  const definition = SURF_INTENTS[params.intent as SurfIntentSlug];
  const stateSlugAlias = STATE_INTENT_SLUG_ALIASES[params.city];

  if (stateSlugAlias && definition) {
    redirect(`/${params.intent}/${stateSlugAlias}`);
  }

  // Legacy 2-segment state/city route: redirect to map filtered by city
  // Examples: /ca/encinitas, /or/newport
  if (isValidStateSlug(params.intent)) {
    const cityName = parseLocationFromSlug(params.city);
    const redirectTo = `/map?search=${encodeURIComponent(cityName)}`;

    redirect(redirectTo);
  }

  const seoFunnelPage = getSeoFunnelPageByIntentRoute(params.intent, params.city);
  if (seoFunnelPage) {
    return <SeoLocationPage page={seoFunnelPage} />;
  }

  // Check if this is a state-level intent page like /beginner/ca
  if (isValidStateSlug(params.city) && SURF_INTENTS[params.intent as SurfIntentSlug]) {
    const stateName = getUsStateDisplayNameFromSlug(params.city);
    const intentDefinition = SURF_INTENTS[params.intent as SurfIntentSlug];

    const beachesResult = await getBeachesByIntentAndState(params.intent, params.city);
    const beaches = beachesResult.success && beachesResult.data ? beachesResult.data : [];
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";
    const stateScene = getStateIntentSeoScene(params.intent, params.city);

    // Fetch all cities in this state for PopularCitiesForIntent component.
    // No explicit limit — uses default of 100 so all qualifying cities are
    // server-rendered for crawl discovery (two-tier display handles visual hierarchy).
    // For skill/crowd intents, filter to cities that actually have matching beaches
    // to prevent linking to city pages that would 404.
    const topCities = ["least-crowded", "beginner", "longboard"].includes(params.intent)
      ? await getTopCitiesInStateForIntent(params.city, params.intent)
      : await getTopCitiesInState(params.city);

    // Render state-level intent page (with empty state if no beaches)
    const statePageUrl = `${baseUrl.replace(/\/$/, "")}/${params.intent}/${params.city}`;
    return (
      <div className="seo-paper-page">
        {/* Breadcrumb: Home → State → Intent (3 levels) */}
        <BreadcrumbStructuredData
          items={[
            { name: "Home", url: `${baseUrl.replace(/\/$/, "")}/` },
            { name: `${stateName} Surf`, url: `${baseUrl.replace(/\/$/, "")}/beaches/usa/${params.city}` },
            { name: intentDefinition.label, url: statePageUrl },
          ]}
        />
        <ItemListSchema
          items={beaches.map((b, i) => ({
            name: b.name,
            url: `${baseUrl.replace(/\/$/, "")}${buildBeachUrl(b)}`,
            position: i + 1,
          }))}
          name={`${intentDefinition.label} Spots in ${stateName}`}
        />
        {/* WebPage JSON-LD with dateModified signals content freshness to Google */}
        <WebPageSchema
          name={`${intentDefinition.label} Surf Spots in ${stateName}`}
          url={statePageUrl}
          description={`Find the best ${intentDefinition.label.toLowerCase()} surf spots across ${stateName}. Live conditions, crowd data & surf windows — updated hourly.`}
        />
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <header className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,460px)] lg:items-stretch">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-800">
                {intentDefinition.heading({ cityName: stateName })}
              </h1>
              <p className="text-lg text-gray-600 mt-2">
                {beaches.length} spots across {stateName}
              </p>
              <p className="text-base text-gray-700 mt-4">
                {intentDefinition.intro({ cityName: stateName, stateSlug: params.city })}
              </p>
            </div>
            {stateScene && (
              <SeoScenePanel
                scene={stateScene}
                priority
                mediaClassName="h-full min-h-[300px] lg:min-h-full"
              />
            )}
          </header>

          {beaches.length === 0 ? (
            <IntentEmptyState
              intentLabel={intentDefinition.label}
              locationName={stateName}
              stateSlug={params.city}
              stateName={stateName}
            />
          ) : (
            <>
              <section className="mb-8">
                <StateMapView
                  beaches={beaches}
                  ariaLabel={`${intentDefinition.label} spots in ${stateName}`}
                />
              </section>

              {/* Conditions overview or Popular Cities - Links DOWN to city intent pages */}
              {topCities.length > 0 && (
                <section className="mt-8">
                  {isConditionsIntent(params.intent as IntentKey) && params.intent !== "tide" ? (
                    <ConditionsStateOverview
                      intentKey={params.intent as IntentKey}
                      stateName={stateName}
                      stateSlug={params.city}
                    />
                  ) : (
                    <PopularCitiesForIntent
                      intentKey={params.intent as IntentKey}
                      intentLabel={intentDefinition.label}
                      stateName={stateName}
                      cities={topCities}
                    />
                  )}
                </section>
              )}

              <SeoFunnelNextSteps
                variant="paper"
                title={`Keep planning ${stateName}`}
                description={`Use this ${intentDefinition.label.toLowerCase()} page as the filter, then narrow down by city, map, or conditions guide.`}
                steps={[
                  {
                    label: `Browse ${stateName} surf cities`,
                    href: `/beaches/usa/${params.city}`,
                    description: "See every indexed surf city and break in the state.",
                  },
                  {
                    label: `Open the ${stateName} surf map`,
                    href: `/map?search=${encodeURIComponent(stateName)}`,
                    description: "Scan the map when you want nearby options quickly.",
                  },
                  {
                    label: `Check water temperature guides`,
                    href: `/water-temp/${params.city}`,
                    description: "Compare gear and water-temperature context statewide.",
                  },
                ]}
                className="mt-8"
              />

              {/* Cross-intent navigation */}
              <IntentGuidesGrid
                locationSlug={params.city}
                locationName={stateName}
                locationType="state"
                currentIntent={params.intent as IntentKey}
              />
            </>
          )}

          {/* Visible FAQ section (includes JSON-LD structured data) */}
          <FAQSection
            items={generateIntentFAQ(
              params.intent as SurfIntentSlug,
              stateName,
              beaches.slice(0, 3).map((b) => b.name),
              params.city
            )}
            locationName={stateName}
          />
        </div>
      </div>
    );
  }

  // Database-driven city resolution with automatic state suffix detection (parallel lookup)
  // This handles cases where sitemap has "/beginner/nags-head-nc" but user accesses "/beginner/nags-head"
  // NOTE: We serve content directly instead of redirecting to avoid redirect chains that Google flags
  const { cityMetadata } = await resolveCityWithStateSuffix(params.city);

  if (!cityMetadata || !definition) {
    return notFound();
  }

  // Beginner intent: use dedicated page component with editorial + live conditions
  if (params.intent === "beginner") {
    const stateSlugLower = cityMetadata.state.toLowerCase();
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

    const [conditionsData, beaches, cityEditorial, reviewedEditorial, bestTimeToSurfUrl, excludeIntents] =
      await Promise.all([
        getBeginnerConditionsData(params.city, stateSlugLower),
        getBeginnerBeachesWithEditorial(params.city, stateSlugLower),
        getBeginnerCityEditorial(params.city, stateSlugLower),
        getCityEditorialContent(cityToSlug(cityMetadata.cityName), stateSlugLower, "usa", "beginner"),
        getBestTimeToSurfUrl(params.city, cityMetadata.cityName, cityMetadata.state),
        getCityExcludeIntents(cityMetadata.cityName, cityMetadata.state),
      ]);

    const { badge: conditionsBadge, rightNow: rightNowConditions } = conditionsData;

    const safeBaseUrl = baseUrl.replace(/\/$/, "");
    const pageUrl = `${safeBaseUrl}/beginner/${params.city}`;

    // Build Place schema with city geo coordinates for crawlers
    const beginnerPlaceSchema = buildLocationPlaceStructuredData({
      city: cityMetadata.cityName,
      state: cityMetadata.stateName,
      topBeaches: beaches.map((b) => ({
        name: b.name,
        url: `${safeBaseUrl}${buildBeachUrl(b)}`,
      })),
      centerLat: cityMetadata.centerLat,
      centerLon: cityMetadata.centerLon,
    });

    return (
      <>
        <ReviewedCityEditorialSection editorial={reviewedEditorial} />
        {/* Place JSON-LD — exposes geo data to crawlers (Mapbox canvas is not crawlable) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(beginnerPlaceSchema) }}
        />
        {/* ItemList JSON-LD for Google carousel SERP features */}
        <ItemListSchema
          items={beaches.map((b, i) => ({
            name: b.name,
            url: `${safeBaseUrl}${buildBeachUrl(b)}`,
            position: i + 1,
          }))}
          name={`Beginner Surf Spots in ${cityMetadata.cityName}`}
        />
        {/* WebPage JSON-LD with dateModified for freshness signal */}
        <WebPageSchema
          name={`Beginner Surf Spots in ${cityMetadata.cityName}`}
          url={pageUrl}
        />
        <BeginnerPageContent
          cityName={cityMetadata.cityName}
          citySlug={params.city}
          stateSlug={stateSlugLower}
          stateName={cityMetadata.stateName}
          regionLabel={`${cityMetadata.cityName}, ${cityMetadata.stateName}`}
          conditionsBadge={conditionsBadge}
          rightNowConditions={rightNowConditions}
          beaches={beaches}
          cityEditorial={cityEditorial}
          totalBeaches={beaches.length}
          baseUrl={baseUrl}
          bestTimeToSurfUrl={bestTimeToSurfUrl}
          excludeIntents={excludeIntents.length > 0 ? excludeIntents : undefined}
        />
      </>
    );
  }

  // Tide intent: use dedicated page component with 7-day data + beach preferences
  if (params.intent === "tide") {
    const stateSlugLower = cityMetadata.state.toLowerCase();
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";
    const tidePageContent = buildIntentPageContent("tide", cityMetadata);

    const [expandedTideData, tideBeachesResult, bestTimeToSurfUrl, excludeIntents] = await Promise.all([
      getCityTideDataExpanded(cityMetadata.cityName, cityMetadata.state),
      getBeachesByIntentAndCity("tide", cityMetadata.cityName, stateSlugLower),
      getBestTimeToSurfUrl(params.city, cityMetadata.cityName, cityMetadata.state),
      getCityExcludeIntents(cityMetadata.cityName, cityMetadata.state),
    ]);

    // If expanded data unavailable, fall through to generic intent flow
    if (expandedTideData) {
      const tideBeaches = tideBeachesResult.success && tideBeachesResult.data
        ? tideBeachesResult.data
        : [];
      const tideBeachesWithMetrics: BeachWithMetrics[] = tideBeaches.map((beach) => ({
        ...beach,
        compositeScore: 0,
        recentIntelCount: 0,
        avgConfirmations: 0,
      }));
      const tideSpots: SurfSpot[] = transformBeachesToSurfSpots(tideBeachesWithMetrics);

      const safeBaseUrl = baseUrl.replace(/\/$/, "");
      const tidePageUrl = `${safeBaseUrl}/tide/${params.city}`;

      // Build Place schema with city geo coordinates for crawlers
      const tidePlaceSchema = buildLocationPlaceStructuredData({
        city: cityMetadata.cityName,
        state: cityMetadata.stateName,
        topBeaches: tideBeaches.map((b) => ({
          name: b.name,
          url: `${safeBaseUrl}${buildBeachUrl(b)}`,
        })),
        centerLat: cityMetadata.centerLat,
        centerLon: cityMetadata.centerLon,
        beachGeoData: tideBeaches.map((b) => ({
          name: b.name,
          url: `${safeBaseUrl}${buildBeachUrl(b)}`,
          lat: b.lat ?? null,
          lon: b.lon ?? null,
        })),
      });

      const reviewedEditorial = await getCityEditorialContent(cityToSlug(cityMetadata.cityName), cityMetadata.state.toLowerCase(), "usa", "tide");
      return (
        <>
          <ReviewedCityEditorialSection editorial={reviewedEditorial} />
          {/* Place JSON-LD — exposes geo data to crawlers */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(tidePlaceSchema) }}
          />
          {/* ItemList JSON-LD for Google carousel SERP features */}
          <ItemListSchema
            items={tideBeaches.map((b, i) => ({
              name: b.name,
              url: `${safeBaseUrl}${buildBeachUrl(b)}`,
              position: i + 1,
            }))}
            name={`Tide Conditions for ${cityMetadata.cityName} Surf Spots`}
          />
          {/* WebPage JSON-LD with dateModified for freshness signal */}
          <WebPageSchema
            name={tidePageContent.title}
            url={tidePageUrl}
          />
          <TidePageContent
            cityName={cityMetadata.cityName}
            citySlug={params.city}
            stateSlug={stateSlugLower}
            stateName={cityMetadata.stateName}
            regionLabel={`${cityMetadata.cityName}, ${cityMetadata.stateName}`}
            pageContent={tidePageContent}
            tideData={expandedTideData}
            spots={tideSpots}
            updatedAt="Refreshed hourly"
            baseUrl={baseUrl}
            bestTimeToSurfUrl={bestTimeToSurfUrl}
            excludeIntents={excludeIntents.length > 0 ? excludeIntents : undefined}
          />
        </>
      );
    }
    // Fall through to generic intent flow if expanded data unavailable
  }

  // Water-temp intent: use dedicated page component with expanded data
  if (params.intent === "water-temp") {
    const stateSlugLower = cityMetadata.state.toLowerCase();
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

    const [expandedWaterTempData, waterTempBeachesResult, bestTimeToSurfUrl, editorialBeaches, excludeIntents] = await Promise.all([
      getCityWaterTempExpanded(cityMetadata.cityName, cityMetadata.state),
      getBeachesByIntentAndCity("water-temp", cityMetadata.cityName, stateSlugLower),
      getBestTimeToSurfUrl(params.city, cityMetadata.cityName, cityMetadata.state),
      getCityBeachEditorialData(cityMetadata.cityName, cityMetadata.state),
      getCityExcludeIntents(cityMetadata.cityName, cityMetadata.state),
    ]);

    // If expanded data available, render dedicated water-temp page
    if (expandedWaterTempData) {
      const waterTempPageContent = buildIntentPageContent("water-temp", cityMetadata, {
        waterTempData: { currentTemp: expandedWaterTempData.currentTemp },
      });
      const waterTempBeaches = waterTempBeachesResult.success && waterTempBeachesResult.data
        ? waterTempBeachesResult.data
        : [];
      const waterTempBeachesWithMetrics: BeachWithMetrics[] = waterTempBeaches.map((beach) => ({
        ...beach,
        compositeScore: 0,
        recentIntelCount: 0,
        avgConfirmations: 0,
      }));
      const waterTempSpots: SurfSpot[] = transformBeachesToSurfSpots(waterTempBeachesWithMetrics);

      const safeBaseUrl = baseUrl.replace(/\/$/, "");
      const waterTempPageUrl = `${safeBaseUrl}/water-temp/${params.city}`;

      const waterTempPlaceSchema = buildLocationPlaceStructuredData({
        city: cityMetadata.cityName,
        state: cityMetadata.stateName,
        topBeaches: waterTempBeaches.map((b) => ({
          name: b.name,
          url: `${safeBaseUrl}${buildBeachUrl(b)}`,
        })),
        centerLat: cityMetadata.centerLat,
        centerLon: cityMetadata.centerLon,
        beachGeoData: waterTempBeaches.map((b) => ({
          name: b.name,
          url: `${safeBaseUrl}${buildBeachUrl(b)}`,
          lat: b.lat ?? null,
          lon: b.lon ?? null,
        })),
      });

      const reviewedEditorial = await getCityEditorialContent(cityToSlug(cityMetadata.cityName), cityMetadata.state.toLowerCase(), "usa", "water-temp");
      return (
        <>
          <ReviewedCityEditorialSection editorial={reviewedEditorial} />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(waterTempPlaceSchema) }}
          />
          <ItemListSchema
            items={waterTempBeaches.map((b, i) => ({
              name: b.name,
              url: `${safeBaseUrl}${buildBeachUrl(b)}`,
              position: i + 1,
            }))}
            name={`Water Temperature for ${cityMetadata.cityName} Surf Spots`}
          />
          <WebPageSchema
            name={waterTempPageContent.title}
            url={waterTempPageUrl}
          />
          <WaterTempDatasetSchema
            cityOrBeachName={cityMetadata.cityName}
            state={cityMetadata.state}
            url={waterTempPageUrl}
            latitude={cityMetadata.centerLat}
            longitude={cityMetadata.centerLon}
            tempF={expandedWaterTempData.currentTemp}
            wetsuitRec={expandedWaterTempData.wetsuitRecommendation.thickness}
          />
          <WaterTempPageContent
            cityName={cityMetadata.cityName}
            citySlug={params.city}
            stateSlug={stateSlugLower}
            stateName={cityMetadata.stateName}
            regionLabel={`${cityMetadata.cityName}, ${cityMetadata.stateName}`}
            pageContent={waterTempPageContent}
            waterTempData={expandedWaterTempData}
            spots={waterTempSpots}
            baseUrl={baseUrl}
            bestTimeToSurfUrl={bestTimeToSurfUrl}
            editorialBeaches={editorialBeaches}
            excludeIntents={excludeIntents.length > 0 ? excludeIntents : undefined}
          />
        </>
      );
    }
    // Fall through to generic intent flow if expanded data unavailable
  }

  // Dawn-patrol intent: use dedicated page component with sunrise/first light times
  if (params.intent === "dawn-patrol") {
    const stateSlugLower = cityMetadata.state.toLowerCase();
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";
    const dawnPatrolPageContent = buildIntentPageContent("dawn-patrol", cityMetadata);

    const [sunTimesData, dawnPatrolBeachesResult, bestTimeToSurfUrl, editorialBeaches, excludeIntents] = await Promise.all([
      getCitySunTimesData(cityMetadata.cityName, cityMetadata.state),
      getBeachesByIntentAndCity("dawn-patrol", cityMetadata.cityName, stateSlugLower),
      getBestTimeToSurfUrl(params.city, cityMetadata.cityName, cityMetadata.state),
      getCityBeachEditorialData(cityMetadata.cityName, cityMetadata.state),
      getCityExcludeIntents(cityMetadata.cityName, cityMetadata.state),
    ]);

    if (sunTimesData) {
      const dpBeaches = dawnPatrolBeachesResult.success && dawnPatrolBeachesResult.data
        ? dawnPatrolBeachesResult.data
        : [];
      const dpBeachesWithMetrics: BeachWithMetrics[] = dpBeaches.map((beach) => ({
        ...beach,
        compositeScore: 0,
        recentIntelCount: 0,
        avgConfirmations: 0,
      }));
      const dpSpots: SurfSpot[] = transformBeachesToSurfSpots(dpBeachesWithMetrics);

      const safeBaseUrl = baseUrl.replace(/\/$/, "");
      const dpPageUrl = `${safeBaseUrl}/dawn-patrol/${params.city}`;

      const dpPlaceSchema = buildLocationPlaceStructuredData({
        city: cityMetadata.cityName,
        state: cityMetadata.stateName,
        topBeaches: dpBeaches.map((b) => ({
          name: b.name,
          url: `${safeBaseUrl}${buildBeachUrl(b)}`,
        })),
        centerLat: cityMetadata.centerLat,
        centerLon: cityMetadata.centerLon,
        beachGeoData: dpBeaches.map((b) => ({
          name: b.name,
          url: `${safeBaseUrl}${buildBeachUrl(b)}`,
          lat: b.lat ?? null,
          lon: b.lon ?? null,
        })),
      });

      const reviewedEditorial = await getCityEditorialContent(cityToSlug(cityMetadata.cityName), cityMetadata.state.toLowerCase(), "usa", "dawn-patrol");
      return (
        <>
          <ReviewedCityEditorialSection editorial={reviewedEditorial} />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(dpPlaceSchema) }}
          />
          <ItemListSchema
            items={dpBeaches.map((b, i) => ({
              name: b.name,
              url: `${safeBaseUrl}${buildBeachUrl(b)}`,
              position: i + 1,
            }))}
            name={`Dawn Patrol Spots in ${cityMetadata.cityName}`}
          />
          <WebPageSchema
            name={dawnPatrolPageContent.title}
            url={dpPageUrl}
          />
          <DawnPatrolPageContent
            cityName={cityMetadata.cityName}
            citySlug={params.city}
            stateSlug={stateSlugLower}
            stateName={cityMetadata.stateName}
            regionLabel={`${cityMetadata.cityName}, ${cityMetadata.stateName}`}
            pageContent={dawnPatrolPageContent}
            sunTimesData={sunTimesData}
            spots={dpSpots}
            baseUrl={baseUrl}
            bestTimeToSurfUrl={bestTimeToSurfUrl}
            editorialBeaches={editorialBeaches}
            excludeIntents={excludeIntents.length > 0 ? excludeIntents : undefined}
          />
        </>
      );
    }
    // Fall through to generic intent flow if sun times unavailable
  }

  // Sunset intent: use dedicated page component with sunset/golden hour times
  if (params.intent === "sunset") {
    const stateSlugLower = cityMetadata.state.toLowerCase();
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";
    const sunsetPageContent = buildIntentPageContent("sunset", cityMetadata);

    const [sunTimesData, sunsetBeachesResult, bestTimeToSurfUrl, editorialBeaches, excludeIntents] = await Promise.all([
      getCitySunTimesData(cityMetadata.cityName, cityMetadata.state),
      getBeachesByIntentAndCity("sunset", cityMetadata.cityName, stateSlugLower),
      getBestTimeToSurfUrl(params.city, cityMetadata.cityName, cityMetadata.state),
      getCityBeachEditorialData(cityMetadata.cityName, cityMetadata.state),
      getCityExcludeIntents(cityMetadata.cityName, cityMetadata.state),
    ]);

    if (sunTimesData) {
      const sunsetBeaches = sunsetBeachesResult.success && sunsetBeachesResult.data
        ? sunsetBeachesResult.data
        : [];
      const sunsetBeachesWithMetrics: BeachWithMetrics[] = sunsetBeaches.map((beach) => ({
        ...beach,
        compositeScore: 0,
        recentIntelCount: 0,
        avgConfirmations: 0,
      }));
      const sunsetSpots: SurfSpot[] = transformBeachesToSurfSpots(sunsetBeachesWithMetrics);

      const safeBaseUrl = baseUrl.replace(/\/$/, "");
      const sunsetPageUrl = `${safeBaseUrl}/sunset/${params.city}`;

      const sunsetPlaceSchema = buildLocationPlaceStructuredData({
        city: cityMetadata.cityName,
        state: cityMetadata.stateName,
        topBeaches: sunsetBeaches.map((b) => ({
          name: b.name,
          url: `${safeBaseUrl}${buildBeachUrl(b)}`,
        })),
        centerLat: cityMetadata.centerLat,
        centerLon: cityMetadata.centerLon,
        beachGeoData: sunsetBeaches.map((b) => ({
          name: b.name,
          url: `${safeBaseUrl}${buildBeachUrl(b)}`,
          lat: b.lat ?? null,
          lon: b.lon ?? null,
        })),
      });

      const reviewedEditorial = await getCityEditorialContent(cityToSlug(cityMetadata.cityName), cityMetadata.state.toLowerCase(), "usa", "sunset");
      return (
        <>
          <ReviewedCityEditorialSection editorial={reviewedEditorial} />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(sunsetPlaceSchema) }}
          />
          <ItemListSchema
            items={sunsetBeaches.map((b, i) => ({
              name: b.name,
              url: `${safeBaseUrl}${buildBeachUrl(b)}`,
              position: i + 1,
            }))}
            name={`Sunset Spots in ${cityMetadata.cityName}`}
          />
          <WebPageSchema
            name={sunsetPageContent.title}
            url={sunsetPageUrl}
          />
          <SunsetPageContent
            cityName={cityMetadata.cityName}
            citySlug={params.city}
            stateSlug={stateSlugLower}
            stateName={cityMetadata.stateName}
            regionLabel={`${cityMetadata.cityName}, ${cityMetadata.stateName}`}
            pageContent={sunsetPageContent}
            sunTimesData={sunTimesData}
            spots={sunsetSpots}
            baseUrl={baseUrl}
            bestTimeToSurfUrl={bestTimeToSurfUrl}
            editorialBeaches={editorialBeaches}
            excludeIntents={excludeIntents.length > 0 ? excludeIntents : undefined}
          />
        </>
      );
    }
    // Fall through to generic intent flow if sun times unavailable
  }

  // Generate content from templates
  const pageContent = buildIntentPageContent(params.intent as SurfIntentSlug, cityMetadata);

  // Parallelize data fetching: beaches + intent-specific data + editorial run concurrently
  const [beachesResult, intentData, bestTimeToSurfUrl, editorialBeaches] = await Promise.all([
    getBeachesByIntentAndCity(
      params.intent,
      cityMetadata.cityName,
      cityMetadata.state.toLowerCase()
    ),
    params.intent === "tide"
      ? getCityTideData(cityMetadata.cityName, cityMetadata.state)
      : params.intent === "water-temp"
        ? getCityWaterTempHistory(cityMetadata.cityName, cityMetadata.state)
        : Promise.resolve(null),
    getBestTimeToSurfUrl(params.city, cityMetadata.cityName, cityMetadata.state),
    getCityBeachEditorialData(cityMetadata.cityName, cityMetadata.state),
  ]);

  // Extract intent-specific data from Promise.all result
  const tideData: CityTideData | null = params.intent === "tide" ? intentData as CityTideData | null : null;
  const waterTempData: CityWaterTempData | null = params.intent === "water-temp" ? intentData as CityWaterTempData | null : null;

  if (!beachesResult.success || !beachesResult.data || beachesResult.data.length === 0) {
    // least-crowded with no light/moderate beaches should 404, not show empty state
    if (params.intent === "least-crowded") {
      return notFound();
    }
    return (
      <div className="seo-paper-page">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800">
              {definition.heading({ cityName: cityMetadata.cityName })}
            </h1>
          </header>
          <IntentEmptyState
            intentLabel={definition.label}
            locationName={cityMetadata.cityName}
          />
        </div>
      </div>
    );
  }

  // Hide least-crowded links if city has no light/moderate crowd-level beaches
  const hasLightModerateCrowdBeaches = beachesResult.data.some(
    (b) => b.crowd_level && ["light", "moderate"].includes(b.crowd_level.toLowerCase())
  );
  const excludeIntents: IntentKey[] = hasLightModerateCrowdBeaches ? [] : ["least-crowded"];

  // Transform database results - add metrics fields for transformer compatibility
  const beachesWithMetrics: BeachWithMetrics[] = beachesResult.data.map(beach => ({
    ...beach,
    compositeScore: 0,
    recentIntelCount: 0,
    avgConfirmations: 0,
  }));
  const spots: SurfSpot[] = transformBeachesToSurfSpots(beachesWithMetrics);

  // Fetch forecast summary for "Today's Plan" module (needs beach data)
  const forecastSummary = await getIntentForecastSummary(
    beachesResult.data.slice(0, 5).map(b => ({
      id: b.id,
      name: b.name,
      slug: b.slug ?? "",
      city: b.city ?? undefined,
      state: b.state ?? undefined,
      skill_level: b.skill_level,
      swell_window_center_deg: b.swell_window_center_deg,
      swell_window_halfwidth_deg: b.swell_window_halfwidth_deg,
      wind_offshore_deg: b.wind_offshore_deg,
      wind_offshore_tol_deg: b.wind_offshore_tol_deg,
      preferred_tide_ft_min: b.preferred_tide_ft_min,
      preferred_tide_ft_max: b.preferred_tide_ft_max,
    })),
    params.intent
  );

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

  const regionLabel = `${cityMetadata.cityName}, ${cityMetadata.stateName}`;
  const pageScene = getCityIntentSeoScene(params.intent, params.city);
  const planScene = getCityIntentPlanSeoScene(params.intent, params.city);

  // Build Place schema with geo coordinates for Google's structured data parser.
  // The Mapbox GL canvas is not readable by crawlers, so we expose pin data here.
  const placeSchema = buildLocationPlaceStructuredData({
    city: cityMetadata.cityName,
    state: cityMetadata.stateName,
    topBeaches: beachesResult.data!.map((b) => ({
      name: b.name,
      url: `${baseUrl.replace(/\/$/, "")}${buildBeachUrl(b)}`,
    })),
    centerLat: cityMetadata.centerLat,
    centerLon: cityMetadata.centerLon,
    // Map beach lat/lon from DB columns (b.lat, b.lon) to the geo param (lat/lon).
    // NOTE: per CLAUDE.md, `center_lat`/`center_lng` are legacy DB column names;
    // Beach.lat/Beach.lon are the in-memory field names from the select query.
    beachGeoData: beachesResult.data!.map((b) => ({
      name: b.name,
      url: `${baseUrl.replace(/\/$/, "")}${buildBeachUrl(b)}`,
      lat: b.lat ?? null,
      lon: b.lon ?? null,
    })),
  });

  const safeBaseUrl = baseUrl.replace(/\/$/, "");
  const stateSlugLower = cityMetadata.state.toLowerCase();
  const pageUrl = `${safeBaseUrl}/${params.intent}/${params.city}`;

  return (
    <div className="seo-paper-page">
      <ReviewedCityEditorialSection
        editorial={await getCityEditorialContent(
          cityToSlug(cityMetadata.cityName),
          cityMetadata.state.toLowerCase(),
          "usa",
          params.intent as SurfIntentSlug,
        )}
      />
      {/* Breadcrumb: Home → State → City → Intent (4 levels) */}
      <BreadcrumbStructuredData
        items={[
          { name: "Home", url: `${safeBaseUrl}/` },
          {
            name: `${cityMetadata.stateName} Surf`,
            url: `${safeBaseUrl}/beaches/usa/${stateSlugLower}`,
          },
          {
            name: `${cityMetadata.cityName} Surf`,
            url: `${safeBaseUrl}/${stateSlugLower}/${params.city}`,
          },
          {
            name: definition.label,
            url: pageUrl,
          },
        ]}
      />
      {/* ItemList JSON-LD for Google carousel SERP features */}
      <ItemListSchema
        items={beachesResult.data!.map((b, i) => ({
          name: b.name,
          url: `${safeBaseUrl}${buildBeachUrl(b)}`,
          position: i + 1,
        }))}
        name={`${definition.label} Spots in ${cityMetadata.cityName}`}
      />
      {/* Place JSON-LD with GeoCoordinates — exposes Mapbox pin data to crawlers */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeSchema) }}
      />
      {/* WebPage JSON-LD with dateModified signals content freshness to Google */}
      <WebPageSchema
        name={pageContent.title}
        url={pageUrl}
        description={pageContent.metaDescription}
      />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Breadcrumb */}
        <nav
          aria-label="breadcrumb"
          className="flex items-center gap-1 text-sm mb-6"
        >
          <Link
            href={`/${cityMetadata.state.toLowerCase()}/${params.city}`}
            className="inline-flex items-center gap-1 text-ocean-blue hover:underline"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to {cityMetadata.cityName}
          </Link>
          <span className="text-gray-400 mx-2">›</span>
          <span className="text-gray-800 font-medium">{definition.label}</span>
        </nav>

        {/* Header */}
        <header className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,460px)] lg:items-stretch">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
              {pageContent.heading}
            </h1>
            <p className="text-lg text-gray-600 mb-4">{regionLabel}</p>

            <div className="space-y-2 mt-6">
              <p className="text-base text-gray-700">
                Recommendations refresh every 30 minutes based on tide, wind,
                and crowd telemetry from Quiver.
              </p>
              <p className="text-base text-gray-700">
                {pageContent.intro}
              </p>
            </div>
          </div>
          {pageScene && (
            <SeoScenePanel
              scene={pageScene}
              priority
              mediaClassName="h-full min-h-[300px] lg:min-h-full"
            />
          )}
        </header>

        {/* Intent-specific live data sections */}
        {params.intent === "tide" && <TideOverviewSection data={tideData} />}
        {params.intent === "water-temp" && (
          <WaterTempOverviewSection data={waterTempData} />
        )}

        <div className="space-y-12">
          <SeoFunnelNextSteps
            variant="paper"
            title={`Keep planning ${cityMetadata.cityName}`}
            description={`Use this ${definition.label.toLowerCase()} guide as the filter, then jump to live spots, tides, or the seasonal window.`}
            steps={[
              {
                label: `Check live ${cityMetadata.cityName} spots`,
                href: `/beaches/usa/${stateSlugLower}/${params.city}`,
                description: "See the local breaks and current surf conditions.",
              },
              {
                label: `Find the best surf window`,
                href: bestTimeToSurfUrl ?? `/best-time-to-surf/${params.city}`,
                description: "Compare today's call with the seasonal pattern.",
              },
              {
                label: `Watch the tide window`,
                href: `/tide/${params.city}`,
                description: "Use tide timing before you commit to a spot.",
              },
            ]}
          />

          {/* Map & List Section */}
          <section>
            <CityMapView
              spots={spots}
              cityName={cityMetadata.cityName}
              citySlug={params.city}
              stateSlug={cityMetadata.state.toLowerCase()}
              countrySlug="usa"
              forecastTopPicks={forecastSummary?.topPicks}
            />
          </section>


          {/* Today's Plan Module */}
          <TodaysIntentPlan
            summary={forecastSummary}
            intentSlug={params.intent as SurfIntentSlug}
            cityName={cityMetadata.cityName}
            stateSlug={cityMetadata.state.toLowerCase()}
            citySlug={params.city}
            focusPoints={definition.focusPoints}
            scene={planScene}
          />

          {/* Beach Editorial Section — intent-specific local tips */}
          {editorialBeaches.length > 0 && (
            <BeachEditorialSection
              beaches={editorialBeaches}
              intentSlug={params.intent as SurfIntentSlug}
              cityName={cityMetadata.cityName}
              stateSlug={cityMetadata.state.toLowerCase()}
              citySlug={params.city}
            />
          )}

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Mini Log Teaser */}
            <MiniLogTeaser
              intentSlug={params.intent}
              cityName={cityMetadata.cityName}
              firstBeach={beachesResult.data[0] ? { id: beachesResult.data[0].id, name: beachesResult.data[0].name } : undefined}
            />

            {/* Smart Checklist & Links */}
            <aside className="space-y-6">
              <SmartChecklist
                bestWindow={forecastSummary?.bestWindow ?? null}
                intentSlug={params.intent}
                cityName={cityMetadata.cityName}
                topBeachName={forecastSummary?.topPicks[0]?.name}
                windForecast={forecastSummary?.conditions.wind}
                isTomorrow={forecastSummary?.isTomorrow}
              />
              <ContinueExploring
                currentIntent={params.intent as IntentKey}
                citySlug={params.city}
                cityName={cityMetadata.cityName}
                stateSlug={cityMetadata.state.toLowerCase()}
                stateName={cityMetadata.stateName}
                bestTimeToSurfUrl={bestTimeToSurfUrl}
                excludeIntents={excludeIntents.length > 0 ? excludeIntents : undefined}
              />
            </aside>
          </div>
        </div>

        {/* Visible FAQ section (includes JSON-LD structured data) */}
        <FAQSection
          items={generateIntentFAQ(
            params.intent as SurfIntentSlug,
            cityMetadata.cityName,
            spots.slice(0, 3).map((s) => s.name),
            cityMetadata.state.toLowerCase()
          )}
          locationName={cityMetadata.cityName}
        />
      </div>

      {/* Bottom CTA Section */}
      <CTASection />

      {/* Mobile Sticky Signup Bar */}
      <StickySignupBar
        source={`intent-${params.intent}-${params.city}`}
        ctaText="Get condition alerts"
        supportingText="Know before you drive"
        searchReferralCta={{
          ctaText: "Get Surf Alerts",
          supportingText: "Conditions sent before dawn patrol",
        }}
      />
    </div>
  );
}
