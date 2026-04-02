import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type {
  BeginnerConditionsBadge,
  RightNowConditions as RightNowConditionsType,
  BeginnerBeachWithEditorial,
  BeginnerCityEditorial,
} from "@/types/beginner";
import type { IntentKey } from "@/lib/constants/intent-definitions";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { FAQSection } from "@/components/seo/faq-schema";
import { generateIntentFAQ } from "@/lib/seo/intent-faq-generator";
import { CTASection } from "@/components/landing-page/cta-section";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";
import { AlertCaptureCta } from "@/components/seo/alert-capture-cta";
import { BeginnerHero } from "./BeginnerHero";
import { RightNowConditions } from "./RightNowConditions";
import { BeginnerSpotList } from "./BeginnerSpotList";
import { WhatToExpect } from "./WhatToExpect";
import { SeasonalGuide } from "./SeasonalGuide";
import { SafetyEssentials } from "./SafetyEssentials";
import { GearAndLessons } from "./GearAndLessons";
import { SessionGallery } from "./SessionGallery";
import { ContinueExploring } from "@/components/shared/continue-exploring";
import { SectionFadeUp } from "./SectionFadeUp";

interface BeginnerPageContentProps {
  cityName: string;
  citySlug: string;
  stateSlug: string;
  stateName: string;
  regionLabel: string;
  conditionsBadge: BeginnerConditionsBadge | null;
  rightNowConditions: RightNowConditionsType | null;
  beaches: BeginnerBeachWithEditorial[];
  cityEditorial: BeginnerCityEditorial | null;
  totalBeaches: number;
  baseUrl: string;
  bestTimeToSurfUrl?: string;
  excludeIntents?: IntentKey[];
}

export function BeginnerPageContent({
  cityName,
  citySlug,
  stateSlug,
  stateName,
  regionLabel,
  conditionsBadge,
  rightNowConditions,
  beaches,
  cityEditorial,
  totalBeaches,
  baseUrl,
  bestTimeToSurfUrl,
  excludeIntents,
}: BeginnerPageContentProps) {
  const faqItems = generateIntentFAQ(
    "beginner",
    cityName,
    beaches.slice(0, 3).map((b) => b.name),
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
            name: "Beginner Spots",
            url: `${baseUrl}/beginner/${citySlug}`,
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
          <span className="text-gray-800 font-medium">Beginner Spots</span>
        </nav>

        <div className="space-y-12">
          {/* Module 1: Hero + Conditions Badge */}
          <BeginnerHero
            cityName={cityName}
            regionLabel={regionLabel}
            totalBeaches={totalBeaches}
            conditionsBadge={conditionsBadge}
            cityEditorial={cityEditorial}
          />

          {/* Module 2: Right Now Conditions */}
          {rightNowConditions && (
            <SectionFadeUp delay={0.1}>
              <RightNowConditions conditions={rightNowConditions} />
            </SectionFadeUp>
          )}

          {/* Module 3: Curated Spot Cards */}
          <SectionFadeUp delay={0.15}>
            <BeginnerSpotList cityName={cityName} stateSlug={stateSlug} citySlug={citySlug} beaches={beaches} />
          </SectionFadeUp>

          {/* Alert Capture CTA */}
          <SectionFadeUp delay={0.1}>
            <AlertCaptureCta
              pageContext="beginner"
              beachId={beaches[0]?.id ?? ""}
              beachName={cityName}
              source={`intent-beginner-${citySlug}`}
              className="my-8"
            />
          </SectionFadeUp>

          {/* Module 4: What to Expect Editorial */}
          {cityEditorial && (
            <SectionFadeUp>
              <WhatToExpect cityName={cityName} cityEditorial={cityEditorial} />
            </SectionFadeUp>
          )}

          {/* Module 5: Seasonal Guide */}
          <SectionFadeUp>
            <SeasonalGuide cityName={cityName} stateSlug={stateSlug} />
          </SectionFadeUp>

          {/* Module 6: Safety Essentials */}
          <SectionFadeUp>
            <SafetyEssentials cityName={cityName} />
          </SectionFadeUp>

          {/* Module 7: Gear & Lessons */}
          <SectionFadeUp>
            <GearAndLessons />
          </SectionFadeUp>

          {/* Module 8: Session Gallery */}
          <SectionFadeUp>
            <SessionGallery cityName={cityName} />
          </SectionFadeUp>

          {/* Continue Exploring */}
          <SectionFadeUp>
            <ContinueExploring
              currentIntent="beginner"
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

          {/* Planning Checklist */}
          {cityEditorial && cityEditorial.planningChecklist.length > 0 && (
            <SectionFadeUp>
              <aside className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50/40 to-indigo-50/40 border border-blue-200/50 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-3">
                  Beginner checklist
                </h2>
                <ul className="space-y-2 text-sm text-gray-700">
                  {cityEditorial.planningChecklist.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-sky-600 mt-0.5">-</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </aside>
            </SectionFadeUp>
          )}
        </div>
      </div>

      <CTASection />
      <StickySignupBar
        source={`intent-beginner-${citySlug}`}
        searchReferralCta={{
          ctaText: "Mellow Session Alerts",
          supportingText: "Get notified when conditions are gentle",
        }}
      />
    </div>
  );
}
