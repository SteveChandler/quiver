"use client";

import { useEffect, useState } from "react";
import { BestConditionsSection } from "@/components/landing-page/best-conditions-section";
import { SurfHighlightsSection } from "@/components/landing-page/surf-highlights-section";
import { UpgradeSessionSection } from "./upgrade-session-section";
import { ActivitiesSection } from "@/components/landing-page/activities-section";
import { ForecastSection } from "@/components/landing-page/forecast-section";
import { CTASection } from "@/components/landing-page/cta-section";

function ForecastSectionFallback() {
  // Deterministic placeholder to avoid SSR/client mismatches (e.g. Intl/animation libs).
  return (
    <section className="py-16 md:py-20 px-4 bg-white" data-testid="forecast-section">
      <div className="max-w-6xl mx-auto">
        <div className="relative overflow-hidden rounded-[32px] sm:rounded-[40px] lg:rounded-[48px] bg-[#F3EEE6] shadow-sm ring-1 ring-black/5">
          <div className="px-4 sm:px-8 md:px-12 lg:px-20 py-12 md:py-16 lg:py-20">
            <div className="grid grid-cols-1 md:grid-cols-[180px_auto_1fr] gap-y-8 gap-x-12 lg:gap-x-24 items-center">
              <div className="hidden md:block w-[180px] shrink-0" />
              <div className="flex justify-center shrink-0">
                <div className="w-[260px] sm:w-[300px] md:w-[340px] lg:w-[360px] aspect-[9/19.5] rounded-[48px] bg-slate-900/20 animate-pulse" />
              </div>
              <div className="text-center md:text-left">
                <div className="h-10 w-64 bg-slate-900/10 rounded-md animate-pulse mx-auto md:mx-0" />
                <div className="mt-5 h-5 w-[340px] max-w-full bg-slate-900/10 rounded-md animate-pulse mx-auto md:mx-0" />
                <div className="mt-3 h-5 w-[280px] max-w-full bg-slate-900/10 rounded-md animate-pulse mx-auto md:mx-0" />
                <div className="mt-10 h-10 w-44 rounded-full bg-ocean-blue/20 animate-pulse mx-auto md:mx-0" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingInteractiveSections() {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  return (
    <div className="space-y-0">
      <BestConditionsSection />
      <SurfHighlightsSection />
      <UpgradeSessionSection />
      <ActivitiesSection />
      {hasMounted ? <ForecastSection /> : <ForecastSectionFallback />}
      <CTASection />
    </div>
  );
}


