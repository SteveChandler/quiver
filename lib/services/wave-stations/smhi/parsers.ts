/**
 * Sweden: SMHI open data, oceanographic observations API
 * (https://opendata-download-ocobs.smhi.se/api/version/latest).
 *
 * Licence: SMHI's conditions for use (https://www.smhi.se/data/om-smhis-data/villkor-for-anvandning)
 * put open data under Creative Commons Attribution 4.0, commercial use
 * allowed; credit SMHI and say whether the material was changed. No key.
 *
 * Parameters (hourly values of 30-minute records):
 * - 1 "Våghöjd, signifikant 30 min" (significant wave height), m -> wave_height_m
 * - 9 "Vågperiod, peakvärde 30 min" (peak period), s -> dominant_period_s
 * - 10 "Vågperiod, medelvärde 30 min" (mean period), s -> average_period_s
 * - 8 "Vågriktning vid Tp" (direction at the peak), ° -> mean_wave_direction_deg.
 *   The API does not state the convention. Values are FROM: west-coast buoys
 *   read SW (open Skagerrak), and Finngrundet in the Bothnian Sea read 355°
 *   while FMI's Bothnian Sea buoy (documented FROM) read 341-347° that morning.
 * - 11 (maximum height) is not used.
 * Quality: G checked, O not checked yet; Y (suspect or aggregated) is dropped.
 */

import type { SourceObservation, SourceStation, WaveObservationValues } from "../types";
import { BOUNDS, numberInRange } from "../values";

const SMHI_LICENSE = "CC-BY-4.0";
export const SMHI_PARAMETERS = {
  "1": { field: "wave_height_m", unit: "m", bounds: BOUNDS.height },
  "9": { field: "dominant_period_s", unit: "s", bounds: BOUNDS.period },
  "10": { field: "average_period_s", unit: "s", bounds: BOUNDS.period },
  "8": { field: "mean_wave_direction_deg", unit: "°", bounds: BOUNDS.direction },
} as const satisfies Record<string, { field: keyof WaveObservationValues; unit: string; bounds: readonly [number, number] }>;

export type SmhiParameter = keyof typeof SMHI_PARAMETERS;

const ACTIVE_WITHIN_MS = 30 * 24 * 60 * 60 * 1000;

interface SmhiStationMeta {
  key?: string;
  name?: string;
  owner?: string;
  latitude?: number;
  longitude?: number;
  active?: boolean;
  to?: number;
}

function attributionFor(owner: string | undefined): string {
  if (!owner || owner === "SMHI") return "SMHI (Swedish Meteorological and Hydrological Institute)";
  return `SMHI (Swedish Meteorological and Hydrological Institute); station owned by ${owner}`;
}

/** Active wave-height stations from the parameter 1 station list. */
export function parseSmhiStations(json: unknown, nowMs: number): SourceStation[] {
  const list = (json as { station?: SmhiStationMeta[] } | null)?.station;
  if (!Array.isArray(list)) throw new Error("SMHI parameter 1: station list missing");
  const stations: SourceStation[] = [];
  for (const meta of list) {
    const id = meta.key?.trim();
    const lat = numberInRange(meta.latitude, [-90, 90]);
    const lon = numberInRange(meta.longitude, [-180, 180]);
    if (!id || !/^\d+$/.test(id) || lat === null || lon === null) continue;
    if (!meta.active || typeof meta.to !== "number" || nowMs - meta.to > ACTIVE_WITHIN_MS) continue;
    stations.push({
      sourceStationId: id,
      name: (meta.name ?? `SMHI ${id}`).replace(/\s+(Vågboj|Boj)$/i, "").trim(),
      lat,
      lon,
      stationType: "buoy",
      owner: meta.owner ?? "SMHI",
      program: "SMHI oceanographic observations",
      countryCode: "SE",
      region: null,
      cdipStationId: null,
      wmoId: null,
      hasWave: true,
      hasSwellSplit: false,
      hasMet: false,
      license: SMHI_LICENSE,
      attribution: attributionFor(meta.owner),
    });
  }
  return stations;
}

interface SmhiData {
  parameter?: { key?: string; unit?: string };
  station?: Array<{ key?: string; value?: Array<{ date?: number; value?: number | null; quality?: string }> | null }>;
}

/** Merge the per-parameter answers into one observation per station and time. */
export function mergeSmhiData(answers: Partial<Record<SmhiParameter, unknown>>): SourceObservation[] {
  const rows = new Map<string, SourceObservation>();
  for (const [parameter, spec] of Object.entries(SMHI_PARAMETERS) as Array<[SmhiParameter, (typeof SMHI_PARAMETERS)[SmhiParameter]]>) {
    const data = answers[parameter] as SmhiData | undefined;
    if (!data) continue;
    if (data.parameter?.key !== parameter) throw new Error(`SMHI parameter ${parameter}: answer is for ${data.parameter?.key}`);
    // A changed unit would corrupt every stored value, so fail instead of guessing.
    if (data.parameter?.unit !== spec.unit) {
      throw new Error(`SMHI parameter ${parameter}: unit is "${data.parameter?.unit}", expected "${spec.unit}"`);
    }
    for (const station of data.station ?? []) {
      const id = station.key?.trim();
      if (!id) continue;
      for (const point of station.value ?? []) {
        if (typeof point.date !== "number" || point.quality === "Y") continue;
        const value = numberInRange(point.value, spec.bounds);
        if (value === null) continue;
        const observedAt = new Date(point.date).toISOString();
        const key = `${id}|${observedAt}`;
        const row = rows.get(key) ?? { sourceStationId: id, observedAt, values: {} };
        (row.values as Record<string, number>)[spec.field] = value;
        rows.set(key, row);
      }
    }
  }
  return [...rows.values()].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
}
