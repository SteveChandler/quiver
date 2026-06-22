/**
 * Forecast Accuracy Page
 *
 * Curated marketing comparison: Quiver vs Surfline vs NOAA on wave-height
 * accuracy (MAE vs buoy readings). Static content from the curated constant in
 * lib/forecast-accuracy/curated-comparison.ts — no live data fetch.
 *
 * URL: /forecast-accuracy
 */

import type { Metadata } from "next";
import Link from "next/link";

import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

import { AccuracyHero } from "@/components/forecast-accuracy/accuracy-hero";
import { PersonalFitSection } from "@/components/forecast-accuracy/personal-fit-section";
import { AccuracyComparison } from "@/components/forecast-accuracy/accuracy-comparison";
import { MethodologySection } from "@/components/forecast-accuracy/methodology-section";
import { AccuracyFaq } from "@/components/forecast-accuracy/accuracy-faq";
import { CrowdsourceCta } from "@/components/forecast-accuracy/crowdsource-cta";

const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app"
).replace(/\/$/, "");

export const metadata: Metadata = buildPageMetadata({
  title: "Surf Forecast Accuracy: Quiver vs Surfline vs NOAA",
  description:
    "Quiver learns what you like from your logged sessions and matches forecasts to your taste — and its wave-height forecast beats Surfline and the NOAA baseline against real buoy readings. More accurate, more personal, for free.",
  path: "/forecast-accuracy",
  image: "/api/og/forecast-accuracy",
  keywords: [
    "surf forecast accuracy",
    "wave prediction accuracy",
    "quiver vs surfline accuracy",
    "NOAA surf forecast comparison",
    "most accurate surf forecast",
    "surf forecast buoy validation",
    "how accurate are surf forecasts",
    "wave height forecast error",
  ],
});

export default function ForecastAccuracyPage() {
  return (
    <div className="min-h-screen bg-[#F4EBD8] text-[#11100D]">
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${SITE_ORIGIN}/` },
          {
            name: "Forecast Accuracy",
            url: `${SITE_ORIGIN}/forecast-accuracy`,
          },
        ]}
      />
      <WebPageSchema
        name="Surf Forecast Accuracy: Quiver vs Surfline vs NOAA"
        url={`${SITE_ORIGIN}/forecast-accuracy`}
        description="Quiver's surf forecast accuracy compared against Surfline and the NOAA baseline, measured as wave-height error against real buoy readings."
      />

      <div className="container mx-auto max-w-5xl px-4 py-8">
        <ScrollReveal>
          <AccuracyHero />
        </ScrollReveal>

        <ScrollReveal>
          <div className="mb-8">
            <PersonalFitSection />
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="mb-8">
            <AccuracyComparison />
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="mb-8">
            <MethodologySection />
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="mb-8">
            <CrowdsourceCta />
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="mb-8">
            <AccuracyFaq />
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/forecast"
              className="inline-flex rounded-[8px] border-2 border-[#11100D] bg-[#F78E42] px-5 py-3 text-sm font-black text-[#11100D] shadow-[3px_3px_0_#11100D] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3A75]"
            >
              Check today&apos;s forecast
            </Link>
            <Link
              href="/vs/surfline"
              className="inline-flex rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] px-5 py-3 text-sm font-black text-[#11100D] shadow-[3px_3px_0_#11100D] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3A75]"
            >
              Compare Surfline
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
