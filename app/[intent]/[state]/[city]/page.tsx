import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  SURF_INTENTS,
  type SurfIntentSlug,
} from "@/lib/constants/surf-intents";
import {
  buildCityHubUrl,
  buildStateIntentUrl,
  type IntentKey,
} from "@/lib/constants/intent-definitions";
import type { SurfSpot } from "@/lib/data/surf-spots";
import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { FAQSchema } from "@/components/seo/faq-schema";
import { generateIntentFAQ } from "@/lib/seo/intent-faq-generator";
import { CityMapView } from "@/components/city/city-map-view";
import type { BeachWithMetrics } from "@/types/location";
import {
  isValidStateSlug,
  stateToSlug,
  cityToSlug,
  buildBeachUrl,
  buildHiCityUrlForBeach,
  getUsStateRootPathOrNull,
} from "@/lib/utils/beach-url-utils";
import { getBeachesByIntentAndCity, getBeachesBySlug } from "@/actions/beach/beach-query-actions";
import { transformBeachesToSurfSpots } from "@/lib/utils/beach-to-surfspot-transformer";
import { getCityMetadata } from "@/actions/city/city-metadata-actions";
import { lookupCityByCityAndStateSlug } from "@/actions/beach/beach-location-actions";
import { buildIntentPageContent } from "@/lib/seo/intent-content-templates";

// Beach detail components
import { BeachPageStructuredData } from "@/components/seo/structured-data";
import { BeachDetailClient } from "@/app/beach/[slug]/beach-detail-client";
import type { Beach } from "@/types/database";
import { getTimezoneFromCoords } from "@/lib/utils/timezone-utils.server";

export const dynamic = "force-dynamic";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

interface PageParams {
  params: Promise<{ intent: string; state: string; city: string }>;
}

/**
 * Determine if this is an intent city page or beach detail page
 *
 * Intent city page: /beginner/ca/san-diego
 *   - intent = valid intent slug (beginner, longboard, etc.)
 *   - state = valid state slug (ca, hi, etc.)
 *   - city = city slug (san-diego)
 *
 * Beach detail page: /ca/san-diego/ocean-beach
 *   - intent = valid state slug (ca, hi, etc.)
 *   - state = city slug (san-diego)
 *   - city = beach slug (ocean-beach)
 */
function determinePageType(intent: string, state: string): "intent-city" | "beach-detail" | "unknown" {
  const isIntentSlug = intent in SURF_INTENTS;
  const isStateSlug = isValidStateSlug(intent);

  if (isIntentSlug && isValidStateSlug(state)) {
    return "intent-city";
  }

  if (isStateSlug) {
    return "beach-detail";
  }

  return "unknown";
}

// =============================================================================
// BEACH DETAIL PAGE LOGIC
// =============================================================================

function pickBestUsaBeachMatch(params: {
  stateParam: string;
  cityParam: string;
  beaches: Beach[];
}): Beach | null {
  const { stateParam, cityParam, beaches } = params;

  if (!Array.isArray(beaches) || beaches.length === 0) return null;

  const stateLower = stateParam.toLowerCase();
  const cityLower = cityParam.toLowerCase();

  const withStateMatch = beaches.filter(
    (b) => stateToSlug(b.state)?.toLowerCase() === stateLower
  );

  const statePool = withStateMatch.length > 0 ? withStateMatch : beaches;

  const withCityMatch = statePool.filter(
    (b) => cityToSlug(b.city)?.toLowerCase() === cityLower
  );

  const pool = withCityMatch.length > 0 ? withCityMatch : statePool;

  const sorted = [...pool].sort((a, b) => {
    const aHasCoords = Number(Boolean(a.lat && a.lon));
    const bHasCoords = Number(Boolean(b.lat && b.lon));
    if (aHasCoords !== bHasCoords) return bHasCoords - aHasCoords;

    const aReviews = a.review_count ?? 0;
    const bReviews = b.review_count ?? 0;
    if (aReviews !== bReviews) return bReviews - aReviews;

    const aCreated = a.created_at ? Date.parse(a.created_at) : 0;
    const bCreated = b.created_at ? Date.parse(b.created_at) : 0;
    if (aCreated !== bCreated) return bCreated - aCreated;

    return String(a.id).localeCompare(String(b.id));
  });

  return sorted[0] ?? null;
}

