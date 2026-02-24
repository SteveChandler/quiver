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
import { isValidStateSlug, getUsStateDisplayNameFromSlug, COASTAL_STATE_SUFFIXES, buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { parseLocationFromSlug } from "@/lib/utils/location-slug";
import { getBeachesByIntentAndCity, getBeachesByIntentAndState } from "@/actions/beach/beach-query-actions";
import { transformBeachesToSurfSpots } from "@/lib/utils/beach-to-surfspot-transformer";
import { StateMapView } from "@/components/state/state-map-view";
import { findCityBySlug, getCityMetadata, getCityBeachEditorialData, type CityMetadata } from "@/actions/city/city-metadata-actions";
import { buildIntentPageContent } from "@/lib/seo/intent-content-templates";
import { buildLocationPlaceStructuredData } from "@/lib/seo/location-structured-data";
import { getAllCitiesWithBeachSkills, getTopCitiesInState } from "@/actions/beach/beach-location-actions";
import { buildCitySlug, US_STATE_SLUGS } from "@/lib/seo/city-slug-utils";
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
} from "@/components/intent";
import { CTASection } from "@/components/landing-page/cta-section";
import { InlineSignupCta } from "@/components/seo/inline-signup-cta";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";
import type { IntentKey } from "@/lib/constants/intent-definitions";
import { ContinueExploring } from "@/components/shared/continue-exploring";
import { IntentGuidesGrid } from "@/components/shared/intent-guides-grid";
import { ZeroState } from "@/components/ui/zero-state";
import {
  getCityTideData,
  getCityTideDataExpanded,
  getCityWaterTempHistory,
  getIntentForecastSummary,
  type CityTideData,
  type CityTideDataExpanded,
  type CityWaterTempData,
} from "@/actions/forecast/intent-forecast-actions";
import { findCitiesMatchingPattern } from "@/actions/city/city-metadata-actions";
import {
  getBeginnerConditionsData,
  getBeginnerBeachesWithEditorial,
  getBeginnerCityEditorial,
} from "@/actions/beginner/beginner-actions";
import { BeginnerPageContent } from "@/components/beginner/BeginnerPageContent";
import { getBestTimeToSurfUrl } from "@/lib/utils/best-time-to-surf-utils";

export const dynamic = "force-dynamic";

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

const INTENT_SLUGS: SurfIntentSlug[] = ["beginner", "least-crowded", "tide", "water-temp", "longboard", "dawn-patrol", "sunset"];
const US_STATES = Object.values(US_STATE_SLUGS);

const BEGINNER_INTENTS = new Set(["beginner", "longboard"]);
const ADVANCED_INTENTS = new Set(["advanced"]);

export async function generateStaticParams() {
  const params: Array<{ intent: string; city: string }> = [];

  try {
    // Get all cities with skill-level flags for intent filtering
    const citiesResult = await getAllCitiesWithBeachSkills(1);
    if (citiesResult.success && citiesResult.data) {
      // Use static collision map for consistency with sitemap canonical URLs
      const collisionMap = COLLISION_CITY_MAP;

      // Generate city × intent combinations (filtered by skill availability)
      for (const cityRecord of citiesResult.data) {
        const citySlug = buildCitySlug(cityRecord.city, cityRecord.state, collisionMap);
        if (!citySlug) continue;

        for (const intent of INTENT_SLUGS) {
          // Only include skill-based intents if city has matching beaches
          if (BEGINNER_INTENTS.has(intent) && !cityRecord.hasBeginnerBeaches) continue;
          if (ADVANCED_INTENTS.has(intent) && !cityRecord.hasAdvancedBeaches) continue;
          params.push({ intent, city: citySlug });
        }
      }
    }
  } catch (error) {
    console.error("generateStaticParams: Failed to fetch cities", error);
  }

  // Add state-level intent params (e.g., /beginner/ca)
  for (const state of US_STATES) {
    for (const intent of INTENT_SLUGS) {
      params.push({ intent, city: state });
    }
  }

  return params;
}

interface IntentPageParams {
  // NOTE: although this page is primarily for surf intents, this route also
  // receives legacy 2-segment state/city URLs (e.g. /ca/encinitas).
  params: Promise<{ intent: string; city: string }>;
}

