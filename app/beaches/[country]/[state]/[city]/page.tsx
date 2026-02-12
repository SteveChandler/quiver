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
import { ChevronLeft, MapPin, Star } from "lucide-react";
import {
  getLocationPageData,
} from "@/actions/beach/beach-location-list-actions";
import {
  parseLocationFromSlug,
} from "@/lib/utils/location-slug";
import { getRankingTier, getRankingBadgeLabel } from "@/types/location";
import { RankingBadge } from "@/components/location/ranking-badge";
import {
  getBeachHrefSafe,
  isValidCountrySlug,
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
import { IntentGuidesGrid } from "@/components/shared/intent-guides-grid";
import { FAQSection } from "@/components/seo/faq-schema";
import { ItemListSchema } from "@/components/seo/item-list-schema";
import { generateCityRichContent } from "@/lib/seo/city-content-generator";
import { RichContentRenderer } from "@/lib/seo/rich-content";
import { LocationMapClient } from "./location-map-client";
import {
  SITE_ORIGIN,
  resolveDisplayCityName,
  resolveIslandDisplayName,
  resolveMetroConfig,
  buildItemListItems,
} from "./city-page-utils";
import type { LocationPageProps } from "./city-page-utils";

// Re-export Next.js named exports from extracted modules
export { generateMetadata } from "./city-page-metadata";
export { generateStaticParams } from "./city-page-static-gen";

export default async function LocationPage(props: LocationPageProps) {
  const params = await props.params;
  // Validate country parameter - reject non-country values like "beginner", "sunset", etc.
  // This prevents intent slugs from being treated as countries, stopping broken URLs
  if (!isValidCountrySlug(params.country)) {
    notFound();
  }

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

  const displayCityName = resolveDisplayCityName(
    location.city,
    params.state,
    params.city
  );

  const metroConfig = resolveMetroConfig(params.city);

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

  const itemListItems = buildItemListItems(beaches);

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
        <ItemListSchema
          items={itemListItems}
          name={`Surf Spots in ${displayCityName}`}
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
              const islandName = resolveIslandDisplayName(params.state, params.city);
              const regionLabel =
                editorial.region_label?.trim() ||
                (islandName ? `${islandName}, Hawaii` : "");
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
                <span>{stats.totalReviews} {stats.totalReviews === 1 ? "review" : "reviews"}</span>
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
            stateSlug={params.state}
            description={editorial.description}
            topSpotSlug={topSpot?.slug || undefined}
            topSpotName={topSpot?.name || undefined}
          />

          {/* Guides by Intent Grid */}
          <GuidesByIntentGrid
            cityName={editorial.city_name}
            citySlug={params.city}
            stateSlug={params.state}
            featuredIntents={editorial.featured_intents}
            beaches={beaches}
          />

          {/* Planning Checklist */}
          <PlanningChecklist items={editorial.planning_checklist} />
        </div>
      </>
    );
  }

  // Generate data-driven SEO content for non-editorial pages (with internal links)
  const { summary: citySummary, faqs: cityFaqs } = generateCityRichContent({
    cityName: displayCityName,
    stateName: location.state,
    stateSlug: params.state,
    stats,
    beaches,
  });

  // Standard layout for cities without editorial content
  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ItemListSchema
        items={itemListItems}
        name={`Surf Spots in ${displayCityName}`}
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
              <span>{stats.totalReviews} {stats.totalReviews === 1 ? "review" : "reviews"}</span>
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

        {/* Data-driven summary for SEO */}
        <p className="text-gray-700 leading-relaxed max-w-3xl mb-8">
          <RichContentRenderer content={citySummary} />
        </p>

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
              <LocationMapClient
                beaches={beaches}
                city={location.city}
                state={location.state}
              />
            </div>
          </div>
        </div>

        {/* Intent Guides Grid - internal linking to all intent pages */}
        <IntentGuidesGrid
          locationSlug={params.city}
          locationName={displayCityName}
          locationType="city"
          stateAbbrev={params.state.toUpperCase()}
        />

        {/* FAQ Section for SEO */}
        <FAQSection items={cityFaqs} locationName={displayCityName} />

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

export const dynamic = "force-dynamic";
