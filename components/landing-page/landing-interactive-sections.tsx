"use client";

import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { SurfHighlightsSection } from "@/components/landing-page/surf-highlights-section";
import { FeatureBentoSection } from "./feature-bento-section";
import { MLPipelineShowcase } from "@/components/landing-page/ml-pipeline-showcase";
import { ActivitiesSection } from "@/components/landing-page/activities-section";
import { ForecastSection } from "@/components/landing-page/forecast-section";
import { CTASection } from "@/components/landing-page/cta-section";
import { LandingPricingTeaser } from "@/components/pricing/landing-pricing-teaser";
import { PlatformStatusStrip } from "@/components/landing-page/platform-status-strip";
import { AppProofWalkthrough } from "@/components/landing-page/app-proof-walkthrough";
import { NativeAppFunnelCta } from "@/components/app-store/native-app-funnel-cta";
import type { FirstTouchPlatform } from "@/lib/analytics/web-context";

function ForecastSectionFallback() {
  // Deterministic placeholder to avoid SSR/client mismatches (e.g. Intl/animation libs).
  return (
    <section
      className="py-16 md:py-20 px-4 bg-[#252D6B] noise-texture"
      data-testid="forecast-section"
    >
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

interface LandingInteractiveSectionsProps {
  initialPlatform?: FirstTouchPlatform;
  appFirst?: boolean;
}

const FINAL_NATIVE_CTA_CLASS =
  "inline-flex min-h-12 items-center justify-center rounded-[14px_6px_16px_6px] bg-ocean-blue-decorative px-6 py-3 font-heading text-base font-bold text-background shadow-[0_4px_0_rgba(0,0,0,0.32)] transition hover:bg-[#D57835] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-blue-decorative focus-visible:ring-offset-2 focus-visible:ring-offset-background active:bg-[#C06A25]";

function FinalNativeCtaSection({
  platform,
}: {
  platform: FirstTouchPlatform;
}): ReactElement {
  return (
    <section className="bg-background px-5 py-16 text-foreground md:py-20">
      <div className="mx-auto grid max-w-7xl gap-8 rounded-[28px_12px_32px_16px] border border-white/12 bg-card p-6 shadow-[0_18px_70px_rgba(0,0,0,0.28)] md:grid-cols-[minmax(0,0.9fr)_minmax(320px,1fr)] md:items-center md:p-10">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-sunset-orange">
            keep the call close
          </p>
          <h2 className="mt-3 font-heading text-3xl font-black uppercase leading-none sm:text-5xl">
            Get the surf call where you check it.
          </h2>
          <p className="mt-4 max-w-xl font-sans text-base leading-7 text-muted-foreground">
            Same app-first handoff: App Store on iPhone, waitlist on Android,
            QR and email on desktop.
          </p>
        </div>

        <NativeAppFunnelCta
          platform={platform}
          source="landing_final_cta"
          surface="landing-page"
          placement="final_cta"
          variant="app_first"
          cohort="app_first"
          className={FINAL_NATIVE_CTA_CLASS}
          desktopClassName="w-full rounded-[22px_10px_26px_12px] border-sunset-orange/20"
        />
      </div>
    </section>
  );
}

export function LandingInteractiveSections({
  initialPlatform = "desktop",
  appFirst = false,
}: LandingInteractiveSectionsProps = {}) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (appFirst) {
    return (
      <div className="space-y-0">
        <PlatformStatusStrip platform={initialPlatform} />
        <AppProofWalkthrough />
        <SurfHighlightsSection trustProof />
        <FinalNativeCtaSection platform={initialPlatform} />
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <SurfHighlightsSection />
      <div suppressHydrationWarning>
        {hasMounted ? <ForecastSection /> : <ForecastSectionFallback />}
      </div>
      <MLPipelineShowcase />
      <ActivitiesSection />
      <FeatureBentoSection />
      <LandingPricingTeaser />
      <CTASection
        source="landing-final-cta"
        ctaCopyVariant="landing_ios_app_v1"
        variant="app-store"
      />
    </div>
  );
}