export async function generateMetadata(props: IntentPageParams): Promise<Metadata> {
  const params = await props.params;
  // Check if this is a state-level intent page like /beginner/ca
  if (isValidStateSlug(params.city) && SURF_INTENTS[params.intent as SurfIntentSlug]) {
    const stateName = getUsStateDisplayNameFromSlug(params.city);
    const definition = SURF_INTENTS[params.intent as SurfIntentSlug];

    const metadata = buildPageMetadata({
      title: `${definition.label} Spots in ${stateName}`,
      description: `Find the best ${definition.label.toLowerCase()} surf spots across ${stateName}. ML-powered conditions, crowd data & surf windows — updated hourly.`,
      path: `/${params.intent}/${params.city}`,
    });

    // noindex empty state-level pages (thin content) as defense in depth.
    // Fail-open: if the DB call fails, allow indexing (sitemap already excludes these).
    if (BEGINNER_INTENTS.has(params.intent)) {
      try {
        const beachesResult = await getBeachesByIntentAndState(params.intent, params.city);
        const hasBeaches = beachesResult.success && beachesResult.data && beachesResult.data.length > 0;
        if (!hasBeaches) {
          return { ...metadata, robots: { index: false, follow: true } };
        }
      } catch {
        // Fail-open: allow indexing if DB is unreachable
      }
    }

    return metadata;
  }

  // If this is a legacy state/city URL, we redirect in the page render.
  // Metadata can't redirect, so just avoid surf-intent metadata generation.
  if (isValidStateSlug(params.intent)) {
    const cityName = parseLocationFromSlug(params.city);
    return buildPageMetadata({
      title: `Surf spots in ${cityName}`,
      description: `Open the surf map filtered to ${cityName}.`,
      path: `/${params.intent}/${params.city}`,
    });
  }

  // Database-driven city metadata
  const definition = SURF_INTENTS[params.intent as SurfIntentSlug];
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

  // Unknown intent: return 404-safe metadata with self-referential canonical
  // This prevents Google from selecting an arbitrary canonical URL
  if (!definition) {
    return {
      title: "Page Not Found | Quiver",
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
    const parsedCityName = parseLocationFromSlug(params.city);
    return {
      title: `${definition.label} Spots in ${parsedCityName} | Quiver`,
      description: `Find ${definition.label.toLowerCase()} surf spots near ${parsedCityName}. AI-powered recommendations for every skill level.`,
      alternates: {
        canonical: `${baseUrl}/${params.intent}/${params.city}`,
      },
      robots: { index: false, follow: true },
    };
  }
  // For tide/water-temp intents, fetch live data to inject into meta description
  let tideDataForMeta: CityTideData | null = null;
  let waterTempDataForMeta: CityWaterTempData | null = null;
  if (params.intent === "tide") {
    tideDataForMeta = await getCityTideData(cityMetadata.cityName, cityMetadata.state);
  } else if (params.intent === "water-temp") {
    waterTempDataForMeta = await getCityWaterTempHistory(cityMetadata.cityName, cityMetadata.state);
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
  });

  // Prevent indexing of empty-state pages (thin content)
  if (!hasMatchingBeaches) {
    return { ...metadata, robots: { index: false, follow: true } };
  }

  return metadata;
}

