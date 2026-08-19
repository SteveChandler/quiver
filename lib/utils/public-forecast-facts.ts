import type { ForecastRecommendationContext } from "@/lib/services/forecast-recommendation-context";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";

export type PublicForecastReportFacts = Pick<
  SurfCallResult,
  | "waveHeight"
  | "windSpeed"
  | "windCompass"
  | "windType"
  | "tideHeight"
  | "tidePhase"
  | "nextTideType"
  | "forecastConfidence"
  | "updatedAt"
>;

export type PublicForecastContextFacts = Pick<
  ForecastRecommendationContext,
  | "localDate"
  | "selectedRowTime"
  | "waveHeight"
  | "waveHeightRangeLabel"
  | "swellPeriod"
  | "swellDirection"
  | "primarySwellHeight"
  | "secondarySwellHeight"
  | "secondarySwellPeriod"
  | "secondarySwellDirection"
  | "windSpeed"
  | "windDirection"
  | "primaryDataSource"
  | "sourceDataUpdatedAt"
  | "contributingSources"
  | "timezone"
>;

export function selectPublicForecastReportFacts(
  report: SurfCallResult | null,
): PublicForecastReportFacts | null {
  if (!report) return null;
  return {
    waveHeight: report.waveHeight,
    windSpeed: report.windSpeed,
    windCompass: report.windCompass,
    windType: report.windType,
    tideHeight: report.tideHeight,
    tidePhase: report.tidePhase,
    nextTideType: report.nextTideType,
    forecastConfidence: report.forecastConfidence,
    updatedAt: report.updatedAt,
  };
}

export function selectPublicForecastContextFacts(
  context: ForecastRecommendationContext | null,
): PublicForecastContextFacts | null {
  if (!context) return null;
  return {
    localDate: context.localDate,
    selectedRowTime: context.selectedRowTime,
    waveHeight: context.waveHeight,
    waveHeightRangeLabel: context.waveHeightRangeLabel,
    swellPeriod: context.swellPeriod,
    swellDirection: context.swellDirection,
    primarySwellHeight: context.primarySwellHeight,
    secondarySwellHeight: context.secondarySwellHeight,
    secondarySwellPeriod: context.secondarySwellPeriod,
    secondarySwellDirection: context.secondarySwellDirection,
    windSpeed: context.windSpeed,
    windDirection: context.windDirection,
    primaryDataSource: context.primaryDataSource,
    sourceDataUpdatedAt: context.sourceDataUpdatedAt,
    contributingSources: context.contributingSources,
    timezone: context.timezone,
  };
}
