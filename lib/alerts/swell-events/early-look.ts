import {
  compareToBigSwells,
  modelTracksBuoy,
  nearestBigSwellBuoy,
  type BigSwellBuoy,
} from "@/lib/big-swells";
import dataset from "@/lib/data/big-swells.json";
import { getLocalDateStr } from "@/lib/services/discovery/window-selector/time-slot-utils";

// ECMWF WAM is the Open-Meteo wave model that returns PEAK period, the same measure as buoy DPD.
const WAM_MODEL = "ecmwf_wam025";
const WAM_FORECAST_DAYS = 16;
const BUOYS = dataset.stations as BigSwellBuoy[];

const DAY_MS = 86_400_000;
const BASELINE_LAST_DAY = 10;
const EARLY_FIRST_DAY = 11;
const EARLY_LAST_DAY = 14;
const PEAK_FLOOR_M = 1.5;
const PEAK_MEDIAN_MULTIPLE = 1.6;
// Matches the detector's storm band: 6.5 s up to (not including) 11 s; shorter is chop, not an event.
const STORM_PERIOD_FLOOR_S = 6.5;
const STORM_PERIOD_BELOW_S = 11;
const DETECTED_OVERLAP_MS = 36 * 3_600_000;

export interface WamDay {
  localDate: string;
  maxHsM: number;
  peakAt: string;
  periodS: number | null;
  directionDeg: number | null;
}

export interface EarlyLookPeak {
  kind: "swell" | "storm";
  localDate: string;
  peakAt: string;
  maxHsM: number;
  periodS: number | null;
  directionDeg: number | null;
}

/** The buoy nearest the region's centre whose history the wave model tracks, within 100 km. */
export function regionModelBuoy(
  beaches: ReadonlyArray<{ lat: number; lon: number }>,
  buoys: BigSwellBuoy[] = BUOYS,
): BigSwellBuoy | null {
  if (beaches.length === 0) return null;
  const centroid = {
    lat: beaches.reduce((sum, beach) => sum + beach.lat, 0) / beaches.length,
    lon: beaches.reduce((sum, beach) => sum + beach.lon, 0) / beaches.length,
  };
  return nearestBigSwellBuoy(buoys.filter(modelTracksBuoy), centroid)?.buoy ?? null;
}

/** The tallest WAM hour of each local day for 16 days from today, at the region's buoy; null when WAM is unreachable. */
export async function fetchWamDays(buoy: BigSwellBuoy, timezone: string): Promise<WamDay[] | null> {
  const url = new URL("https://marine-api.open-meteo.com/v1/marine");
  url.search = new URLSearchParams({
    latitude: String(buoy.lat),
    longitude: String(buoy.lon),
    hourly: "wave_height,wave_peak_period,wave_direction",
    models: WAM_MODEL,
    forecast_days: String(WAM_FORECAST_DAYS),
    timezone,
    // Epoch seconds, so each hour is a true instant even across a clock change.
    timeformat: "unixtime",
  }).toString();

  try {
    // Model runs land every 6-12 h; one fetch per buoy per 3 h serves every region that uses it.
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000), next: { revalidate: 10_800 } });
    if (!response.ok) {
      console.warn("[early-look] Open-Meteo HTTP failure", { status: response.status, buoy: buoy.id });
      return null;
    }
    const hourly = (await response.json())?.hourly;
    const byDate = new Map<string, WamDay>();
    for (const [index, seconds] of (hourly?.time ?? []).entries()) {
      const hsM = hourly.wave_height?.[index];
      if (typeof hsM !== "number") continue;
      const at = new Date(seconds * 1000);
      const localDate = getLocalDateStr(at, timezone);
      if (hsM <= (byDate.get(localDate)?.maxHsM ?? -Infinity)) continue;
      byDate.set(localDate, {
        localDate,
        maxHsM: hsM,
        peakAt: at.toISOString(),
        periodS: hourly.wave_peak_period?.[index] ?? null,
        directionDeg: hourly.wave_direction?.[index] ?? null,
      });
    }
    return [...byDate.values()];
  } catch (error) {
    console.warn("[early-look] Open-Meteo fetch failed", { buoy: buoy.id, error: String(error) });
    return null;
  }
}

