import { parseWaveHeightRangeFt } from "@/lib/alerts/forecast-parsers";
import { isFallbackForecastRow } from "@/lib/utils/forecast-row-source";
import type { EcmwfOutlookSeries } from "@/lib/services/noaa-wavewatch/types";
import type { EcmwfOutlookSlot, EnhancedForecastWithRawData } from "@/types/forecast";
import { MIN_SEAM_PAIRS } from "@/lib/services/noaa-wavewatch/ecmwf-outlook";

/** Seam window for the face scale: the last 72 h of rows with a displayed height. */
const SEAM_WINDOW_MS = 72 * 3_600_000;
const MIN_HS_M = 0.1;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function displayedFaceFt(row: EnhancedForecastWithRawData): number | null {
  if (isFallbackForecastRow(row)) return null;
  const range = parseWaveHeightRangeFt(row.wave_height ?? null);
  return range ? (range.min + range.max) / 2 : null;
}

/**
 * Put the ECMWF outlook on FALLBACK rows after the model seam. The rows stay
 * FALLBACK with null wave fields, so every scorer, alert and native reader
 * treats them as before; only outlook UI reads `raw_forecast.ecmwf_outlook`.
 *
 * Face scale = median(displayed face ft / WAM Hs m) over the last 72 h of
 * displayed heights, so the outlook carries this beach's own shoaling,
 * exposure and calibration as users see them at the seam. Mutates `rows`.
 */
export function attachEcmwfOutlook(
  rows: EnhancedForecastWithRawData[],
  series: EcmwfOutlookSeries | undefined,
): number {
  if (!series) return 0;
  const hsByMs = new Map(series.points.map((point) => [point.ms, point.hs_m]));

  const faced = rows
    .map((row) => ({ ms: Date.parse(row.forecast_at ?? ""), face: displayedFaceFt(row) }))
    .filter((entry): entry is { ms: number; face: number } => Number.isFinite(entry.ms) && entry.face !== null);
  if (faced.length === 0) return 0;
  const lastFacedMs = Math.max(...faced.map((entry) => entry.ms));

  const ratios: number[] = [];
  for (const entry of faced) {
    if (entry.ms <= lastFacedMs - SEAM_WINDOW_MS) continue;
    const hsM = hsByMs.get(entry.ms);
    if (hsM === undefined || hsM < MIN_HS_M) continue;
    ratios.push(entry.face / hsM);
  }
  if (ratios.length < MIN_SEAM_PAIRS) return 0;
  const faceFtPerM = median(ratios);
  if (!Number.isFinite(faceFtPerM) || faceFtPerM <= 0) return 0;

  const startsAfterMs = Math.max(lastFacedMs, series.starts_after_ms);
  let attached = 0;
  for (const row of rows) {
    if (!isFallbackForecastRow(row) || row.wave_height != null) continue;
    const ms = Date.parse(row.forecast_at ?? "");
    if (!(ms > startsAfterMs)) continue;
    const hsM = hsByMs.get(ms);
    if (hsM === undefined) continue;
    const slot: EcmwfOutlookSlot = {
      model: series.model,
      face_ft: Number((hsM * faceFtPerM).toFixed(1)),
      hs_m: hsM,
      face_ft_per_m: Number(faceFtPerM.toFixed(3)),
      seam_pairs: ratios.length,
      model_ratio: series.model_ratio,
    };
    row.raw_forecast = { ...(row.raw_forecast ?? { data_sources: [] }), ecmwf_outlook: slot };
    attached += 1;
  }
  return attached;
}
