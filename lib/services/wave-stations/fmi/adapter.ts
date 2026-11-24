/**
 * Finland: FMI open data WFS (https://opendata.fmi.fi/wfs), one
 * multipointcoverage request for all wave buoys in Finnish waters. Waves
 * come every 30 minutes; the latest phase asks every 30 minutes for the last
 * 6 hours. Licence and field notes are in ./parsers.ts.
 *
 * The open-sea buoys are lifted before the sea freezes, so in winter the
 * registry can find no buoy. That is declared legitimate
 * (emptyStationListReason): stored buoys stay active and show offline.
 */

import type { SourceObservation, SourceStation, WaveStationSourceAdapter } from "../types";
import { FMI_PARAMETERS, fmiObservations, fmiStations, parseFmiCoverage } from "./parsers";

const WFS = "https://opendata.fmi.fi/wfs";
const REQUEST_TIMEOUT_MS = 30_000;
const HOUR_MS = 60 * 60 * 1000;
/** Finnish sea areas: Gulf of Finland, Archipelago and Bothnian Sea, Bay of Bothnia. */
const BBOX = "19,59,32,66";
const REGISTRY_HOURS = 7 * 24;
const LATEST_HOURS = 6;

export function fmiUrl(sinceMs: number): string {
  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "getFeature",
    storedquery_id: "fmi::observations::wave::multipointcoverage",
    parameters: FMI_PARAMETERS.join(","),
    starttime: new Date(sinceMs).toISOString().replace(/\.\d{3}Z$/, "Z"),
    bbox: BBOX,
  });
  return `${WFS}?${params.toString()}`;
}

async function fetchCoverage(sinceMs: number) {
  const res = await fetch(fmiUrl(sinceMs), { cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`FMI WFS failed: HTTP ${res.status}`);
  return parseFmiCoverage(await res.text());
}

async function fetchStations(): Promise<SourceStation[]> {
  return fmiStations(await fetchCoverage(Date.now() - REGISTRY_HOURS * HOUR_MS));
}

async function fetchLatestObservations(): Promise<SourceObservation[]> {
  return fmiObservations(await fetchCoverage(Date.now() - LATEST_HOURS * HOUR_MS));
}

export const fmiAdapter: WaveStationSourceAdapter = {
  source: "fmi",
  latestEveryMinutes: 30,
  emptyStationListReason: "FMI lifts its wave buoys before the sea freezes; none reported in the last 7 days",
  fetchStations,
  fetchLatestObservations,
};
