/**
 * Sweden: SMHI oceanographic observations. One station-set "all" request per
 * wave parameter (4 per run) for the last day; values are hourly, so the
 * latest phase runs once an hour. Licence and field notes are in ./parsers.ts.
 */

import type { SourceObservation, SourceStation, WaveStationSourceAdapter } from "../types";
import { mergeSmhiData, parseSmhiStations, SMHI_PARAMETERS, type SmhiParameter } from "./parsers";

const BASE = "https://opendata-download-ocobs.smhi.se/api/version/latest/parameter";
const REQUEST_TIMEOUT_MS = 20_000;

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`SMHI ${url.slice(BASE.length)} failed: HTTP ${res.status}`);
  return res.json();
}

export function smhiLatestUrl(parameter: SmhiParameter): string {
  return `${BASE}/${parameter}/station-set/all/period/latest-day/data.json`;
}

async function fetchStations(): Promise<SourceStation[]> {
  return parseSmhiStations(await fetchJson(`${BASE}/1.json`), Date.now());
}

async function fetchLatestObservations(): Promise<SourceObservation[]> {
  const parameters = Object.keys(SMHI_PARAMETERS) as SmhiParameter[];
  const answers = await Promise.all(parameters.map((parameter) => fetchJson(smhiLatestUrl(parameter))));
  return mergeSmhiData(Object.fromEntries(parameters.map((parameter, index) => [parameter, answers[index]])));
}

export const smhiAdapter: WaveStationSourceAdapter = {
  source: "smhi",
  latestEveryMinutes: 60,
  fetchStations,
  fetchLatestObservations,
};
