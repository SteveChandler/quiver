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
import type { CityTideDataExpanded } from "@/actions/forecast/intent-forecast-actions";
import type { IntentPageContent } from "@/lib/seo/intent-content-templates";
import type { IntentKey } from "@/lib/constants/intent-definitions";
import { SURF_INTENTS } from "@/lib/constants/surf-intents";
import { ContinueExploring } from "@/components/shared/continue-exploring";
import { SectionFadeUp } from "@/components/shared/section-fade-up";
import { TideHeroSection } from "./tide-hero-section";
import { TideFullChart } from "./tide-full-chart";
import { SevenDayTideTable } from "./seven-day-tide-table";
import { BeachTideCards } from "./beach-tide-cards";
import { UtilitySessionHandoff } from "./utility-session-handoff";

interface TidePageContentProps {
  cityName: string;
  citySlug: string;
  stateSlug: string;
  stateName: string;
  regionLabel: string;
  pageContent: IntentPageContent;
  tideData: CityTideDataExpanded;
  spots: SurfSpot[];
  updatedAt: string;
  baseUrl: string;
  bestTimeToSurfUrl?: string;
  excludeIntents?: IntentKey[];
}

/**
 * TidePageContent - Dedicated composition component for /tide/[city] pages.
 *
 * Composes: hero → chart → 7-day table → beach cards → map → editorial → CTAs
 * Following the BeginnerPageContent pattern for intent-specific pages.
 */
export function TidePageContent({
  cityName,
  citySlug,
  stateSlug,
  stateName,
  regionLabel,
  pageContent,
  tideData,
  spots,
  updatedAt,
  baseUrl,
  bestTimeToSurfUrl,
  excludeIntents,
}: TidePageContentProps) {
  const definition = SURF_INTENTS["tide"];
  const faqItems = generateIntentFAQ(
    "tide",
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
            url: `${baseUrl}/${stateSlug}/${citySlug}`,
          },
          {
            name: "Tides",
            url: `${baseUrl}/tide/${citySlug}`,
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
          <span className="text-gray-800 font-medium">Tides</span>
        </nav>

        {/* Header */}
        <SectionFadeUp delay={0}>
          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
              {pageContent.heading}
            </h1>
            <p className="text-lg text-gray-600 mb-4">{regionLabel}</p>

            <div className="space-y-2 mt-6">
              <p className="text-base text-gray-700">
                Updated {updatedAt} · Tide data refreshes every 30 minutes from
                NOAA stations.
              </p>
              <p className="text-base text-gray-700">{pageContent.intro}</p>
            </div>
          </header>
        </SectionFadeUp>

        <div className="space-y-12">
          {/* Module 1: Tide Hero - current conditions */}
          <SectionFadeUp delay={0.1}>
            <TideHeroSection data={tideData} />
          </SectionFadeUp>

          {/* Module 2: Interactive multi-day chart */}
          <SectionFadeUp delay={0.15}>
            <TideFullChart hourlyPoints={tideData.hourlyPoints} />
          </SectionFadeUp>

          {/* Module 3: 7-day high/low table */}
          <SectionFadeUp>
            <SevenDayTideTable days={tideData.sevenDayExtrema} />
          </SectionFadeUp>

          <SectionFadeUp>
            <UtilitySessionHandoff
              bestTimeToSurfUrl={bestTimeToSurfUrl}
              cityName={cityName}
              citySlug={citySlug}
              intent="tide"
              stateSlug={stateSlug}
            />
          </SectionFadeUp>

          {/* Module 4: Per-beach tide preferences */}
          <SectionFadeUp>
            <BeachTideCards
              beaches={tideData.beachTidePreferences}
              citySlug={citySlug}
              stateSlug={stateSlug}
              cityName={cityName}
            />
          </SectionFadeUp>

          {/* Alert Capture CTA */}
          <SectionFadeUp>
            <AlertCaptureCta
              pageContext="tides"
              beachId={spots[0]?.id ?? ""}
              beachName={cityName}
              source={`intent-tide-${citySlug}`}
              className="my-8"
            />
          </SectionFadeUp>

          {/* Map & Recommendations */}
          {spots.length > 0 && (
            <SectionFadeUp>
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
                  cityName={cityName}
                  citySlug={citySlug}
                  stateSlug={stateSlug}
                  countrySlug="usa"
                />
              </section>
            </SectionFadeUp>
          )}

          {/* Editorial Focus Section */}
          <SectionFadeUp>
            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                What to focus on today
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {definition.focusPoints.map((point) => (
                  <li
                    key={point}
                    className="rounded-xl border border-blue-100/50 bg-gradient-to-br from-white/90 to-blue-50/30 p-4 text-sm text-gray-700 shadow-sm"
                  >
                    {point}
                  </li>
                ))}
              </ul>
            </section>
          </SectionFadeUp>

          {/* Continue Exploring */}
          <SectionFadeUp>
            <ContinueExploring
              currentIntent="tide"
              citySlug={citySlug}
              cityName={cityName}
              stateSlug={stateSlug}
              stateName={stateName}
              bestTimeToSurfUrl={bestTimeToSurfUrl}
              excludeIntents={excludeIntents}
            />
          </SectionFadeUp>

          {/* FAQ Accordion */}
          <SectionFadeUp>
            <FAQSection items={faqItems} locationName={cityName} />
          </SectionFadeUp>
        </div>
      </div>

      {/* Bottom CTA Section */}
      <CTASection />

      {/* Mobile Sticky Signup Bar */}
      <StickySignupBar
        source={`intent-tide-${citySlug}`}
        searchReferralCta={{
          ctaText: "Get Tide Alerts",
          supportingText: `Know when the tide is right in ${cityName}`,
        }}
      />
    </div>
  );
}