async function renderBeachDetailPage(
  stateParam: string,
  cityParam: string,
  beachSlug: string
) {
  // Fetch candidate beach rows by slug
  const candidatesResult = await getBeachesBySlug(beachSlug);

  const beach = pickBestUsaBeachMatch({
    stateParam,
    cityParam,
    beaches: candidatesResult.success ? candidatesResult.data ?? [] : [],
  });

  if (!beach) notFound();

  const beachTimezone =
    beach.lat != null && beach.lon != null
      ? getTimezoneFromCoords(beach.lat, beach.lon)
      : null;

  // Validate that the beach's state matches the URL state parameter
  const expectedStateSlug = stateToSlug(beach.state);
  if (stateParam.toLowerCase() !== expectedStateSlug) {
    console.warn("[BeachDetail] State slug mismatch:", {
      beachSlug,
      expectedState: expectedStateSlug,
      providedState: stateParam,
    });
    notFound();
  }

  // Check city match if beach has city data
  if (beach.city) {
    const expectedCitySlug = cityToSlug(beach.city);
    if (cityParam !== expectedCitySlug) {
      console.warn("[BeachDetail] City slug mismatch:", {
        beachSlug,
        expectedCity: expectedCitySlug,
        providedCity: cityParam,
      });
      notFound();
    }
  } else {
    console.warn("[BeachDetail] Beach has no city data:", {
      beachSlug,
      beachName: beach.name,
    });
    notFound();
  }

  return (
    <>
      {/* Structured Data: Place/Beach */}
      <BeachPageStructuredData
        beachName={beach.name}
        description={`Surf conditions, tides, wind, swell and community intel for ${beach.name}.`}
        latitude={beach.lat || 0}
        longitude={beach.lon || 0}
        rating={(beach as { average_rating?: number }).average_rating || undefined}
        reviewCount={(beach as { review_count?: number }).review_count || undefined}
        city={beach.city || undefined}
        state={beach.state || undefined}
        country={beach.country || undefined}
      />

      {/* Breadcrumb Structured Data for SEO */}
      <BreadcrumbStructuredData
        items={[
          { name: "Home", url: baseUrl },
          ...(() => {
            const statePath = getUsStateRootPathOrNull(beach.state);
            if (!statePath) return [];
            return [
              {
                name: beach.state || "State",
                url: `${baseUrl}${statePath}`,
              },
            ];
          })(),
          {
            name: beach.city || "City",
            url: `${baseUrl}${buildHiCityUrlForBeach(beach)}`,
          },
          {
            name: beach.name,
            url: `${baseUrl}${buildBeachUrl(beach)}`,
          },
        ]}
      />

      {/* Client detail component with auth tracking */}
      <BeachDetailClient
        beach={beach}
        slug={beachSlug}
        beachTimezone={beachTimezone}
      />
    </>
  );
}

async function generateBeachDetailMetadata(
  stateParam: string,
  cityParam: string,
  beachSlug: string
): Promise<Metadata> {
  try {
    const candidatesResult = await getBeachesBySlug(beachSlug);
    const beach = pickBestUsaBeachMatch({
      stateParam,
      cityParam,
      beaches: candidatesResult.success ? candidatesResult.data ?? [] : [],
    });

    if (beach) {
      const reviewCount = beach.review_count ?? 0;
      const reviewText = reviewCount === 1 ? "1 Review" : `${reviewCount} Reviews`;
      const locationContext =
        beach.city && beach.state ? ` in ${beach.city}, ${beach.state}` : "";

      let path: string;
      try {
        path = buildBeachUrl(beach);
      } catch {
        path = `/beach/${beachSlug}`;
      }

      return buildPageMetadata({
        title: `${beach.name}${locationContext} - ${reviewText}, Map & Forecast`,
        description: `Today's surf summary, tides, wind, swell, cams, and community intel for ${beach.name}${locationContext}.`,
        path,
        keywords: [
          beach.name,
          beach.city || "",
          beach.state || "",
          "surf forecast",
          "surf conditions",
          "surf report",
        ].filter(Boolean),
      });
    }
  } catch (error) {
    console.error("[BeachDetail] Error generating metadata:", error);
  }

  return buildPageMetadata({
    title: `Beach - Surf Forecast & Conditions`,
    description: `Conditions, intel, photos, and community tips for this beach.`,
    path: `/beach/${beachSlug}`,
  });
}

