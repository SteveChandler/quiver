/**
 * Forecast Accuracy Page
 *
 * Data-driven SEO content page showing Quiver ML forecast accuracy vs NOAA baseline.
 * Pulls from the beach_ml_performance_baseline materialized view via service role.
 *
 * URL: /forecast-accuracy
 * Rendering: force-dynamic (service-role Supabase fetches opt out of static rendering)
 */

import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";

import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { ForecastAccuracyDatasetSchema } from "@/components/seo/forecast-accuracy-dataset-schema";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

import { getForecastAccuracyReport } from "@/actions/ml/forecast-accuracy-actions";
import { AccuracyHero } from "@/components/forecast-accuracy/accuracy-hero";
import { NOAAComparisonBar } from "@/components/forecast-accuracy/noaa-comparison-bar";
import { RegionalAccuracyChart } from "@/components/forecast-accuracy/regional-accuracy-chart";
import { BeachAccuracyLeaderboard } from "@/components/forecast-accuracy/beach-accuracy-leaderboard";
import { MethodologySection } from "@/components/forecast-accuracy/methodology-section";
import { AccuracyFaq } from "@/components/forecast-accuracy/accuracy-faq";
import { CrowdsourceCta } from "@/components/forecast-accuracy/crowdsource-cta";
import { AccuracyBuildingRows } from "@/components/forecast-accuracy/accuracy-building-rows";

export const dynamic = "force-dynamic";

const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app"
).replace(/\/$/, "");

const getReport = cache(getForecastAccuracyReport);

export async function generateMetadata(): Promise<Metadata> {
  const report = await getReport();
  const hasLive = report.beachRows.length > 0;
  const metadata = buildPageMetadata({
    title: "Surf Forecast Accuracy: ML vs NOAA Baseline",
    description:
      "See how Quiver measures surf forecast accuracy against the NOAA marine baseline, with buoy-validated metrics when the live sample is ready.",
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

  if (hasLive) {
    return metadata;
  }

  return {
    ...metadata,
    robots: {
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
      },
    },
  };
}

export default async function ForecastAccuracyPage() {
  const report = await getReport();
  const { summary } = report;
  const hasLiveRows = report.beachRows.length > 0;

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
        name="Surf Forecast Accuracy: ML vs NOAA Baseline"
        url={`${SITE_ORIGIN}/forecast-accuracy`}
        description="Quiver's public surf forecast accuracy report, with buoy-validated metrics when the live sample is ready and clear building status when it is not."
      />
      {hasLiveRows && (
        <ForecastAccuracyDatasetSchema
          url={`${SITE_ORIGIN}/forecast-accuracy`}
          summary={summary}
          generatedAt={report.generatedAt}
        />
      )}

      <div className="container mx-auto max-w-5xl px-4 py-8">
        <ScrollReveal>
          <AccuracyHero
            status={summary.status}
            avgImprovementPct={summary.improvementPct}
            beachCount={summary.beachCount}
            totalPredictions={summary.validatedPairCount}
            latestValidatedDate={summary.lastUpdated}
            confidence={summary.confidence}
            canClaimImprovement={summary.canClaimImprovement}
          />
        </ScrollReveal>

        {!hasLiveRows && (
          <ScrollReveal>
            <div className="mb-8">
              <AccuracyBuildingRows rows={report.buildingRows} />
            </div>
          </ScrollReveal>
        )}

        {summary.noaaBaselineMae !== null && summary.quiverMae !== null && (
          <ScrollReveal>
            <div className="mb-8">
              <NOAAComparisonBar
                rawMae={summary.noaaBaselineMae}
                correctedMae={summary.quiverMae}
                timeSeries={report.dailyTimeSeries}
                canClaimImprovement={summary.canClaimImprovement}
              />
            </div>
          </ScrollReveal>
        )}

        {report.regionalData.length > 0 && (
          <ScrollReveal>
            <div className="mb-8">
              <RegionalAccuracyChart data={report.regionalData} />
            </div>
          </ScrollReveal>
        )}

        {hasLiveRows && (
          <ScrollReveal>
            <div className="mb-8">
              <BeachAccuracyLeaderboard beaches={report.beachRows} />
            </div>
          </ScrollReveal>
        )}

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
            <AccuracyFaq beachCount={summary.beachCount} />
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
