/**
 * Australia: AODN geoserver WFS, layer aodn:aodn_wave_nrt_v2_timeseries_data.
 * No account or key. Licence and contributor checks are in ./parsers.ts.
 *
 * Every request carries a CQL TIME filter (the unfiltered layer is ~7 days,
 * several MB). Spotter buoys report every 30 minutes, so the latest phase
 * asks every 30 minutes for the last 6 hours of every buoy in one request.
 */

import type { SourceObservation, SourceStation, WaveStationSourceAdapter } from "../types";
import { aodnObservations, aodnStations, parseAodnCsv, REQUIRED_COLUMNS, WAVE_COLUMNS } from "./parsers";

const WFS = "https://geoserver-123.aodn.org.au/geoserver/ows";
const LAYER = "aodn:aodn_wave_nrt_v2_timeseries_data";
const REQUEST_TIMEOUT_MS = 45_000;
const HOUR_MS = 60 * 60 * 1000;
/** Buoys seen in this window are listed, so a short outage does not deactivate one. */
const REGISTRY_HOURS = 72;
const LATEST_HOURS = 6;

export function aodnUrl(columns: readonly string[], sinceMs: number): string {
  const params = new URLSearchParams({
    service: "WFS",
    version: "1.0.0",
    request: "GetFeature",
    typeName: LAYER,
    outputFormat: "csv",
    propertyName: columns.join(","),
    CQL_FILTER: `TIME AFTER ${new Date(sinceMs).toISOString().replace(/\.\d{3}Z$/, "Z")}`,
  });
  return `${WFS}?${params.toString()}`;
}

async function fetchCsv(url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`AODN WFS failed: HTTP ${res.status}`);
  const body = await res.text();
  // GeoServer reports query errors as an XML exception with HTTP 200.
  if (/<(ows:)?ExceptionReport|<ServiceExceptionReport/.test(body)) {
    throw new Error(`AODN WFS exception: ${body.slice(0, 200)}`);
  }
  return body;
}

async function fetchStations(): Promise<SourceStation[]> {
  const body = await fetchCsv(aodnUrl(REQUIRED_COLUMNS, Date.now() - REGISTRY_HOURS * HOUR_MS));
  const { rows, excludedInstitutions } = parseAodnCsv(body);
  if (Object.keys(excludedInstitutions).length > 0) {
    console.info("[WaveStations] aodn: rows from excluded contributors", excludedInstitutions);
  }
  return aodnStations(rows);
}

async function fetchLatestObservations(): Promise<SourceObservation[]> {
  const columns = [...REQUIRED_COLUMNS, ...WAVE_COLUMNS];
  const body = await fetchCsv(aodnUrl(columns, Date.now() - LATEST_HOURS * HOUR_MS));
  return aodnObservations(parseAodnCsv(body, columns).rows);
}

export const aodnAdapter: WaveStationSourceAdapter = {
  source: "aodn",
  latestEveryMinutes: 30,
  fetchStations,
  fetchLatestObservations,
};
