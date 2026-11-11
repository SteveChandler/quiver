/**
 * Ireland: Marine Institute ERDDAP, Irish Weather Buoy Network (IWBNetwork).
 *
 * Licence: the dataset's own metadata (NC_GLOBAL license / license_URL at
 * https://erddap.marine.ie/erddap/tabledap/IWBNetwork.das) is Creative
 * Commons Attribution 4.0. No account or key. Hourly rows land ~50 minutes
 * after the hour, so the latest phase asks once an hour for the last 6 hours
 * of every buoy in one request (a bounded catch-up after a missed run).
 */

import { isErddapNoRows } from "../erddap";
import type { SourceObservation, SourceStation, WaveStationSourceAdapter } from "../types";
import { parseIwbObservations, parseIwbRegistry } from "./parsers";

const BASE = "https://erddap.marine.ie/erddap/tabledap/IWBNetwork.csv";
const REQUEST_TIMEOUT_MS = 30_000;
/** The registry lists buoys seen in this window, so a short outage does not deactivate one. */
const REGISTRY_WINDOW = "now-30days";
const LATEST_WINDOW = "now-6hours";

const OBSERVATION_COLUMNS = [
  "station_id", "CallSign", "time", "WaveHeight", "WavePeriod", "Tp", "ThTp", "SeaTemperature",
  "AirTemperature", "WindSpeed", "WindDirection", "Gust", "AtmosphericPressure", "QC_Flag",
];

export function erddapUrl(columns: string[], constraints: string[]): string {
  return `${BASE}?${columns.join(",")}${constraints.map((c) => `&${encodeURIComponent(c)}`).join("")}`;
}

/** Text body, or null when ERDDAP answers "no matching results" (an empty window). */
async function fetchCsv(url: string): Promise<string | null> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const body = await res.text();
  if (isErddapNoRows(res.status, body)) return null;
  if (!res.ok) throw new Error(`Marine Institute ERDDAP failed: HTTP ${res.status}`);
  return body;
}

async function fetchStations(): Promise<SourceStation[]> {
  const body = await fetchCsv(
    erddapUrl(
      ["station_id", "CallSign", "longitude", "latitude", "time"],
      [`time>=${REGISTRY_WINDOW}`, 'orderByMax("station_id,time")'],
    ),
  );
  return body ? parseIwbRegistry(body) : [];
}

async function fetchLatestObservations(): Promise<SourceObservation[]> {
  const body = await fetchCsv(erddapUrl(OBSERVATION_COLUMNS, [`time>=${LATEST_WINDOW}`]));
  return body ? parseIwbObservations(body) : [];
}

export const marineIeAdapter: WaveStationSourceAdapter = {
  source: "marine_ie",
  latestEveryMinutes: 60,
  fetchStations,
  fetchLatestObservations,
};
