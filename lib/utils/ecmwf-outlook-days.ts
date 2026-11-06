import { parseWaveHeightMidpointFt } from "@/lib/alerts/forecast-parsers";
import { extractForecastDate } from "@/lib/utils/forecast-at-adapter";
import { isFallbackForecastRow } from "@/lib/utils/forecast-row-source";
import type { EnhancedForecastEntity } from "@/types/forecast";

export type OutlookTrend = "building" | "dropping" | "steady";

export interface OutlookDay {
  /** Beach-local calendar date, YYYY-MM-DD. */
  localDate: string;
  dayName: string;
  date: string;
  lowFt: number;
  highFt: number;
  trend: OutlookTrend;
}

/** A day-mean change under 15% reads as steady; finer moves are past this model's skill. */
const TREND_THRESHOLD = 0.15;
/** Half a day of 3-hour slots; a thinner day at the end of the run would show a misleading range. */
const MIN_SLOTS_PER_DAY = 4;
const SLOTS_PER_DAY = 8;

function outlookFaceFt(row: EnhancedForecastEntity): number | null {
  if (!isFallbackForecastRow(row)) return null;
  const face = row.raw_forecast?.ecmwf_outlook?.face_ft;
  return typeof face === "number" && Number.isFinite(face) && face >= 0 ? face : null;
}

function modelFaceFt(row: EnhancedForecastEntity): number | null {
  return isFallbackForecastRow(row) ? null : parseWaveHeightMidpointFt(row.wave_height);
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function trendFrom(previous: number | null, current: number): OutlookTrend {
  if (previous === null || previous <= 0) return "steady";
  const change = (current - previous) / previous;
  if (change >= TREND_THRESHOLD) return "building";
  if (change <= -TREND_THRESHOLD) return "dropping";
  return "steady";
}

/**
 * Whole local days past the model forecast that only the ECMWF outlook
 * covers, as a size range and a trend. A day with any model row is the
 * horizon strip's, never the outlook's. The first outlook day trends against
 * the last model day's mean face height.
 */
export function aggregateOutlookDays(forecasts: EnhancedForecastEntity[], timezone: string): OutlookDay[] {
  const outlookByDate = new Map<string, number[]>();
  const modelByDate = new Map<string, number[]>();
  const modelFaces: Array<{ ms: number; face: number }> = [];
  for (const row of forecasts) {
    if (!row.forecast_at) continue;
    const date = extractForecastDate(row.forecast_at, timezone);
    const model = modelFaceFt(row);
    if (model !== null) {
      modelByDate.set(date, [...(modelByDate.get(date) ?? []), model]);
      modelFaces.push({ ms: Date.parse(row.forecast_at), face: model });
      continue;
    }
    const outlook = outlookFaceFt(row);
    if (outlook !== null) outlookByDate.set(date, [...(outlookByDate.get(date) ?? []), outlook]);
  }

  const modelDates = [...modelByDate.keys()].sort();
  const lastModelDate = modelDates.at(-1);
  // The last model date is often a few slots at the seam; trend against its last 24 h instead.
  const lastDayFaces = modelFaces.sort((a, b) => a.ms - b.ms).slice(-SLOTS_PER_DAY).map((entry) => entry.face);
  let previousMean = lastDayFaces.length > 0 ? mean(lastDayFaces) : null;

  return [...outlookByDate.keys()]
    .filter((date) => !modelByDate.has(date) && (!lastModelDate || date > lastModelDate))
    .filter((date) => outlookByDate.get(date)!.length >= MIN_SLOTS_PER_DAY)
    .sort()
    .map((localDate) => {
      const faces = outlookByDate.get(localDate)!;
      const dayMean = mean(faces);
      const trend = trendFrom(previousMean, dayMean);
      previousMean = dayMean;
      const lowFt = Math.max(0, Math.floor(Math.min(...faces)));
      const highFt = Math.max(lowFt + 1, Math.ceil(Math.max(...faces)));
      // A calendar date, not an instant: format it at UTC noon so no zone shifts it.
      const noon = new Date(`${localDate}T12:00:00Z`);
      const dayName = noon.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
      const date = noon.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
      return { localDate, dayName, date, lowFt, highFt, trend };
    });
}
