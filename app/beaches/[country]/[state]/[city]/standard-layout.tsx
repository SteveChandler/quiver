/**
 * Standard layout for city pages without editorial content.
 *
 * Renders the data-driven layout with beach list grid, sticky map,
 * intent guides, and FAQ section.
 */

import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { SiblingCitiesSection } from "@/components/shared/sibling-cities-section";
import type { TopCityInState } from "@/actions/beach/beach-location-actions";
import { getRankingTier, getRankingBadgeLabel } from "@/types/location";
import { RankingBadge } from "@/components/location/ranking-badge";
import { getBeachHrefSafe, getUsStateDisplayNameFromSlug } from "@/lib/utils/beach-url-utils";
import { sanitizeBeachDescription } from "@/lib/utils/text-utils";
import { IntentGuidesGrid } from "@/components/shared/intent-guides-grid";
import type { IntentKey } from "@/lib/constants/intent-definitions";
import { FAQSection } from "@/components/seo/faq-schema";
import { ItemListSchema } from "@/components/seo/item-list-schema";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { generateCityRichContent } from "@/lib/seo/city-content-generator";
import { RichContentRenderer } from "@/lib/seo/rich-content";
import type { MetroAreaConfig } from "@/lib/constants/metro-areas";
import type { LocationStats, BeachWithMetrics, LocationIdentifier } from "@/types/location";
import { LocationMapClient } from "./location-map-client";
import type { LocationPageParams } from "./city-page-utils";
import { SITE_ORIGIN } from "./city-page-utils";
import { WebPageSchema } from "@/components/seo/web-page-schema";

interface BeachHighlight {
  beachName: string;
  beachUrl: string;
  type: "beginner" | "safety";
  text: string;
}

interface StandardLayoutProps {
  params: LocationPageParams;
  displayCityName: string;
  stats: LocationStats;
  location: LocationIdentifier;
  beaches: BeachWithMetrics[];
  metroConfig: MetroAreaConfig | null;
  jsonLd: object;
  itemListItems: { name: string; url: string; position: number }[];
  bestTimeToSurfUrl?: string;
  siblingCities?: TopCityInState[];
  beachHighlights?: BeachHighlight[];
}

export function StandardLayout({
  params,
  displayCityName,
  stats,
  location,
  beaches,
  metroConfig,
  jsonLd,
  itemListItems,
  bestTimeToSurfUrl,
  siblingCities,
  beachHighlights,
}: StandardLayoutProps) {
  const { summary: citySummary, faqs: cityFaqs } = generateCityRichContent({
    cityName: displayCityName,
    stateName: location.state,
    stateSlug: params.state,
    stats,
    beaches,
  });

  // Hide least-crowded link if no beaches have light/moderate crowd levels
  const hasLightModerateCrowdBeaches = beaches.some(
    (b) => b.crowd_level && ["light", "moderate"].includes(b.crowd_level.toLowerCase())
  );
  const excludeIntents: IntentKey[] = hasLightModerateCrowdBeaches ? [] : ["least-crowded"];

  const isUsa = params.country === "usa";
  const countryName = isUsa ? "United States" : "Mexico";
  const countryUrl = `/beaches/${params.country}`;
  const stateName = isUsa
    ? getUsStateDisplayNameFromSlug(params.state)
    : params.state.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const stateUrl = `/beaches/${params.country}/${params.state}`;

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
      <BreadcrumbStructuredData items={[
        { name: "Quiver", url: `${SITE_ORIGIN}/` },
        { name: countryName, url: `${SITE_ORIGIN}${countryUrl}` },
        { name: stateName, url: `${SITE_ORIGIN}${stateUrl}` },
        { name: displayCityName, url: `${SITE_ORIGIN}/beaches/${params.country}/${params.state}/${params.city}` },
      ]} />
      {/* WebPage JSON-LD with dateModified signals content freshness to Google */}
      <WebPageSchema
        name={`Best Surf Beaches in ${displayCityName}`}
        url={`${SITE_ORIGIN}/beaches/${params.country}/${params.state}/${params.city}`}
      />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Breadcrumb */}
        <nav
          aria-label="breadcrumb"
          className="flex items-center gap-1 text-sm mb-6"
        >
          <Link
            href="/"
            className="text-ocean-blue hover:underline"
          >
            Home
          </Link>
          <span aria-hidden="true" className="text-gray-400 mx-2">›</span>
          <Link
            href={countryUrl}
            className="text-ocean-blue hover:underline"
          >
            {countryName}
          </Link>
          <span aria-hidden="true" className="text-gray-400 mx-2">›</span>
          <Link
            href={stateUrl}
            className="text-ocean-blue hover:underline"
          >
            {stateName}
          </Link>
          <span aria-hidden="true" className="text-gray-400 mx-2">›</span>
          <span className="text-gray-900 font-medium">
            {displayCityName}
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
          excludeIntents={excludeIntents.length > 0 ? excludeIntents : undefined}
        />

        {/* Best Time to Surf cross-link for SEO indexation */}
        {bestTimeToSurfUrl && (
          <div className="mt-6">
            <Link
              href={bestTimeToSurfUrl}
              className="inline-flex items-center gap-2 text-ocean-blue hover:underline font-medium"
            >
              Best Time to Surf {displayCityName} — Monthly Breakdown →
            </Link>
          </div>
        )}

        {/* Beach Highlights from editorial content */}
        {beachHighlights && beachHighlights.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Beach Highlights</h2>
            <div className="space-y-3">
              {beachHighlights.map((highlight, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4">
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-sky-100 text-sky-700 whitespace-nowrap">
                    {highlight.type === "beginner" ? "Beginner-friendly" : "Safety"}
                  </span>
                  <p className="text-sm text-gray-700">
                    <Link href={highlight.beachUrl} className="font-medium text-sky-700 hover:underline">
                      {highlight.beachName}
                    </Link>
                    {" — "}
                    {highlight.text}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* FAQ Section for SEO */}
        <FAQSection items={cityFaqs} locationName={displayCityName} />

        {/* Sibling Cities for internal linking */}
        {siblingCities && siblingCities.length > 0 && (
          <SiblingCitiesSection
            currentCity={displayCityName}
            stateSlug={params.state}
            stateName={stateName}
            stateUrl={stateUrl}
            cities={siblingCities}
          />
        )}

        {/* Empty State (shouldn't happen due to notFound check above) */}
        {beaches.length === 0 && (
          <div data-testid="empty-state" className="text-center py-12">
            <p className="text-gray-600">No beaches found in this location.</p>
          </div>
        )}
      </div>
    </>
  );
}
