/**
 * Editorial layout for city pages with curated editorial content.
 *
 * Renders the enhanced layout with map, quick actions, session timing,
 * about accordion, guides by intent, and planning checklist.
 */

import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import type { CityEditorialContent } from "@/types/editorial-content";
import { transformBeachesToSurfSpots } from "@/lib/utils/beach-to-surfspot-transformer";
import { CityMapView } from "@/components/city/city-map-view";
import { QuickActionsBar } from "@/components/city/quick-actions-bar";
import { SessionTimingModules } from "@/components/city/session-timing-modules";
import { AboutAccordion } from "@/components/city/about-accordion";
import { GuidesByIntentGrid } from "@/components/city/guides-by-intent-grid";
import { PlanningChecklist } from "@/components/city/planning-checklist";
import { FAQSection } from "@/components/seo/faq-schema";
import { ItemListSchema } from "@/components/seo/item-list-schema";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { SeoFunnelNextSteps } from "@/components/seo/seo-funnel-next-steps";
import { SiblingCitiesSection } from "@/components/shared/sibling-cities-section";
import { generateCityRichContent } from "@/lib/seo/city-content-generator";
import { getUsStateDisplayNameFromSlug } from "@/lib/utils/beach-url-utils";
import type { LocationStats, BeachWithMetrics } from "@/types/location";
import type { TopCityInState } from "@/actions/beach/beach-location-actions";
import type { CitySurfReportSummary } from "@/actions/city/city-conditions-actions";
import { CityConditionsHero } from "@/components/city/city-conditions-hero";
import { resolveIslandDisplayName, buildCanonicalCityPath } from "./city-page-utils";
import type { LocationPageParams } from "./city-page-utils";
import { SITE_ORIGIN } from "./city-page-utils";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { ReviewedCityEditorialSection } from "@/components/seo/reviewed-city-editorial-section";

interface EditorialLayoutProps {
  params: LocationPageParams;
  displayCityName: string;
  stats: LocationStats;
  beaches: BeachWithMetrics[];
  editorial: CityEditorialContent;
  jsonLd: object;
  itemListItems: { name: string; url: string; position: number }[];
  bestTimeToSurfUrl?: string;
  siblingCities?: TopCityInState[];
  surfReport?: CitySurfReportSummary | null;
}

export function EditorialLayout({
  params,
  displayCityName,
  stats,
  beaches,
  editorial,
  jsonLd,
  itemListItems,
  bestTimeToSurfUrl,
  siblingCities,
  surfReport,
}: EditorialLayoutProps) {
  const surfSpots = transformBeachesToSurfSpots(beaches);
  const topSpot = beaches[0];
  const isUsa = params.country === "usa";
  const countryName = isUsa ? "United States" : "Mexico";
  const countryUrl = `/beaches/${params.country}`;
  const stateName = isUsa
    ? getUsStateDisplayNameFromSlug(params.state)
    : params.state.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const stateUrl = `/beaches/${params.country}/${params.state}`;

  const { faqs: cityFaqs } = generateCityRichContent({
    cityName: displayCityName,
    stateName,
    stateSlug: params.state,
    stats,
    beaches,
  });

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
        { name: displayCityName, url: `${SITE_ORIGIN}${buildCanonicalCityPath(params)}` },
      ]} />
      {/* WebPage JSON-LD with dateModified signals content freshness to Google */}
      <WebPageSchema
        name={`Best Surf Beaches in ${displayCityName}`}
        url={`${SITE_ORIGIN}${buildCanonicalCityPath(params)}`}
      />

      <div className="seo-paper-page">
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
            {stats.totalReviews > 0 ? (
              <div className="flex items-center gap-1">
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                <span className="font-medium">
                  {stats.averageRating.toFixed(1)}
                </span>
                <span>·</span>
                <span>{stats.totalReviews} {stats.totalReviews === 1 ? "review" : "reviews"}</span>
              </div>
            ) : (
              // "0.0 · 0 reviews" reads as a failing grade; nobody has rated it yet.
              <div className="flex items-center gap-1">
                <Star className="h-5 w-5 text-[#B65F1A]" aria-hidden="true" />
                <span>No reviews yet</span>
              </div>
            )}
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

        <ReviewedCityEditorialSection editorial={editorial} />

        {/* Surf Report Today — live conditions hero */}
        {surfReport && surfReport.beaches.length > 0 && (
          <CityConditionsHero
            cityName={displayCityName}
            stateSlug={params.state}
            citySlug={params.city}
            report={surfReport}
          />
        )}

        <SeoFunnelNextSteps
          variant="paper"
          title={`Plan the next ${displayCityName} session`}
          description="Use the city guide for spot choice, then move into timing, water temperature, or tide context."
          steps={[
            {
              label: `Find the best surf window`,
              href: bestTimeToSurfUrl ?? `/best-time-to-surf/${params.city}`,
              description: "Compare the local seasonality before choosing a day.",
            },
            {
              label: `Check ${displayCityName} water temperature`,
              href: `/water-temp/${params.city}`,
              description: "Dial in gear before you head to the beach.",
            },
            {
              label: `Watch the tide window`,
              href: `/tide/${params.city}`,
              description: "See when tide timing helps the main breaks.",
            },
          ]}
          className="mb-8"
        />

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

        {/* Planning Checklist */}
        <PlanningChecklist items={editorial.planning_checklist} />

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
      </div>
      </div>
    </>
  );
}
