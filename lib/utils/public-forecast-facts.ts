import type { ForecastRecommendationContext } from "@/lib/services/forecast-recommendation-context";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";

const REPORT_FACT_KEYS = [
  "waveHeight",
  "windSpeed",
  "windCompass",
  "windType",
  "tideHeight",
  "tidePhase",
  "nextTideType",
  "forecastConfidence",
  "updatedAt",
] as const satisfies readonly (keyof SurfCallResult)[];

const CONTEXT_FACT_KEYS = [
  "localDate",
  "selectedRowTime",
  "waveHeight",
  "waveHeightRangeLabel",
  "swellPeriod",
  "swellDirection",
  "primarySwellHeight",
  "secondarySwellHeight",
  "secondarySwellPeriod",
  "secondarySwellDirection",
  "windSpeed",
  "windDirection",
  "primaryDataSource",
  "sourceDataUpdatedAt",
  "contributingSources",
  "timezone",
] as const satisfies readonly (keyof ForecastRecommendationContext)[];

export type PublicForecastReportFacts = Pick<
  SurfCallResult,
  (typeof REPORT_FACT_KEYS)[number]
>;

export type PublicForecastContextFacts = Pick<
  ForecastRecommendationContext,
  (typeof CONTEXT_FACT_KEYS)[number]
>;

function pick<T, K extends keyof T>(source: T, keys: readonly K[]): Pick<T, K> {
  return Object.fromEntries(keys.map((key) => [key, source[key]])) as Pick<
    T,
    K
  >;
}

export function selectPublicForecastReportFacts(
  report: SurfCallResult | null,
): PublicForecastReportFacts | null {
  return report ? pick(report, REPORT_FACT_KEYS) : null;
}

export function selectPublicForecastContextFacts(
  context: ForecastRecommendationContext | null,
): PublicForecastContextFacts | null {
  return context ? pick(context, CONTEXT_FACT_KEYS) : null;
}
