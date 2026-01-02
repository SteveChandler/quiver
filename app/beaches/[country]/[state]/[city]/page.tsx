/**
 * Location Listing Page
 *
 * Displays all beaches in a specific city/state/country with ranking.
 * Example URLs:
 * - /beaches/usa/ca/la-jolla-san-diego
 * - /beaches/usa/ca/newport-beach
 * - /beaches/mexico/baja-california/rosarito
 */

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ChevronLeft, MapPin, Star } from "lucide-react";
import {
  getLocationPageData,
  getAllBeachLocations,
} from "@/actions/beach/beach-location-list-actions";
import {
  generateLocationSlug,
  parseLocationFromSlug,
} from "@/lib/utils/location-slug";
import { getRankingTier, getRankingBadgeLabel } from "@/types/location";
import { RankingBadge } from "@/components/location/ranking-badge";
import { isMetroArea, getMetroConfig } from "@/lib/constants/metro-areas";
import { getBeachHrefSafe, getBeachUrlSafe } from "@/lib/utils/beach-url-utils";
import { isValidStateSlug } from "@/lib/utils/beach-url-utils";
import {
  parseHiIslandCitySlug,
  getHiIslandDisplayName,
} from "@/lib/utils/beach-url-utils";
import { sanitizeBeachDescription } from "@/lib/utils/text-utils";

// Editorial content imports
import { getCityEditorialContent } from "@/actions/city/city-editorial-actions";
import { transformBeachesToSurfSpots } from "@/lib/utils/beach-to-surfspot-transformer";
import { CityMapView } from "@/components/city/city-map-view";
import { QuickActionsBar } from "@/components/city/quick-actions-bar";
import { SessionTimingModules } from "@/components/city/session-timing-modules";
import { AboutAccordion } from "@/components/city/about-accordion";
import { GuidesByIntentGrid } from "@/components/city/guides-by-intent-grid";
import { PlanningChecklist } from "@/components/city/planning-checklist";
import { buildLocationPlaceStructuredData } from "@/lib/seo/location-structured-data";

const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
).replace(/\/$/, "");

// Dynamically import LocationMap with no SSR since it uses Mapbox (client-only)
const LocationMap = dynamic(
  () =>
    import("@/components/location/location-map").then((mod) => mod.LocationMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[500px] w-full rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-2 h-8 w-8 mx-auto animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
          <p className="text-sm text-gray-500">Loading map...</p>
        </div>
      </div>
    ),
  }
);

interface LocationPageParams {
  country: string;
  state: string;
  city: string;
}

interface LocationPageProps {
  params: LocationPageParams;
}

