/**
 * Forecast Accuracy Page
 *
 * Data-driven SEO content page showing Quiver ML forecast accuracy vs NOAA baseline.
 * Pulls from the beach_ml_performance_baseline materialized view via service role.
 *
 * URL: /forecast-accuracy
 * ISR: 6 hours (21600s)
 */

import Link from "next/link";
import type { Metadata } from "next";

import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

import {
  getOverallAccuracyStats,
  getRegionalAccuracy,
  getTopBeaches,
} from "@/actions/ml/forecast-accuracy-actions";
import { AccuracyHero } from "@/components/forecast-accuracy/accuracy-hero";
import { NOAAComparisonBar } from "@/components/forecast-accuracy/noaa-comparison-bar";
import { RegionalAccuracyChart } from "@/components/forecast-accuracy/regional-accuracy-chart";
import { BeachAccuracyLeaderboard } from "@/components/forecast-accuracy/beach-accuracy-leaderboard";
import { MethodologySection } from "@/components/forecast-accuracy/methodology-section";
import { AccuracyFaq } from "@/components/forecast-accuracy/accuracy-faq";
import { CrowdsourceCta } from "@/components/forecast-accuracy/crowdsource-cta";

export const dynamic = "force-dynamic";

const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app"
).replace(/\/$/, "");

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "Surf Forecast Accuracy — ML vs NOAA Baseline",
    description:
      "See how accurate Quiver's ML-corrected surf forecasts are versus the NOAA marine baseline. Live buoy-validated data across 100+ beaches. Updated daily.",
    path: "/forecast-accuracy",
    image: "/api/og/forecast-accuracy",
    keywords: [
      "surf forecast accuracy",
      "wave prediction accuracy",
      "NOAA surf forecast comparison",
      "ML surf forecast",
      "surf forecast buoy validation",
      "how accurate are surf forecasts",
      "wave height forecast error",
    ],
  });
}

// Minimum beaches required to show charts instead of the "data building" message
const MIN_BEACH_THRESHOLD = 5;

export default async function ForecastAccuracyPage() {
  // Fetch all data in parallel
  const [overallStats, regionalData, topBeaches] = await Promise.all([
    getOverallAccuracyStats(),
    getRegionalAccuracy(),
    getTopBeaches(),
  ]);

  const hasEnoughData =
    overallStats !== null && overallStats.beachCount >= MIN_BEACH_THRESHOLD;

  return (
    <div className="bg-gradient-to-b from-sky-50 via-blue-50/30 to-white min-h-screen">
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
        name="Surf Forecast Accuracy — ML vs NOAA Baseline"
        url={`${SITE_ORIGIN}/forecast-accuracy`}
        description="Live buoy-validated forecast accuracy data comparing Quiver's ML model against the NOAA marine baseline across 100+ surf beaches."
      />

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {hasEnoughData ? (
          <>
            {/* Hero with stat cards */}
            <ScrollReveal>
              <AccuracyHero
                avgImprovementPct={overallStats.avgImprovementPct}
                beachCount={overallStats.beachCount}
                totalPredictions={overallStats.totalPredictions}
              />
            </ScrollReveal>

            {/* NOAA vs Quiver comparison bar chart */}
            <ScrollReveal>
              <div className="mb-8">
                <NOAAComparisonBar
                  rawMae={overallStats.avgRawMae}
                  correctedMae={overallStats.avgCorrectedMae}
                />
              </div>
            </ScrollReveal>

            {/* Regional breakdown chart (only if we have regional data) */}
            {regionalData.length > 0 && (
              <ScrollReveal>
                <div className="mb-8">
                  <RegionalAccuracyChart data={regionalData} />
                </div>
              </ScrollReveal>
            )}

            {/* Top beaches leaderboard (only if we have beach data) */}
            {topBeaches.length > 0 && (
              <ScrollReveal>
                <div className="mb-8">
                  <BeachAccuracyLeaderboard beaches={topBeaches} />
                </div>
              </ScrollReveal>
            )}

            {/* Crowdsource CTA */}
            <ScrollReveal>
              <div className="mb-8">
                <CrowdsourceCta />
              </div>
            </ScrollReveal>
          </>
        ) : (
          /* Sparse data — show placeholder while data accumulates */
          <ScrollReveal>
            <div className="mb-12 rounded-2xl border border-white/15 bg-white p-8 text-center">
              <h1 className="text-3xl font-bold text-white mb-3">
                How Accurate Is Quiver&apos;s Surf Forecast?
              </h1>
              <p className="text-lg text-medium max-w-xl mx-auto mb-6">
                We&apos;re accumulating buoy-validated forecast data across our
                beach network. Check back in a few days — accuracy stats update
                daily as new observations arrive.
              </p>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-sky-300 font-medium">
                <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
                Data building in progress
              </div>
            </div>
          </ScrollReveal>
        )}

        {/* Methodology — always shown */}
        <ScrollReveal>
          <div className="mb-8">
            <MethodologySection />
          </div>
        </ScrollReveal>

        {/* FAQ — always shown, uses beach count from stats or 0 fallback */}
        <ScrollReveal>
          <div className="mb-8">
            <AccuracyFaq beachCount={overallStats?.beachCount ?? 0} />
          </div>
        </ScrollReveal>

        {/* CTA */}
        <ScrollReveal>
          <section className="rounded-2xl bg-gradient-to-br from-ocean-blue to-blue-700 p-6 md:p-8 text-white text-center">
            <h2 className="text-xl md:text-2xl font-bold mb-2">
              Ready to check the forecast?
            </h2>
            <p className="text-white/80 mb-6 max-w-lg mx-auto">
              Get ML-corrected surf forecasts, tide charts, and crowd levels for
              beaches across the US.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/forecast"
                className="inline-flex items-center px-5 py-2.5 rounded-lg bg-white text-ocean-blue font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                7-Day Forecast
              </Link>
              <Link
                href="/beaches"
                className="inline-flex items-center px-5 py-2.5 rounded-lg bg-white/10 text-white font-semibold text-sm hover:bg-white/20 transition-colors border border-white/30"
              >
                Browse All Beaches
              </Link>
              <Link
                href="/vs/surfline"
                className="inline-flex items-center px-5 py-2.5 rounded-lg bg-white/10 text-white font-semibold text-sm hover:bg-white/20 transition-colors border border-white/30"
              >
                Quiver vs Surfline
              </Link>
            </div>
          </section>
        </ScrollReveal>
      </div>
    </div>
  );
}
