"use client";

import { useEffect, useState } from "react";
import { SurfHighlightsSection } from "@/components/landing-page/surf-highlights-section";
import { FeatureBentoSection } from "./feature-bento-section";
import { MLPipelineShowcase } from "@/components/landing-page/ml-pipeline-showcase";
import { ActivitiesSection } from "@/components/landing-page/activities-section";
import { ForecastSection } from "@/components/landing-page/forecast-section";
import { CTASection } from "@/components/landing-page/cta-section";


function ForecastSectionFallback() {
  // Deterministic placeholder to avoid SSR/client mismatches (e.g. Intl/animation libs).
  return (
    <section className="py-16 md:py-20 px-4 bg-[#252D6B] noise-texture" data-testid="forecast-section">
      <div className="max-w-6xl mx-auto">
        <div className="relative overflow-hidden rounded-3xl bg-white/[0.04] border border-white/[0.08]">
          <div className="px-4 sm:px-8 md:px-12 lg:px-20 py-12 md:py-16 lg:py-20">
            <div className="grid grid-cols-1 md:grid-cols-[180px_auto_1fr] gap-y-8 gap-x-12 lg:gap-x-24 items-center">
              <div className="hidden md:block w-[180px] shrink-0" />
              <div className="flex justify-center shrink-0">
                <div className="w-[260px] sm:w-[300px] md:w-[340px] lg:w-[360px] aspect-[9/19.5] rounded-[48px] bg-white/[0.06] animate-pulse" />
              </div>
              <div className="text-center md:text-left">
                <div className="h-10 w-64 bg-white/[0.08] rounded-md animate-pulse mx-auto md:mx-0" />
                <div className="mt-5 h-5 w-[340px] max-w-full bg-white/[0.08] rounded-md animate-pulse mx-auto md:mx-0" />
                <div className="mt-3 h-5 w-[280px] max-w-full bg-white/[0.08] rounded-md animate-pulse mx-auto md:mx-0" />
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
      <SurfHighlightsSection />
      <FeatureBentoSection />
      <MLPipelineShowcase />
      <ActivitiesSection />
      <div suppressHydrationWarning>
        {hasMounted ? <ForecastSection /> : <ForecastSectionFallback />}
      </div>
      <CTASection />
    </div>
  );
}