export default async function LocationPage({ params }: LocationPageProps) {
  // Fetch location page data
  const response = await getLocationPageData(
    params.city,
    params.state,
    params.country
  );

  if (!response.success || !response.data) {
    // Check if this is a valid city/location that just lacks ranked page data
    // If so, redirect to the map view with a search filter
    if (response.error === "CITY_EXISTS_NO_DATA") {
      const cityName = parseLocationFromSlug(params.city);
      redirect(`/map?search=${encodeURIComponent(cityName)}`);
    }
    notFound();
  }

  const { location, stats, beaches } = response.data;

  // Hawaii island-suffixed city slugs (Waimea-only to start)
  const hiParsed =
    params.state?.toLowerCase() === "hi" ? parseHiIslandCitySlug(params.city) : null;
  const islandDisplayName = hiParsed?.islandSlug
    ? getHiIslandDisplayName(hiParsed.islandSlug)
    : null;
  const displayCityName = islandDisplayName
    ? `${location.city} (${islandDisplayName})`
    : location.city;

  // Check if this is a metro area page
  const metroConfig = isMetroArea(params.city)
    ? getMetroConfig(params.city)
    : null;

  // Fetch editorial content for this city (if available)
  const editorial = await getCityEditorialContent(
    params.city,
    params.state,
    params.country
  );

  // JSON-LD structured data for SEO
  const jsonLd = buildLocationPlaceStructuredData({
    city: location.city,
    state: location.state,
    topBeaches: beaches.slice(0, 5).flatMap((beach) => {
      const href = getBeachHrefSafe(beach);
      if (!href) return [];
      return [{ name: beach.name, url: `${SITE_ORIGIN}${href}` }];
    }),
  });

  // If editorial content exists, render the enhanced editorial layout
  if (editorial) {
    // Transform beaches to SurfSpot format for CityMapView
    const surfSpots = transformBeachesToSurfSpots(beaches);

    // Get top spot for AboutAccordion
    const topSpot = beaches[0];

    return (
      <>
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Breadcrumb */}
          <nav
            aria-label="breadcrumb"
            className="flex items-center gap-1 text-sm mb-6"
          >
            <Link
              href="/map"
              className="inline-flex items-center gap-1 text-ocean-blue hover:underline"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Map
            </Link>
            <span className="text-gray-400 mx-2">›</span>
            <span className="text-gray-900 font-medium">
              {displayCityName}
            </span>
          </nav>

          {/* Header with editorial region label */}
          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Best Surf Beaches in {displayCityName}
            </h1>
            {(() => {
              const regionLabel =
                editorial.region_label?.trim() ||
                (islandDisplayName ? `${islandDisplayName}, Hawaii` : "");
              return regionLabel ? (
                <p className="text-lg text-gray-600 mb-4">{regionLabel}</p>
              ) : null;
            })()}

            <div className="flex flex-wrap items-center gap-4 text-gray-600">
              <div className="flex items-center gap-1">
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                <span className="font-medium">
                  {stats.averageRating.toFixed(1)}
                </span>
                <span>·</span>
                <span>{stats.totalReviews} reviews</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-5 w-5" />
                <span>{stats.totalBeaches} beaches</span>
              </div>
              {stats.topBeaches > 0 && (
                <div className="inline-flex items-center gap-1 px-3 py-1 bg-ocean-blue/10 text-ocean-blue rounded-full text-sm font-medium">
                  {stats.topBeaches} Top Rated
                </div>
              )}
            </div>
          </header>

          {/* Full-width Interactive Map with Beach List */}
          <CityMapView
            spots={surfSpots}
            cityName={editorial.city_name}
            citySlug={params.city}
            stateSlug={params.state}
            countrySlug={params.country}
          />

          {/* Quick Actions Bar */}
          <QuickActionsBar links={editorial.quick_links} />

          {/* Session Timing Modules */}
          <SessionTimingModules modules={editorial.session_timing} />

          {/* About Accordion */}
          <AboutAccordion
            cityName={editorial.city_name}
            citySlug={params.city}
            description={editorial.description}
            topSpotSlug={topSpot?.slug || undefined}
            topSpotName={topSpot?.name || undefined}
          />

          {/* Guides by Intent Grid */}
          <GuidesByIntentGrid
            cityName={editorial.city_name}
            citySlug={params.city}
            featuredIntents={editorial.featured_intents}
            beaches={beaches}
          />

          {/* Planning Checklist */}
          <PlanningChecklist items={editorial.planning_checklist} />
        </div>
      </>
    );
  }

  // Standard layout for cities without editorial content
  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Breadcrumb */}
        <nav
          aria-label="breadcrumb"
          className="flex items-center gap-1 text-sm mb-6"
        >
          <Link
            href="/map"
            className="inline-flex items-center gap-1 text-ocean-blue hover:underline"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Map
          </Link>
          <span className="text-gray-400 mx-2">›</span>
          <span className="text-gray-900 font-medium">
            {displayCityName}, {location.state}
          </span>
        </nav>

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            {metroConfig?.pageTitle ||
              `Best Surf Beaches in ${displayCityName}`}
          </h1>

          {/* Show metro area info if applicable */}
          {metroConfig && (
            <p className="text-gray-600 mb-4">
              Covering {metroConfig.cities.length} neighborhoods:{" "}
              {metroConfig.cities.join(", ")}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-gray-600">
            <div className="flex items-center gap-1">
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">
                {stats.averageRating.toFixed(1)}
              </span>
              <span>·</span>
              <span>{stats.totalReviews} reviews</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="h-5 w-5" />
              <span>{stats.totalBeaches} beaches</span>
            </div>
            {stats.topBeaches > 0 && (
              <div className="inline-flex items-center gap-1 px-3 py-1 bg-ocean-blue/10 text-ocean-blue rounded-full text-sm font-medium">
                {stats.topBeaches} Top Rated
              </div>
            )}
          </div>
        </header>

        {/* Content Grid: Beach List + Map */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Beaches List (2/3 width on desktop) */}
          <div className="lg:col-span-2 space-y-4">
            {beaches.map((beach) => {
              const tier = getRankingTier(beach.compositeScore);
              const badgeLabel = getRankingBadgeLabel(tier);
              const beachHref = getBeachHrefSafe(beach);

              return (
                <article
                  key={beach.id}
                  data-testid="beach-card"
                  data-beach-slug={beach.slug}
                  className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex gap-4">
                    {/* Rank Number */}
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-ocean-blue/10 flex items-center justify-center">
                        <span
                          data-testid="beach-rank"
                          className="text-lg font-bold text-ocean-blue"
                        >
                          #{beach.rank}
                        </span>
                      </div>
                    </div>

                    {/* Beach Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {beachHref ? (
                            <Link
                              href={beachHref}
                              className="text-xl font-semibold text-gray-900 hover:text-ocean-blue transition-colors"
                            >
                              {beach.name}
                            </Link>
                          ) : (
                            <span className="text-xl font-semibold text-gray-900">
                              {beach.name}
                            </span>
                          )}
                          <RankingBadge tier={tier} label={badgeLabel} />

                          {/* Show neighborhood badge for metro areas */}
                          {metroConfig && beach.city && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                              {beach.city}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
                        {(beach.average_rating || 0) > 0 && (
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="font-medium">
                              {(beach.average_rating || 0).toFixed(1)}
                            </span>
                            <span>({beach.review_count} reviews)</span>
                          </div>
                        )}
                        {beach.skill_level && (
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                            {beach.skill_level}
                          </span>
                        )}
                        {beach.break_type && (
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                            {beach.break_type}
                          </span>
                        )}
                        {beach.recentIntelCount > 0 && (
                          <span className="text-green-600 font-medium">
                            {beach.recentIntelCount} recent intel post
                            {beach.recentIntelCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {beach.description && (
                        <p className="text-gray-700 text-sm line-clamp-2 mb-3">
                          {sanitizeBeachDescription(beach.description, beach.name)}
                        </p>
                      )}

                      {beachHref ? (
                        <Link
                          href={beachHref}
                          className="inline-flex items-center text-sm font-medium text-ocean-blue hover:underline"
                        >
                          View Beach Details →
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Map Sidebar (1/3 width on desktop, sticky) */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-4">
              <LocationMap
                beaches={beaches}
                city={location.city}
                state={location.state}
              />
            </div>
          </div>
        </div>

        {/* Empty State (shouldn't happen due to notFound check above) */}
        {beaches.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">No beaches found in this location.</p>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Generate static params for all beach locations
 * This enables Next.js to pre-generate all location pages at build time
 *
 * Note: Returns empty array on errors to allow build to continue.
 * Pages will be generated on-demand (ISR) instead.
 */
export async function generateStaticParams() {
  try {
    const response = await getAllBeachLocations();

    if (!response.success || !response.data || response.data.length === 0) {
      console.warn(
        "[generateStaticParams] No location data available, skipping static generation"
      );
      return [];
    }

    return response.data.map((loc) => ({
      country: generateLocationSlug(loc.country),
      state: generateLocationSlug(loc.state),
      city: generateLocationSlug(loc.city),
    }));
  } catch (error) {
    // Log error but don't fail build - pages will be generated on-demand via ISR
    console.error("[generateStaticParams] Error fetching locations:", error);
    console.warn(
      "[generateStaticParams] Skipping static generation, pages will use ISR"
    );
    return [];
  }
}

/**
 * Configure page metadata
 */
export async function generateMetadata({ params }: LocationPageProps) {
  try {
    const metroConfig = isMetroArea(params.city)
      ? getMetroConfig(params.city)
      : null;

    const response = await getLocationPageData(
      params.city,
      params.state,
      params.country
    );

    if (!response.success || !response.data) {
      return {
        title: "Location Not Found",
      };
    }

    const { location, stats } = response.data;

    // Hawaii island-suffixed city slugs (Waimea-only to start)
    const hiParsed =
      params.state?.toLowerCase() === "hi"
        ? parseHiIslandCitySlug(params.city)
        : null;
    const islandDisplayName = hiParsed?.islandSlug
      ? getHiIslandDisplayName(hiParsed.islandSlug)
      : null;
    const displayCityName = islandDisplayName
      ? `${location.city} (${islandDisplayName})`
      : location.city;

    // Use metro-specific metadata if applicable
    const title = metroConfig?.pageTitle
      ? `${metroConfig.pageTitle} | Quiver`
      : `Best Surf Beaches in ${displayCityName}, ${location.state} | Quiver`;

    const description = metroConfig?.description
      ? `${
          metroConfig.description
        } Average rating: ${stats.averageRating.toFixed(1)}/5 from ${
          stats.totalReviews
        } reviews.`
      : `Discover the top ${stats.totalBeaches} surf beaches in ${
          displayCityName
        }. Average rating: ${stats.averageRating.toFixed(1)}/5 from ${
          stats.totalReviews
        } reviews.`;

    const isUsa = params.country.toLowerCase() === "usa";
    const canonicalPath =
      isUsa && isValidStateSlug(params.state)
        ? `/beaches/usa/${params.state}/${params.city}`
        : `/beaches/${params.country}/${params.state}/${params.city}`;
    const url = `${SITE_ORIGIN}${canonicalPath}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url,
        siteName: "Quiver Surf App",
        images: [
          {
            url: "/images/og-location-default.jpg",
            width: 1200,
            height: 630,
            alt: `Surf beaches in ${displayCityName}, ${location.state}`,
          },
        ],
        locale: "en_US",
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: ["/images/og-location-default.jpg"],
      },
      alternates: {
        canonical: url,
      },
    };
  } catch (error) {
    // Handle errors gracefully during build
    console.error("[generateMetadata] Error:", error);
    return {
      title: "Surf Beaches | Quiver",
      description: "Discover surf beaches and conditions on Quiver",
    };
  }
}

/**
 * ISR Configuration: Incremental Static Regeneration
 *
 * Revalidates the page every hour (3600 seconds) to ensure:
 * - Beach rankings stay up-to-date with new reviews
 * - Intel post counts reflect recent activity
 * - Stats update without requiring full deployments
 *
 * This balances performance (static generation) with freshness (hourly updates).
 */
export const revalidate = 3600; // Revalidate every 1 hour
