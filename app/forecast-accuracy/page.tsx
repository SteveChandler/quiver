/**
 * Forecast Accuracy Page
 *
 * Methodology page explaining what buoy validation can establish, what it
 * cannot establish, and the requirements for a fair forecast comparison.
 *
 * URL: /forecast-accuracy
 */

import type { Metadata } from "next";
import Link from "next/link";

import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { QuiverSticker, ZineSurface } from "@/components/zine";

import { AccuracyHero } from "@/components/forecast-accuracy/accuracy-hero";
import { AccuracyComparison } from "@/components/forecast-accuracy/accuracy-comparison";
import { MethodologySection } from "@/components/forecast-accuracy/methodology-section";
import { AccuracyFaq } from "@/components/forecast-accuracy/accuracy-faq";
import { CrowdsourceCta } from "@/components/forecast-accuracy/crowdsource-cta";

const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app"
).replace(/\/$/, "");

export const metadata: Metadata = buildPageMetadata({
  title: "How Surf Forecast Accuracy Is Measured",
  description:
    "Learn how Quiver checks wave-height forecasts against buoy observations, where that method falls short, and why no forecast accuracy ranking is claimed.",
  path: "/forecast-accuracy",
  image: "/api/og/forecast-accuracy",
  keywords: [
    "surf forecast accuracy",
    "wave prediction accuracy",
    "surf forecast methodology",
    "surf forecast buoy validation",
    "how accurate are surf forecasts",
    "significant wave height",
    "breaking wave face height",
    "wave height forecast error",
  ],
});

export default function ForecastAccuracyPage() {
  return (
    <>
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
        name="How Surf Forecast Accuracy Is Measured"
        url={`${SITE_ORIGIN}/forecast-accuracy`}
        description="How Quiver evaluates wave-height forecasts against buoy observations, the limits of that ground truth, and the requirements for a fair comparison."
      />

      <ZineSurface
        sectionLabel="Forecast accuracy"
        editionLabel="Method before ranking"
        data-testid="forecast-accuracy-zine-surface"
      >
        <main>
          <ScrollReveal>
            <div className="relative">
              <QuiverSticker
                sticker="orangeTape"
                className="absolute -top-7 right-6 hidden w-32 rotate-6 opacity-85 sm:block"
              />
              <p className="label-black mb-5">Forecast accuracy</p>
              <p className="typewriter mb-6 max-w-2xl">
                How wave-height forecasts are checked, where buoy observations
                help, and where they do not.
              </p>
              <AccuracyHero />
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="mt-12">
              <AccuracyComparison />
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="mt-12">
              <MethodologySection />
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="mt-12">
              <CrowdsourceCta />
            </div>
          </ScrollReveal>

          <section className="mt-14" aria-labelledby="accuracy-faq-heading">
            <ScrollReveal>
              <div className="mb-6 flex items-end justify-between gap-4 border-b-2 border-dashed border-[#11100D]/35 pb-4">
                <div>
                  <p className="typewriter mb-2">Straight answers</p>
                  <h2
                    id="accuracy-faq-heading"
                    className="font-heading text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl"
                  >
                    Forecast accuracy FAQ
                  </h2>
                </div>
                <QuiverSticker
                  sticker="spotSwellMatch"
                  className="hidden w-16 rotate-6 drop-shadow-sm sm:block"
                />
              </div>
            </ScrollReveal>
            <ScrollReveal>
              <AccuracyFaq />
            </ScrollReveal>
          </section>

          <ScrollReveal>
            <section className="mt-14 border-t-2 border-dashed border-[#11100D]/35 pt-10">
              <p className="typewriter mb-4 text-center">Next paddle</p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/forecast"
                  className="inline-flex min-h-11 items-center rounded-full border-2 border-[#11100D] bg-[#F78E42] px-5 py-2 font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.35)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3A75]"
                >
                  Check today&apos;s forecast
                </Link>
                <Link
                  href="/vs/surfline"
                  className="inline-flex min-h-11 items-center rounded-full border-2 border-[#11100D] bg-[#FBF6E8] px-5 py-2 font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.22)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3A75]"
                >
                  Compare product features
                </Link>
              </div>
            </section>
          </ScrollReveal>
        </main>
      </ZineSurface>
    </>
  );
}
