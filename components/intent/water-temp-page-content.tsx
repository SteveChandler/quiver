import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { FAQSection } from "@/components/seo/faq-schema";
import { generateIntentFAQ } from "@/lib/seo/intent-faq-generator";
import { CityMapView } from "@/components/city/city-map-view";
import { CTASection } from "@/components/landing-page/cta-section";
import { AlertCaptureCta } from "@/components/seo/alert-capture-cta";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";
import type { SurfSpot } from "@/lib/data/surf-spots";
import type { CityWaterTempExpanded } from "@/actions/forecast/intent-forecast-actions";
import type { IntentPageContent } from "@/lib/seo/intent-content-templates";
import type { BeachEditorialItem } from "@/types/location";
import type { IntentKey } from "@/lib/constants/intent-definitions";
import { SURF_INTENTS } from "@/lib/constants/surf-intents";
import { ContinueExploring } from "@/components/shared/continue-exploring";
import { IntentGuidesGrid } from "@/components/shared/intent-guides-grid";
import { WaterTempHeroSection } from "./water-temp-hero-section";
import { MonthlyAveragesChart } from "./monthly-averages-chart";
import { BeachTempComparison } from "./beach-temp-comparison";
import { BeachEditorialSection } from "./beach-editorial-section";
import { UtilitySessionHandoff } from "./utility-session-handoff";
import { ContentPageAppHandoffCta } from "@/components/app-store/content-page-app-handoff-cta";

interface WaterTempPageContentProps {
  cityName: string;
  citySlug: string;
  stateSlug: string;
  stateName: string;
  regionLabel: string;
  pageContent: IntentPageContent;
  waterTempData: CityWaterTempExpanded;
  spots: SurfSpot[];
  baseUrl: string;
  bestTimeToSurfUrl?: string;
  editorialBeaches?: BeachEditorialItem[];
  excludeIntents?: IntentKey[];
}

export function WaterTempPageContent({
  cityName,
  citySlug,
  stateSlug,
  stateName,
  regionLabel,
  pageContent,
  waterTempData,
  spots,
  baseUrl,
  bestTimeToSurfUrl,
  editorialBeaches,
  excludeIntents,
}: WaterTempPageContentProps) {
  const definition = SURF_INTENTS["water-temp"];
  const faqItems = generateIntentFAQ(
    "water-temp",
    cityName,
    spots.slice(0, 3).map((s) => s.name),
    stateSlug
  );
  const roundedCurrentTemp = Math.round(waterTempData.currentTemp);

  return (
    <div className="seo-paper-page">
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${baseUrl}/` },
          {
            name: `${cityName} Surf`,
            url: `${baseUrl}/${stateSlug}/${citySlug}`,
          },
          {
            name: "Water Temperature",
            url: `${baseUrl}/water-temp/${citySlug}`,
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
            href={`/${stateSlug}/${citySlug}`}
            className="inline-flex items-center gap-1 text-ocean-blue hover:underline"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to {cityName}
          </Link>
          <span className="text-gray-400 mx-2">&rsaquo;</span>
          <span className="text-gray-800 font-medium">Water Temperature</span>
        </nav>

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
            {pageContent.heading}
          </h1>
          <p className="text-lg text-gray-600 mb-4">{regionLabel}</p>
          <div className="space-y-2 mt-6">
            <p className="text-base font-medium text-gray-900">
              {cityName} water temperature today is {roundedCurrentTemp}°F.
              Most surfers should plan around{" "}
              {waterTempData.wetsuitRecommendation.thickness}.
            </p>
            <p className="text-base text-gray-700">
              Water temperatures refreshed hourly from NOAA buoys and forecast
              models.
            </p>
            <p className="text-base text-gray-700">{pageContent.intro}</p>
          </div>
        </header>

        <div className="space-y-12">
          {/* Module 1: Water Temp Hero */}
          <WaterTempHeroSection data={waterTempData} />

          <ContentPageAppHandoffCta
            source={`content-water-temp-${citySlug}`}
            surface="water_temp"
            placement="above_fold_after_temperature"
            target={`water-temp:${citySlug}`}
            eyebrow={`${cityName} water temp · next check`}
            title="Water temp sorted. Is it worth paddling out?"
            description={`Your ${roundedCurrentTemp}°F answer is set. Take the surf call for ${cityName} with you and check the conditions when you're ready to go.`}
            ctaLabel="Check the surf in the app"
          />

          {/* Module 2: Monthly Averages Chart (optional) */}
          <MonthlyAveragesChart data={waterTempData.monthlyAverages} />

          {/* Module 3: Per-Beach Temperature Comparison */}
          <BeachTempComparison
            beachTemps={waterTempData.beachTemps}
            citySlug={citySlug}
            stateSlug={stateSlug}
            cityName={cityName}
          />

          <UtilitySessionHandoff
            bestTimeToSurfUrl={bestTimeToSurfUrl}
            cityName={cityName}
            citySlug={citySlug}
            intent="water-temp"
            stateSlug={stateSlug}
          />

          {/* Alert Capture CTA */}
          <AlertCaptureCta
            pageContext="water-temp"
            beachId={spots[0]?.id ?? ""}
            beachName={cityName}
            source={`intent-water-temp-${citySlug}`}
            className="my-8"
          />

          {/* Map & Recommendations */}
          {spots.length > 0 && (
            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Surf spots in {cityName}
              </h2>
              <CityMapView
                spots={spots}
                cityName={cityName}
                citySlug={citySlug}
                stateSlug={stateSlug}
                countrySlug="usa"
                displayMode="water-temp"
              />
            </section>
          )}

          {/* Beach Editorial Section */}
          {editorialBeaches && editorialBeaches.length > 0 && (
            <BeachEditorialSection
              beaches={editorialBeaches}
              intentSlug="water-temp"
              cityName={cityName}
              stateSlug={stateSlug}
              citySlug={citySlug}
            />
          )}

          {/* Focus Points */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              What to know about water temperature
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {definition.focusPoints.map((point) => (
                <li
                  key={point}
                  className="rounded-xl border border-cyan-100/50 bg-gradient-to-br from-white/90 to-cyan-50/30 p-4 text-sm text-gray-700 shadow-sm"
                >
                  {point}
                </li>
              ))}
            </ul>
          </section>

          {/* Continue Exploring */}
          <ContinueExploring
            currentIntent="water-temp"
            citySlug={citySlug}
            cityName={cityName}
            stateSlug={stateSlug}
            stateName={stateName}
            bestTimeToSurfUrl={bestTimeToSurfUrl}
            excludeIntents={excludeIntents}
          />

          {/* Intent cross-links for SEO */}
          <IntentGuidesGrid
            locationSlug={citySlug}
            locationName={cityName}
            locationType="city"
            currentIntent="water-temp"
            excludeIntents={excludeIntents}
          />

          {/* FAQ Accordion */}
          <FAQSection items={faqItems} locationName={cityName} />
        </div>
      </div>

      {/* Bottom CTA Section */}
      <CTASection />

      {/* Mobile Sticky Signup Bar */}
      <StickySignupBar
        source={`intent-water-temp-${citySlug}`}
        searchReferralCta={{
          ctaText: "Wetsuit Alert",
          supportingText: `Get gear recs for ${cityName}`,
        }}
      />
    </div>
  );
}
