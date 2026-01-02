"use client";

import { SurfHighlightsSection } from "@/components/landing-page/surf-highlights-section";
import { UpgradeSessionSection } from "./upgrade-session-section";
import { ActivitiesSection } from "@/components/landing-page/activities-section";
import { ForecastSection } from "@/components/landing-page/forecast-section";
import { CTASection } from "@/components/landing-page/cta-section";

export function LandingInteractiveSections() {
  return (
    <div className="space-y-0">
      <SurfHighlightsSection />
      <UpgradeSessionSection />
      <ActivitiesSection />
      <ForecastSection />
      <CTASection />
    </div>
  );
}




