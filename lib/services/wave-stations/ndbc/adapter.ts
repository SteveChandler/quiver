import type {
  SourceObservation,
  SourceStation,
  StationHistoryResult,
  WaveStationSourceAdapter,
} from "../types";
import {
  cleanStationName,
  deriveNdbcLocation,
  parseActiveStationsXml,
  parseCdipStationId,
  parseLatestObs,
  parseRealtime2SpecListing,
  parseSpecFile,
} from "./parsers";

const NDBC_BASE = "https://www.ndbc.noaa.gov";
const REQUEST_TIMEOUT_MS = 20_000;
const LICENSE = "public-domain-us-gov";

async function fetchText(path: string): Promise<string> {
  const res = await fetch(`${NDBC_BASE}${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`NDBC ${path} failed: HTTP ${res.status}`);
  return res.text();
}

function attributionFor(owner: string | null): string {
  const base = "NOAA National Data Buoy Center (NDBC)";
  if (!owner || owner === "NDBC") return base;
  return `${base}; station operated by ${owner}`;
}

/**
 * NDBC has no wave flag in activestations.xml, so a station counts as a wave
 * station when it has a .spec file or reported a wave height in latest_obs.
 */
async function fetchStations(): Promise<SourceStation[]> {
  const [xml, listing, latest] = await Promise.all([
    fetchText("/activestations.xml"),
    fetchText("/data/realtime2/"),
    fetchText("/data/latest_obs/latest_obs.txt"),
  ]);
  const specIds = parseRealtime2SpecListing(listing);
  const latestWaveIds = new Set(
    parseLatestObs(latest)
      .filter((obs) => obs.values.wave_height_m != null)
      .map((obs) => obs.sourceStationId),
  );

  return parseActiveStationsXml(xml).map((station) => {
    const location = deriveNdbcLocation(station.rawName, station.owner, station.program);
    const hasSwellSplit = specIds.has(station.id);
    return {
      sourceStationId: station.id,
      name: cleanStationName(station.rawName, station.id),
      lat: station.lat,
      lon: station.lon,
      stationType: station.type,
      owner: station.owner,
      program: station.program,
      countryCode: location.countryCode,
      region: location.region,
      cdipStationId: parseCdipStationId(station.rawName),
      hasWave: hasSwellSplit || latestWaveIds.has(station.id),
      hasSwellSplit,
      hasMet: station.hasMet,
      license: LICENSE,
      attribution: attributionFor(station.owner),
    };
  });
}

async function fetchLatestObservations(): Promise<SourceObservation[]> {
  return parseLatestObs(await fetchText("/data/latest_obs/latest_obs.txt"));
}

async function fetchStationHistory(
  sourceStationId: string,
  options: { ifModifiedSince: string | null },
): Promise<StationHistoryResult> {
  const headers: Record<string, string> = {};
  if (options.ifModifiedSince) headers["If-Modified-Since"] = options.ifModifiedSince;
  const res = await fetch(
    `${NDBC_BASE}/data/realtime2/${encodeURIComponent(sourceStationId)}.spec`,
    { cache: "no-store", headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
  );
  if (res.status === 304) return { status: "not_modified" };
  if (res.status === 404) return { status: "not_found" };
  if (!res.ok) throw new Error(`NDBC ${sourceStationId}.spec failed: HTTP ${res.status}`);
  return {
    status: "ok",
    lastModified: res.headers.get("last-modified"),
    observations: parseSpecFile(await res.text(), sourceStationId),
  };
}

export const ndbcAdapter: WaveStationSourceAdapter = {
  source: "ndbc",
  fetchStations,
  fetchLatestObservations,
  fetchStationHistory,
};