export default async function IntentPage(props: IntentPageParams) {
  const params = await props.params;
  const definition = SURF_INTENTS[params.intent as SurfIntentSlug];

  // Legacy 2-segment state/city route: redirect to map filtered by city
  // Examples: /ca/encinitas, /or/newport
  if (isValidStateSlug(params.intent)) {
    const cityName = parseLocationFromSlug(params.city);
    const redirectTo = `/map?search=${encodeURIComponent(cityName)}`;

    redirect(redirectTo);
  }

  // Check if this is a state-level intent page like /beginner/ca
  if (isValidStateSlug(params.city) && SURF_INTENTS[params.intent as SurfIntentSlug]) {
    const stateName = getUsStateDisplayNameFromSlug(params.city);
    const intentDefinition = SURF_INTENTS[params.intent as SurfIntentSlug];

    const beachesResult = await getBeachesByIntentAndState(params.intent, params.city);
    const beaches = beachesResult.success && beachesResult.data ? beachesResult.data : [];
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

    // Fetch top cities in this state for PopularCitiesForIntent component
    const topCities = await getTopCitiesInState(params.city);

    // Render state-level intent page (with empty state if no beaches)
    const statePageUrl = `${baseUrl.replace(/\/$/, "")}/${params.intent}/${params.city}`;
    return (
      <div className="bg-gradient-to-b from-white via-gray-50/30 to-white">
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebPage",
              name: `${intentDefinition.label} Surf Spots in ${stateName}`,
              description: `Find the best ${intentDefinition.label.toLowerCase()} surf spots across ${stateName}. ML-powered conditions, crowd data & surf windows — updated hourly.`,
              url: statePageUrl,
              dateModified: new Date().toISOString(),
            }),
          }}
        />
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800">
              {intentDefinition.heading({ cityName: stateName })}
            </h1>
            <p className="text-lg text-gray-600 mt-2">
              {beaches.length} spots across {stateName}
            </p>
            <p className="text-base text-gray-700 mt-4">
              {intentDefinition.intro({ cityName: stateName, stateSlug: params.city })}
            </p>
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
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                  {intentDefinition.label} spots in {stateName}
                </h2>
                <StateMapView
                  beaches={beaches}
                  ariaLabel={`${intentDefinition.label} spots in ${stateName}`}
                />
              </section>

              {/* Focus Points */}
              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                  What to focus on
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {intentDefinition.focusPoints.map((point) => (
                    <li
                      key={point}
                      className="rounded-xl border border-blue-100/50 bg-gradient-to-br from-white/90 to-blue-50/30 p-4 text-sm text-gray-700 shadow-sm"
                    >
                      {point}
                    </li>
                  ))}
                </ul>
              </section>

              {/* Popular Cities - Links DOWN to city intent pages */}
              {topCities.length > 0 && (
                <section className="mt-8">
                  <PopularCitiesForIntent
                    intentKey={params.intent as IntentKey}
                    intentLabel={intentDefinition.label}
                    stateName={stateName}
                    cities={topCities}
                  />
                </section>
              )}

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

    const [conditionsData, beaches, cityEditorial, bestTimeToSurfUrl] =
      await Promise.all([
        getBeginnerConditionsData(params.city, stateSlugLower),
        getBeginnerBeachesWithEditorial(params.city, stateSlugLower),
        getBeginnerCityEditorial(params.city, stateSlugLower),
        getBestTimeToSurfUrl(params.city, cityMetadata.cityName, cityMetadata.state),
      ]);

    const { badge: conditionsBadge, rightNow: rightNowConditions } = conditionsData;

    return (
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
      />
    );
  }

  // Tide intent: use dedicated page component with 7-day data + beach preferences
  if (params.intent === "tide") {
    const stateSlugLower = cityMetadata.state.toLowerCase();
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";
    const tidePageContent = buildIntentPageContent("tide", cityMetadata);

    const [expandedTideData, tideBeachesResult, bestTimeToSurfUrl] = await Promise.all([
      getCityTideDataExpanded(cityMetadata.cityName, cityMetadata.state),
      getBeachesByIntentAndCity("tide", cityMetadata.cityName, stateSlugLower),
      getBestTimeToSurfUrl(params.city, cityMetadata.cityName, cityMetadata.state),
    ]);

    // If expanded data unavailable, fall through to generic intent flow
    if (expandedTideData) {
      const tideBeachesWithMetrics: BeachWithMetrics[] = (
        tideBeachesResult.success && tideBeachesResult.data
          ? tideBeachesResult.data
          : []
      ).map((beach) => ({
        ...beach,
        compositeScore: 0,
        recentIntelCount: 0,
        avgConfirmations: 0,
      }));
      const tideSpots: SurfSpot[] = transformBeachesToSurfSpots(tideBeachesWithMetrics);

      return (
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
        />
      );
    }
    // Fall through to generic intent flow if expanded data unavailable
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
    return (
      <div className="bg-gradient-to-b from-white via-gray-50/30 to-white">
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
    <div className="bg-gradient-to-b from-white via-gray-50/30 to-white">
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
            url: `${safeBaseUrl}/beaches/usa/${stateSlugLower}/${params.city}`,
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: pageContent.title,
            description: pageContent.metaDescription,
            url: pageUrl,
            dateModified: new Date().toISOString(),
          }),
        }}
      />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Breadcrumb */}
        <nav
          aria-label="breadcrumb"
          className="flex items-center gap-1 text-sm mb-6"
        >
          <Link
            href={`/beaches/usa/${cityMetadata.state.toLowerCase()}/${params.city}`}
            className="inline-flex items-center gap-1 text-ocean-blue hover:underline"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to {cityMetadata.cityName}
          </Link>
          <span className="text-gray-400 mx-2">›</span>
          <span className="text-gray-800 font-medium">{definition.label}</span>
        </nav>

        {/* Header */}
        <header className="mb-8">
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
        </header>

        {/* Intent-specific live data sections */}
        {params.intent === "tide" && <TideOverviewSection data={tideData} />}
        {params.intent === "water-temp" && (
          <WaterTempOverviewSection data={waterTempData} />
        )}

        {/* Intent-specific CTA - positioned before map for conversion */}
        <InlineSignupCta
          title={definition.ctaHeadline || `Track Your ${cityMetadata.cityName} Sessions`}
          description={definition.ctaDescription || "Log your sessions, save your favorite breaks, and get personalized spot recommendations."}
          primaryButtonText={definition.ctaButton || "Get My Forecast"}
          source={`intent-${params.intent}-${params.city}`}
          className="my-8"
        />

        <div className="space-y-12">
          {/* Map & List Section */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Top spot recommendations
            </h2>
            <p className="mb-6 text-sm text-gray-600">
              Sort your quiver, choose the right tide window, and jot down a
              backup in case the main peak gets stacked.
            </p>

            <CityMapView
              spots={spots}
              cityName={cityMetadata.cityName}
              citySlug={params.city}
              stateSlug={cityMetadata.state.toLowerCase()}
              countrySlug="usa"
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
      />
    </div>
  );
}
