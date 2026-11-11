/**
 * Marine Institute (Ireland) ERDDAP, dataset IWBNetwork: the Irish Weather
 * Buoy Network (M2-M6), hourly, metadata licence CC BY 4.0.
 *
 * Field meanings (from the dataset's .das, SeaDataNet P01 codes):
 * - WaveHeight: "Significant wave height {Hs}" (GTDHZZ01), metres -> wave_height_m
 * - WavePeriod: zero-crossing mean period (GSZZXXXX), seconds -> average_period_s
 * - Tp: period at the spectral peak (GTPKZZ01), seconds -> dominant_period_s
 * - ThTp: direction FROM at the spectral peak (GDPXXX01), degrees true ->
 *   mean_wave_direction_deg. NDBC's MWD, stored in the same column, is the
 *   direction of the waves at the dominant period, so ThTp is the like-for-like
 *   field; MeanWaveDirection (spectral mean) is not stored.
 * - Hmax is not stored.
 * - WindSpeed / Gust are knots and are converted to m/s; WindDirection is "from".
 * - Fill value -999; QC_Flag 0 unknown, 1 good, 9 missing.
 *
 * The older IWaveBNetwork datasets (AMETS, Bantry Bay, ...) have no rows since
 * 2026-05-27, so they are not used.
 */

import type { SourceObservation, SourceStation } from "../types";
import { assertErddapUnits, parseErddapCsv } from "../erddap";
import { BOUNDS, compactValues, KNOTS_TO_MS, numberInRange, parseUtcTime, round } from "../values";

export const MARINE_IE_LICENSE = "CC-BY-4.0";
export const MARINE_IE_ATTRIBUTION =
  "Marine Institute, Irish Weather Buoy Network, run with Met Éireann";

/** Names the Marine Institute uses for each buoy position. */
const BUOY_NAMES: Record<string, string> = {
  M1: "M1 Galway Bay",
  M2: "M2 Irish Sea",
  M3: "M3 Southwest Coast",
  M4: "M4 Donegal Bay",
  M5: "M5 Southeast Coast",
  M6: "M6 West Coast",
};

const STATION_ID = /^[A-Z]{1,3}\d{1,2}$/;

export const REGISTRY_UNITS = { longitude: "degrees_east", latitude: "degrees_north", time: "UTC" };

export const LATEST_UNITS = {
  time: "UTC",
  WaveHeight: "meters",
  WavePeriod: "seconds",
  Tp: "seconds",
  ThTp: "degrees_true",
  SeaTemperature: "degrees_C",
  AirTemperature: "degrees_C",
  WindSpeed: "knots",
  WindDirection: "degrees true",
  Gust: "knots",
  AtmosphericPressure: "millibars",
};

/** One row per station (orderByMax station_id,time over a recent window). */
export function parseIwbRegistry(text: string): SourceStation[] {
  const table = parseErddapCsv(text);
  assertErddapUnits(table, REGISTRY_UNITS, "IWBNetwork registry");
  const stations: SourceStation[] = [];
  for (const row of table.rows) {
    const id = row.station_id?.toUpperCase();
    const lat = numberInRange(row.latitude, [-90, 90]);
    const lon = numberInRange(row.longitude, [-180, 180]);
    if (!id || !STATION_ID.test(id) || lat === null || lon === null) continue;
    const callSign = row.CallSign?.trim();
    stations.push({
      sourceStationId: id,
      name: BUOY_NAMES[id] ?? `${id} weather buoy`,
      lat,
      lon,
      stationType: "buoy",
      owner: "Marine Institute",
      program: "Irish Weather Buoy Network",
      countryCode: "IE",
      region: null,
      cdipStationId: null,
      wmoId: callSign && /^\d{5,7}$/.test(callSign) ? callSign : null,
      hasWave: true,
      hasSwellSplit: false,
      hasMet: true,
      license: MARINE_IE_LICENSE,
      attribution: MARINE_IE_ATTRIBUTION,
    });
  }
  return stations;
}

function qcUsable(flag: string | undefined): boolean {
  // 0 = no QC yet, 1 = good, 9 = missing. Anything else is not trusted.
  return flag === undefined || flag === "" || flag === "0" || flag === "1";
}

export function parseIwbObservations(text: string): SourceObservation[] {
  const table = parseErddapCsv(text);
  assertErddapUnits(table, LATEST_UNITS, "IWBNetwork");
  const observations: SourceObservation[] = [];
  for (const row of table.rows) {
    const id = row.station_id?.toUpperCase();
    const observedAt = parseUtcTime(row.time);
    if (!id || !STATION_ID.test(id) || !observedAt || !qcUsable(row.QC_Flag)) continue;
    const wind = numberInRange(row.WindSpeed, [0, BOUNDS.wind[1] / KNOTS_TO_MS]);
    const gust = numberInRange(row.Gust, [0, BOUNDS.gust[1] / KNOTS_TO_MS]);
    const values = compactValues({
      wave_height_m: numberInRange(row.WaveHeight, BOUNDS.height),
      average_period_s: numberInRange(row.WavePeriod, BOUNDS.period),
      dominant_period_s: numberInRange(row.Tp, BOUNDS.period),
      mean_wave_direction_deg: numberInRange(row.ThTp, BOUNDS.direction),
      water_temp_c: numberInRange(row.SeaTemperature, BOUNDS.waterTemp),
      air_temp_c: numberInRange(row.AirTemperature, BOUNDS.airTemp),
      wind_speed_ms: round(wind === null ? null : wind * KNOTS_TO_MS, 2),
      wind_gust_ms: round(gust === null ? null : gust * KNOTS_TO_MS, 2),
      wind_direction_deg: numberInRange(row.WindDirection, BOUNDS.direction),
      pressure_hpa: numberInRange(row.AtmosphericPressure, BOUNDS.pressure),
    });
    if (Object.keys(values).length === 0) continue;
    observations.push({ sourceStationId: id, observedAt, values });
  }
  return observations;
}