// =============================================================================
// INTENT CITY PAGE LOGIC
// =============================================================================

async function renderIntentCityPage(
  intent: string,
  state: string,
  city: string
) {
  const definition = SURF_INTENTS[intent as SurfIntentSlug];
  if (!definition) {
    notFound();
  }

  // Lookup city to validate and get display name
  const cityInfo = await lookupCityByCityAndStateSlug(city, state);
  if (!cityInfo) {
    notFound();
  }

  // Get city metadata for content generation
  const metadataResult = await getCityMetadata(cityInfo.cityName, cityInfo.stateSlug.toUpperCase());
  if (!metadataResult.success || !metadataResult.data) {
    notFound();
  }

  const cityMetadata = metadataResult.data;
  const pageContent = buildIntentPageContent(intent as SurfIntentSlug, cityMetadata);

  // Fetch beaches from database
  const beachesResult = await getBeachesByIntentAndCity(intent, city, state);

  // Use empty array instead of 404 for graceful empty state
  const beaches = beachesResult.success && beachesResult.data ? beachesResult.data : [];

  // Transform database results for CityMapView
  const beachesWithMetrics: BeachWithMetrics[] = beaches.map((beach) => ({
    ...beach,
    compositeScore: 0,
    recentIntelCount: 0,
    avgConfirmations: 0,
  }));
  const spots: SurfSpot[] = transformBeachesToSurfSpots(beachesWithMetrics);

  const regionLabel = `${cityInfo.cityName}, ${cityInfo.stateName}`;

  // Build URLs for navigation
  const cityHubUrl = buildCityHubUrl(state, city);
  const stateIntentUrl = buildStateIntentUrl(intent as IntentKey, state);

  return (
    <div className="bg-white">
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${baseUrl}/` },
          {
            name: `${cityInfo.cityName} Surf`,
            url: `${baseUrl}${cityHubUrl}`,
          },
          {
            name: definition.label,
            url: `${baseUrl}/${intent}/${state}/${city}`,
          },
        ]}
      />
      <FAQSchema
        items={generateIntentFAQ(
          intent as SurfIntentSlug,
          cityInfo.cityName,
          spots.slice(0, 3).map((s) => s.name)
        )}
      />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Breadcrumb navigation */}
        <nav
          aria-label="breadcrumb"
          className="flex items-center gap-1 text-sm mb-6"
        >
          <Link
            href={cityHubUrl}
            className="inline-flex items-center gap-1 text-ocean-blue hover:underline"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to {cityInfo.cityName}
          </Link>
          <span className="text-gray-400 mx-2">›</span>
          <Link
            href={stateIntentUrl}
            className="text-ocean-blue hover:underline"
          >
            {definition.label} in {cityInfo.stateName}
          </Link>
          <span className="text-gray-400 mx-2">›</span>
          <span className="text-gray-900 font-medium">{cityInfo.cityName}</span>
        </nav>

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            {pageContent.heading}
          </h1>
          <p className="text-lg text-gray-600 mb-4">{regionLabel}</p>
          <p className="text-base text-slate-700 mt-4">{pageContent.intro}</p>
        </header>

        <div className="space-y-12">
          {/* Map & List Section or Empty State */}
          {spots.length === 0 ? (
            <section className="mb-8">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
                <h2 className="text-xl font-semibold text-slate-900 mb-2">
                  No {definition.label.toLowerCase()} spots found in {cityInfo.cityName}
                </h2>
                <p className="text-slate-600 mb-4">
                  Try exploring nearby cities or other surf goals.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link
                    href={cityHubUrl}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-ocean-blue text-white rounded-lg hover:bg-ocean-blue/90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ocean-blue transition-colors"
                  >
                    All {cityInfo.cityName} Beaches
                  </Link>
                  <Link
                    href={stateIntentUrl}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400 transition-colors"
                  >
                    {definition.label} in {cityInfo.stateName}
                  </Link>
                </div>
              </div>
            </section>
          ) : (
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">
                Top spot recommendations
              </h2>
              <p className="mb-6 text-sm text-slate-600">
                Sort your quiver, choose the right tide window, and jot down a
                backup in case the main peak gets stacked.
              </p>

              <CityMapView
                spots={spots}
                cityName={cityInfo.cityName}
                citySlug={city}
                stateSlug={state}
                countrySlug="usa"
              />
            </section>
          )}

          {/* Editorial Focus Section */}
          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">
              What to focus on today
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {definition.focusPoints.map((point) => (
                <li
                  key={point}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 shadow-inner"
                >
                  {point}
                </li>
              ))}
            </ul>
          </section>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Logging Tips */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">
                Session logging tips
              </h2>
              <p className="text-slate-700 leading-relaxed">
                Once you wrap the surf, drop a note in your Quiver journal with
                tide, board, and crowd observations. Over time you&apos;ll see
                crystal-clear patterns about when {cityInfo.cityName} rewards this type
                of session objective.
              </p>
            </section>

            {/* Checklist & Links */}
            <aside className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-inner">
                <h2 className="text-lg font-semibold text-slate-900">
                  Rapid-fire checklist
                </h2>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  <li>Screenshot the tide window and share it with your crew.</li>
                  <li>Pack the board that matches the fastest section above.</li>
                  <li>
                    Stash a backup parking plan in notes—crowds shift quickly on
                    pulsy swells.
                  </li>
                </ul>
              </div>
              <div className="rounded-xl border border-slate-200 p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">
                  Continue exploring
                </h2>
                <ul className="mt-3 space-y-2 text-sm text-sky-700">
                  <li>
                    <Link
                      href={cityHubUrl}
                      className="underline-offset-2 hover:underline"
                    >
                      Back to the {cityInfo.cityName} surf hub
                    </Link>
                  </li>
                  <li>
                    <Link
                      href={stateIntentUrl}
                      className="underline-offset-2 hover:underline"
                    >
                      {definition.label} across {cityInfo.stateName}
                    </Link>
                  </li>
                  <li>
                    <Link
                      href={`/${intent === "least-crowded" ? "water-temp" : "least-crowded"}/${state}/${city}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {intent === "least-crowded" ? "Water temperature" : "Less-crowded backups"}
                    </Link>
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

async function generateIntentCityMetadata(
  intent: string,
  state: string,
  city: string
): Promise<Metadata> {
  const definition = SURF_INTENTS[intent as SurfIntentSlug];
  if (!definition) return {};

  if (!isValidStateSlug(state)) return {};

  const cityInfo = await lookupCityByCityAndStateSlug(city, state);
  if (!cityInfo) return {};

  const metadataResult = await getCityMetadata(cityInfo.cityName, cityInfo.stateSlug.toUpperCase());
  if (!metadataResult.success || !metadataResult.data) {
    return buildPageMetadata({
      title: `${definition.label} in ${cityInfo.cityName}, ${cityInfo.stateName}`,
      description: `Find the best ${definition.label.toLowerCase()} surf spots in ${cityInfo.cityName}.`,
      path: `/${intent}/${state}/${city}`,
    });
  }

  const pageContent = buildIntentPageContent(intent as SurfIntentSlug, metadataResult.data);

  return buildPageMetadata({
    title: pageContent.title,
    description: pageContent.metaDescription,
    path: `/${intent}/${state}/${city}`,
    keywords: [
      `${cityInfo.cityName} ${definition.label}`,
      `${cityInfo.cityName} surf`,
      `${cityInfo.stateName} surfing`,
    ],
  });
}

// =============================================================================
// MAIN EXPORTS
// =============================================================================

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { intent, state, city } = await params;

  const pageType = determinePageType(intent, state);

  switch (pageType) {
    case "intent-city":
      return generateIntentCityMetadata(intent, state, city);
    case "beach-detail":
      // For beach detail: intent=state, state=city, city=beachSlug
      return generateBeachDetailMetadata(intent, state, city);
    default:
      return {};
  }
}

export default async function UnifiedCityOrBeachPage({ params }: PageParams) {
  const { intent, state, city } = await params;

  const pageType = determinePageType(intent, state);

  switch (pageType) {
    case "intent-city":
      return renderIntentCityPage(intent, state, city);
    case "beach-detail":
      // For beach detail: intent=state, state=city, city=beachSlug
      return renderBeachDetailPage(intent, state, city);
    default:
      notFound();
  }
}
