/**
 * ECMWF WAM long-range outlook: total wave height past the end of the default
 * model's swell partitions (about day 9.3), out to day 15.
 *
 * WAM carries no swell partitions on Open-Meteo, so this series never becomes
 * a normal forecast row. It is scaled at the seam (the last valid model slots)
 * and shown only as an outlook range and trend.
 *
 * Measured Nov 6 2026 on 42 beaches: WAM/best_match total Hs runs 0.14-2.9 by
 * beach and differs inside one region (cell geometry, not region), and drifts
 * with lead time. So the ratio is computed per beach, per sync, from the slots
 * next to the seam, and a beach outside the trusted band gets no outlook.
 *
 * @module noaa-wavewatch/ecmwf-outlook
 */

import { fetchOpenMeteoData } from "./api-client";
import { getOceanGridPoint } from "./grid-utils";
import type { EcmwfOutlookSeries, WaveWatchData } from "./types";

const ECMWF_OUTLOOK_MODEL = "ecmwf_wam025";
/** Open-Meteo serves WAM to about day 14.5; 15 is the product cap. */
const ECMWF_OUTLOOK_MAX_DAYS = 15;
const FETCH_DAYS = 16;
/** Seam window: the last 72 h of valid model slots. */
const SEAM_WINDOW_MS = 72 * 3_600_000;
/** Fewer matched slots than this and the ratio is noise. */
export const MIN_SEAM_PAIRS = 8;
/** WAM/model Hs ratio band; outside it the two cells disagree too much to scale. */
const MIN_MODEL_RATIO = 0.5;
const MAX_MODEL_RATIO = 2;
/** Below this Hs (m) a ratio is dominated by rounding. */
const MIN_RATIO_HS_M = 0.1;

export interface WamPoint {
  /** Epoch ms of the valid hour. */
  ms: number;
  hsM: number;
}

/**
 * One 0.25° WAM cell offshore. Measured Nov 6 2026: 22 of 574 beaches sit in a
 * land-masked (all-null) WAM cell, and a 0.25° shift seaward returned data for
 * 15 of the 17 that could be checked. The seam ratio gate still rejects an
 * offshore cell that reads too far from the beach's own model.
 */
const NULL_CELL_SHIFT_DEG = 0.25;

function offshorePoint(latitude: number, longitude: number): { lat: number; lon: number } | null {
  const ocean = getOceanGridPoint(latitude, longitude);
  const dLat = Math.sign(ocean.lat - latitude);
  const dLon = Math.sign(ocean.lon - longitude);
  if (dLat === 0 && dLon === 0) return null;
  return { lat: latitude + dLat * NULL_CELL_SHIFT_DEG, lon: longitude + dLon * NULL_CELL_SHIFT_DEG };
}

async function fetchWamAt(latitude: number, longitude: number, signal?: AbortSignal): Promise<WamPoint[] | null> {
  const data = await fetchOpenMeteoData(latitude, longitude, FETCH_DAYS, {
    model: ECMWF_OUTLOOK_MODEL,
    hourly: ["wave_height"],
    timeformat: "unixtime",
    signal,
  });
  return parseWamSeries(data?.hourly);
}

/**
 * WAM total Hs by valid hour; null when the request fails or the cell (and
 * the cell offshore of it) is all null.
 */
export async function fetchEcmwfWamSeries(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<WamPoint[] | null> {
  const atBeach = await fetchWamAt(latitude, longitude, signal);
  if (atBeach) return atBeach;
  const offshore = offshorePoint(latitude, longitude);
  return offshore ? fetchWamAt(offshore.lat, offshore.lon, signal) : null;
}

export function parseWamSeries(
  hourly: { time: Array<string | number>; wave_height?: Array<number | null> } | undefined,
): WamPoint[] | null {
  if (!hourly?.time || !hourly.wave_height) return null;
  const points: WamPoint[] = [];
  hourly.time.forEach((time, index) => {
    const hsM = hourly.wave_height?.[index];
    if (typeof time !== "number" || typeof hsM !== "number" || !Number.isFinite(hsM) || hsM < 0) return;
    points.push({ ms: time * 1000, hsM });
  });
  return points.length > 0 ? points : null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function hasModelHeight(point: WaveWatchData): boolean {
  return point.data_source !== "FALLBACK"
    && point.has_reported_wave_height !== false
    && Number.isFinite(point.significant_wave_height)
    && point.significant_wave_height >= MIN_RATIO_HS_M;
}

/**
 * The WAM series for a beach plus its seam ratio, or null when WAM cannot be
 * trusted here: no WAM, no merged model slots, too few seam pairs, or a ratio
 * outside the band. The series is kept whole so the row builder can pair it
 * with displayed face heights across the same seam window.
 */
export function buildEcmwfOutlookSeries(
  merged: WaveWatchData[],
  wam: WamPoint[] | null,
  nowMs: number = Date.now(),
): EcmwfOutlookSeries | null {
  if (!wam?.length) return null;
  const modelPoints = merged.filter(hasModelHeight);
  if (modelPoints.length === 0) return null;
  const lastModelMs = Math.max(...modelPoints.map((point) => Date.parse(point.timestamp)));
  if (!Number.isFinite(lastModelMs)) return null;

  const wamByMs = new Map(wam.map((point) => [point.ms, point.hsM]));
  const ratios: number[] = [];
  for (const point of modelPoints) {
    const ms = Date.parse(point.timestamp);
    if (ms <= lastModelMs - SEAM_WINDOW_MS) continue;
    const hsM = wamByMs.get(ms);
    if (hsM === undefined || hsM < MIN_RATIO_HS_M) continue;
    ratios.push(hsM / point.significant_wave_height);
  }
  if (ratios.length < MIN_SEAM_PAIRS) return null;
  const modelRatio = median(ratios);
  if (!(modelRatio >= MIN_MODEL_RATIO && modelRatio <= MAX_MODEL_RATIO)) return null;

  const capMs = nowMs + ECMWF_OUTLOOK_MAX_DAYS * 86_400_000;
  const tailCount = wam.filter((point) => point.ms > lastModelMs && point.ms <= capMs).length;
  if (tailCount === 0) return null;

  return {
    model: ECMWF_OUTLOOK_MODEL,
    points: wam.filter((point) => point.ms <= capMs).map((point) => ({ ms: point.ms, hs_m: point.hsM })),
    starts_after_ms: lastModelMs,
    model_ratio: Number(modelRatio.toFixed(3)),
    model_ratio_pairs: ratios.length,
  };
}
