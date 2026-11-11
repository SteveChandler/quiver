/**
 * Finland: FMI open data WFS, stored query
 * fmi::observations::wave::multipointcoverage.
 *
 * Licence: CC BY 4.0 for all FMI open data
 * (https://en.ilmatieteenlaitos.fi/open-data-licence). No account or key.
 *
 * Parameters (FMI observable-property metadata, language=fin):
 * - WaveHs "Aallonkorkeus", m. FMI's wave buoys report significant wave
 *   height; the metadata label says only "wave height", so the parameter
 *   name (Hs) is the evidence. -> wave_height_m
 * - WTP "Modaalinen periodi" (modal = peak period), s -> dominant_period_s
 * - ModalWDi "Aallokon tulosuunta" (direction the waves come FROM), deg ->
 *   mean_wave_direction_deg (modal, like NDBC MWD)
 * - TWATER water temperature, degC -> water_temp_c
 * - WHDD is the spread of that direction, not a direction: not requested.
 * Positions carry unix seconds; NaN is a missing value.
 */

import type { SourceObservation, SourceStation } from "../types";
import { BOUNDS, compactValues, numberInRange } from "../values";

export const FMI_LICENSE = "CC-BY-4.0";
export const FMI_ATTRIBUTION = "Finnish Meteorological Institute (FMI) open data";
export const FMI_PARAMETERS = ["WaveHs", "WTP", "ModalWDi", "TWATER"] as const;

/** English names for the open-sea buoys; others keep FMI's name without "aaltopoiju" (wave buoy). */
const ENGLISH_NAMES: Record<string, string> = {
  "134220": "Northern Baltic Proper",
  "134221": "Gulf of Finland",
  "134246": "Bothnian Sea",
  "137228": "Bay of Bothnia",
};

interface FmiCoverage {
  stations: Array<{ fmisid: string; name: string; lat: number; lon: number }>;
  fields: string[];
  samples: Array<{ lat: number; lon: number; epochS: number; values: Array<number | null> }>;
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

const posKey = (lat: number, lon: number) => `${lat.toFixed(5)},${lon.toFixed(5)}`;

export function parseFmiCoverage(xml: string): FmiCoverage {
  if (/<ExceptionReport|<ows:ExceptionReport/.test(xml)) throw new Error("FMI WFS returned an exception report");
  const names = new Map<string, string>();
  for (const match of xml.matchAll(
    /<gml:identifier codeSpace="[^"]*fmisid">(\d+)<\/gml:identifier>\s*<gml:name codeSpace="[^"]*locationcode\/name">([^<]+)<\/gml:name>/g,
  )) {
    names.set(match[1], decodeXml(match[2]).trim());
  }
  const stations: FmiCoverage["stations"] = [];
  for (const match of xml.matchAll(/<gml:Point gml:id="point-(\d+)"[^>]*>[\s\S]*?<gml:pos>([^<]+)<\/gml:pos>/g)) {
    const [lat, lon] = match[2].trim().split(/\s+/).map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    stations.push({ fmisid: match[1], name: names.get(match[1]) ?? `FMI ${match[1]}`, lat, lon });
  }
  const fields = [...xml.matchAll(/<swe:field name="([^"]+)"/g)].map((match) => match[1]);
  for (const parameter of FMI_PARAMETERS) {
    if (!fields.includes(parameter)) throw new Error(`FMI wave coverage: field ${parameter} missing`);
  }
  const positions = (xml.match(/<gmlcov:positions>([\s\S]*?)<\/gmlcov:positions>/)?.[1] ?? "")
    .split("\n").map((line) => line.trim()).filter(Boolean);
  const tuples = (xml.match(/<gml:doubleOrNilReasonTupleList>([\s\S]*?)<\/gml:doubleOrNilReasonTupleList>/)?.[1] ?? "")
    .split("\n").map((line) => line.trim()).filter(Boolean);
  if (positions.length !== tuples.length) {
    throw new Error(`FMI wave coverage: ${positions.length} positions but ${tuples.length} value rows`);
  }
  const samples = positions.map((line, index) => {
    const [lat, lon, epochS] = line.split(/\s+/).map(Number);
    const values = tuples[index].split(/\s+/).map((token) => (token === "NaN" ? null : Number(token)));
    return { lat, lon, epochS, values };
  });
  return { stations, fields, samples };
}

function stationIndex(coverage: FmiCoverage) {
  return new Map(coverage.stations.map((station) => [posKey(station.lat, station.lon), station]));
}

function waveValue(coverage: FmiCoverage, values: Array<number | null>, field: string): number | null {
  const index = coverage.fields.indexOf(field);
  return index === -1 ? null : values[index] ?? null;
}

export function fmiObservations(coverage: FmiCoverage): SourceObservation[] {
  const byPos = stationIndex(coverage);
  const observations: SourceObservation[] = [];
  for (const sample of coverage.samples) {
    const station = byPos.get(posKey(sample.lat, sample.lon));
    if (!station || !Number.isFinite(sample.epochS)) continue;
    const dominant = numberInRange(waveValue(coverage, sample.values, "WTP"), BOUNDS.period);
    const values = compactValues({
      wave_height_m: numberInRange(waveValue(coverage, sample.values, "WaveHs"), BOUNDS.height),
      dominant_period_s: dominant,
      mean_wave_direction_deg: numberInRange(waveValue(coverage, sample.values, "ModalWDi"), BOUNDS.direction),
      water_temp_c: numberInRange(waveValue(coverage, sample.values, "TWATER"), BOUNDS.waterTemp),
    });
    if (Object.keys(values).length === 0) continue;
    observations.push({
      sourceStationId: station.fmisid,
      observedAt: new Date(sample.epochS * 1000).toISOString(),
      values,
    });
  }
  return observations;
}

/** Stations that reported a wave height in the window (water-level and temperature-only sites are left out). */
export function fmiStations(coverage: FmiCoverage): SourceStation[] {
  const withWaves = new Set(
    fmiObservations(coverage)
      .filter((obs) => obs.values.wave_height_m != null)
      .map((obs) => obs.sourceStationId),
  );
  return coverage.stations
    .filter((station) => withWaves.has(station.fmisid))
    .map((station) => ({
      sourceStationId: station.fmisid,
      name: ENGLISH_NAMES[station.fmisid] ?? station.name.replace(/\s+aaltopoiju$/i, ""),
      lat: station.lat,
      lon: station.lon,
      stationType: "buoy",
      owner: "Finnish Meteorological Institute",
      program: "FMI wave buoys",
      countryCode: "FI",
      region: null,
      cdipStationId: null,
      wmoId: null,
      hasWave: true,
      hasSwellSplit: false,
      hasMet: false,
      license: FMI_LICENSE,
      attribution: FMI_ATTRIBUTION,
    }));
}
