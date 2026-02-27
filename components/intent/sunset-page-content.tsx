import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { FAQSection } from "@/components/seo/faq-schema";
import { generateIntentFAQ } from "@/lib/seo/intent-faq-generator";
import { CityMapView } from "@/components/city/city-map-view";
import { CTASection } from "@/components/landing-page/cta-section";
import { InlineSignupCta } from "@/components/seo/inline-signup-cta";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";
import type { SurfSpot } from "@/lib/data/surf-spots";
import type { CitySunTimesData } from "@/actions/forecast/intent-forecast-actions";
import type { IntentPageContent } from "@/lib/seo/intent-content-templates";
import type { BeachEditorialItem } from "@/types/location";
import { SURF_INTENTS } from "@/lib/constants/surf-intents";
import { ContinueExploring } from "@/components/shared/continue-exploring";
import { IntentGuidesGrid } from "@/components/shared/intent-guides-grid";
import { SunTimesHeroSection } from "./sun-times-hero-section";
import { SevenDaySunTimesTable } from "./seven-day-sun-times-table";
import { BeachEditorialSection } from "./beach-editorial-section";

interface SunsetPageContentProps {
  cityName: string;
  citySlug: string;
  stateSlug: string;
  stateName: string;
  regionLabel: string;
  pageContent: IntentPageContent;
  sunTimesData: CitySunTimesData;
  spots: SurfSpot[];
  baseUrl: string;
  bestTimeToSurfUrl?: string;
  editorialBeaches?: BeachEditorialItem[];
}

/**
 * SunsetPageContent - Dedicated composition component for /sunset/[city] pages.
 *
 * Composes: hero → 7-day table → CTA → map → editorial → focus points → cross-links → FAQ
 * Follows the TidePageContent pattern for intent-specific pages.
 */
export function SunsetPageContent({
  cityName,
  citySlug,
  stateSlug,
  stateName,
  regionLabel,
  pageContent,
  sunTimesData,
  spots,
  baseUrl,
  bestTimeToSurfUrl,
  editorialBeaches,
}: SunsetPageContentProps) {
  const definition = SURF_INTENTS["sunset"];
  const faqItems = generateIntentFAQ(
    "sunset",
    cityName,
    spots.slice(0, 3).map((s) => s.name),
    stateSlug
  );

  return (
    <div className="bg-gradient-to-b from-white via-gray-50/30 to-white">
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${baseUrl}/` },
          {
            name: `${cityName} Surf`,
            url: `${baseUrl}/beaches/usa/${stateSlug}/${citySlug}`,
          },
          {
            name: "Sunset Sessions",
            url: `${baseUrl}/sunset/${citySlug}`,
          },
        ]}
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
          <span className="text-gray-800 font-medium">Sunset Sessions</span>
        </nav>

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
            {pageContent.heading}
          </h1>
          <p className="text-lg text-gray-600 mb-4">{regionLabel}</p>

          <div className="space-y-2 mt-6">
            <p className="text-base text-gray-700">
              Sunset and golden hour times for planning your evening session.
            </p>
            <p className="text-base text-gray-700">{pageContent.intro}</p>
          </div>
        </header>

        <div className="space-y-12">
          {/* Module 1: Sun times hero - today's sunset */}
          <SunTimesHeroSection data={sunTimesData} mode="sunset" />

          {/* Module 2: 7-day sun schedule */}
          <SevenDaySunTimesTable days={sunTimesData.sevenDayTimes} />

          {/* Inline Signup CTA */}
          <InlineSignupCta
            title={`Catch Every Golden Hour in ${cityName}`}
            description="Get sunset alerts and evening surf conditions delivered to your inbox."
            source={`intent-sunset-${citySlug}`}
            className="my-8"
          />

          {/* Map & Spot Recommendations */}
          {spots.length > 0 && (
            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Best sunset surf spots in {cityName}
              </h2>
              <CityMapView
                spots={spots}
                cityName={cityName}
                citySlug={citySlug}
                stateSlug={stateSlug}
                countrySlug="usa"
              />
            </section>
          )}

          {/* Per-beach editorial details */}
          {editorialBeaches && editorialBeaches.length > 0 && (
            <BeachEditorialSection
              beaches={editorialBeaches}
              intentSlug="sunset"
              cityName={cityName}
              stateSlug={stateSlug}
              citySlug={citySlug}
            />
          )}

          {/* Sunset focus points */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Sunset session tips
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {definition.focusPoints.map((point) => (
                <li
                  key={point}
                  className="rounded-xl border border-amber-100/50 bg-gradient-to-br from-white/90 to-amber-50/30 p-4 text-sm text-gray-700 shadow-sm"
                >
                  {point}
                </li>
              ))}
            </ul>
          </section>

          {/* Continue Exploring */}
          <ContinueExploring
            currentIntent="sunset"
            citySlug={citySlug}
            cityName={cityName}
            stateSlug={stateSlug}
            stateName={stateName}
            bestTimeToSurfUrl={bestTimeToSurfUrl}
          />

          {/* Intent cross-links for SEO */}
          <IntentGuidesGrid
            locationSlug={citySlug}
            locationName={cityName}
            locationType="city"
            currentIntent="sunset"
          />

          {/* FAQ Accordion */}
          <FAQSection items={faqItems} locationName={cityName} />
        </div>
      </div>

      {/* Bottom CTA Section */}
      <CTASection />

      {/* Mobile Sticky Signup Bar */}
      <StickySignupBar source={`intent-sunset-${citySlug}`} />
    </div>
  );
}
