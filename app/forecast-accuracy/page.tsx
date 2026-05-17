/**
 * Forecast Accuracy Page
 *
 * Data-driven SEO content page showing Quiver ML forecast accuracy vs NOAA baseline.
 * Pulls from the beach_ml_performance_baseline materialized view via service role.
 *
 * URL: /forecast-accuracy
 * Rendering: force-dynamic (requires service role key at runtime)
 */

import Link from "next/link";
import type { Metadata } from "next";

import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

import {
  type DailyAccuracyPoint,
  getOverallAccuracyStats,
  getRegionalAccuracy,
  getTopBeaches,
  getDailyAccuracyTimeSeries,
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
    title: "Surf Forecast Accuracy: ML vs NOAA Baseline",
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

interface AccuracySampleSummary {
  avgRawMae: number;
  avgCorrectedMae: number;
  avgImprovementPct: number;
  totalMatches: number;
  latestDate: string;
  dayCount: number;
}

function isPositiveMetric(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function summarizeTimeSeries(
  timeSeries: DailyAccuracyPoint[],
): AccuracySampleSummary | null {
  const validPoints = timeSeries.filter(
    (point) =>
      isPositiveMetric(point.rawMae) &&
      isPositiveMetric(point.correctedMae) &&
      isPositiveMetric(point.count),
  );

  if (validPoints.length === 0) return null;

  const totalMatches = validPoints.reduce((sum, point) => sum + point.count, 0);
  if (totalMatches <= 0) return null;

  const rawSum = validPoints.reduce(
    (sum, point) => sum + point.rawMae * point.count,
    0,
  );
  const correctedSum = validPoints.reduce(
    (sum, point) => sum + point.correctedMae * point.count,
    0,
  );
  const avgRawMae = rawSum / totalMatches;
  const avgCorrectedMae = correctedSum / totalMatches;
  const avgImprovementPct =
    avgRawMae > 0 ? ((avgRawMae - avgCorrectedMae) / avgRawMae) * 100 : 0;

  return {
    avgRawMae,
    avgCorrectedMae,
    avgImprovementPct,
    totalMatches,
    latestDate: validPoints[validPoints.length - 1].date,
    dayCount: validPoints.length,
  };
}

export default async function ForecastAccuracyPage() {
  const [
    overallStatsResult,
    regionalDataResult,
    topBeachesResult,
    dailyTimeSeriesResult,
  ] = await Promise.allSettled([
    getOverallAccuracyStats(),
    getRegionalAccuracy(),
    getTopBeaches(),
    getDailyAccuracyTimeSeries(),
  ]);

  const overallStats =
    overallStatsResult.status === "fulfilled" ? overallStatsResult.value : null;
  const regionalData =
    regionalDataResult.status === "fulfilled"
      ? regionalDataResult.value.filter(
          (row) =>
            isPositiveMetric(row.avgRawMae) &&
            isPositiveMetric(row.avgCorrectedMae),
        )
      : [];
  const topBeaches =
    topBeachesResult.status === "fulfilled" ? topBeachesResult.value : [];
  const dailyTimeSeries =
    dailyTimeSeriesResult.status === "fulfilled"
      ? dailyTimeSeriesResult.value
      : [];
  const accuracySample = summarizeTimeSeries(dailyTimeSeries);

  const hasEnoughData =
    overallStats !== null &&
    overallStats.beachCount >= MIN_BEACH_THRESHOLD &&
    accuracySample !== null;

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
        description="Live buoy-validated forecast accuracy data comparing Quiver's ML model against the NOAA marine baseline across 100+ surf beaches."
      />

      <div className="container mx-auto max-w-5xl px-4 py-8">
        {hasEnoughData ? (
          <>
            <ScrollReveal>
              <AccuracyHero
                avgImprovementPct={accuracySample.avgImprovementPct}
                beachCount={overallStats.beachCount}
                totalPredictions={accuracySample.totalMatches}
                latestValidatedDate={accuracySample.latestDate}
              />
            </ScrollReveal>

            <ScrollReveal>
              <div className="mb-8">
                <NOAAComparisonBar
                  rawMae={accuracySample.avgRawMae}
                  correctedMae={accuracySample.avgCorrectedMae}
                  timeSeries={dailyTimeSeries}
                />
              </div>
            </ScrollReveal>

            {regionalData.length > 0 && (
              <ScrollReveal>
                <div className="mb-8">
                  <RegionalAccuracyChart data={regionalData} />
                </div>
              </ScrollReveal>
            )}

            {topBeaches.length > 0 && (
              <ScrollReveal>
                <div className="mb-8">
                  <BeachAccuracyLeaderboard beaches={topBeaches} />
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
          </>
        ) : (
          <ScrollReveal>
            <div className="mb-12 rounded-[8px] border-2 border-[#11100D] bg-[#F4EBD8] p-8 text-center shadow-[4px_4px_0_#11100D]">
              <h1 className="mb-3 font-heading text-3xl font-black text-[#11100D]">
                How Accurate Is Quiver&apos;s Surf Forecast?
              </h1>
              <p className="mx-auto mb-6 max-w-xl text-lg font-semibold text-[#5F5646]">
                We&apos;re accumulating buoy-validated forecast data across our
                beach network. Check back in a few days; accuracy stats update
                daily as new observations arrive.
              </p>
              <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#11100D] bg-[#EFE5CF] px-4 py-2 text-sm font-black text-[#0B3A75] shadow-[2px_2px_0_#11100D]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#0B3A75]" />
                Data building in progress
              </div>
            </div>
          </ScrollReveal>
        )}

        {!hasEnoughData && (
          <ScrollReveal>
            <div className="mb-8">
              <MethodologySection />
            </div>
          </ScrollReveal>
        )}

        <ScrollReveal>
          <div className="mb-8">
            <AccuracyFaq beachCount={overallStats?.beachCount ?? 0} />
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