function dateAfter(today: string, offset: number): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) + offset * DAY_MS).toISOString().slice(0, 10);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Coarse peaks on days 11-14, past the stored forecast's reach: a day that clears both the
 * 1.5 m floor and 1.6x the typical height of days 0-10, and tops its neighbours. Peaks the
 * stored forecast already reports as an event of the same kind are left out. Day 14 needs a
 * day-15 bucket to prove it is a local maximum, so a truncated model run drops it.
 */
export function earlyLookPeaks(
  days: WamDay[],
  detected: ReadonlyArray<{ kind: "swell" | "storm"; peakAt: string }>,
  today: string,
): EarlyLookPeak[] {
  const byDate = new Map(days.map((day) => [day.localDate, day]));
  const baseline: number[] = [];
  for (let offset = 0; offset <= BASELINE_LAST_DAY; offset += 1) {
    const day = byDate.get(dateAfter(today, offset));
    if (day) baseline.push(day.maxHsM);
  }
  if (baseline.length === 0) return [];
  const threshold = Math.max(PEAK_FLOOR_M, PEAK_MEDIAN_MULTIPLE * median(baseline));

  const peaks: EarlyLookPeak[] = [];
  for (let offset = EARLY_FIRST_DAY; offset <= EARLY_LAST_DAY; offset += 1) {
    const day = byDate.get(dateAfter(today, offset));
    if (!day || day.maxHsM < threshold) continue;
    if (day.periodS !== null && day.periodS < STORM_PERIOD_FLOOR_S) continue;
    const before = byDate.get(dateAfter(today, offset - 1));
    const after = byDate.get(dateAfter(today, offset + 1));
    if (offset === EARLY_LAST_DAY && !after) continue;
    // A plateau counts once: its first day.
    if (before && day.maxHsM <= before.maxHsM) continue;
    if (after && day.maxHsM < after.maxHsM) continue;

    const kind = day.periodS !== null && day.periodS < STORM_PERIOD_BELOW_S ? "storm" : "swell";
    const peakMs = Date.parse(day.peakAt);
    if (detected.some((event) => event.kind === kind && Math.abs(Date.parse(event.peakAt) - peakMs) <= DETECTED_OVERLAP_MS)) {
      continue;
    }
    peaks.push({
      kind,
      localDate: day.localDate,
      peakAt: day.peakAt,
      maxHsM: day.maxHsM,
      periodS: day.periodS,
      directionDeg: day.directionDeg,
    });
  }
  return peaks;
}

// ALL-CAPS NDBC tokens that are acronyms, not shouted words.
const BUOY_ACRONYMS = new Set(["OOI", "FRF", "NM"]);

/**
 * NDBC names carry a location tail ("... - 48NM NW of ..."), a state/station suffix (", CA (153)"),
 * and sometimes shout the place ("BODEGA BAY").
 */
function buoyLabel(name: string): string {
  return name
    .split(" - ")[0]
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/,\s*[A-Z]{2}\s*$/, "")
    .trim()
    .replace(/\b[A-Z]{2,}\b/g, (token) =>
      BUOY_ACRONYMS.has(token) ? token : token[0] + token.slice(1).toLowerCase(),
    );
}

/** "Biggest since Hurricane Marie at the Del Mar Nearshore buoy", or null when the stored history can't prove one. */
export function historyLine(buoy: BigSwellBuoy, hsM: number, timeZone: string): string | null {
  const since = compareToBigSwells(hsM, buoy).biggestSince;
  if (!since) return null;
  const when =
    since.name ??
    new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone }).format(new Date(since.at));
  return `Biggest since ${when} at the ${buoyLabel(buoy.name)} buoy`;
}
