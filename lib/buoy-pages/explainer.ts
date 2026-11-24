/**
 * Station-specific "how to read this buoy" lines, built from the station's own
 * position, type and recent record. No generic filler: each line depends on
 * this station's numbers, and a line is left out when its numbers are missing.
 */

import type { WaveStationRow } from "@/lib/services/wave-stations/types";
import { formatDistanceKm, formatHeightFt, formatPeriod } from "./format";
import type { TrendPoint } from "./series";

const OFFSHORE_KM = 40;
const NEARSHORE_KM = 15;
const SECTORS_8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
const MIN_SECTOR_SHARE = 0.2;
const MIN_DIRECTION_HOURS = 24;

type Exposure = "offshore" | "coastal" | "nearshore" | "unknown";

/** By distance to the closest listed beach: over 40 km offshore, under 15 km nearshore. */
function classifyExposure(nearestBeachKm: number | null): Exposure {
  if (nearestBeachKm === null) return "unknown";
  if (nearestBeachKm > OFFSHORE_KM) return "offshore";
  if (nearestBeachKm < NEARSHORE_KM) return "nearshore";
  return "coastal";
}

function sector8(degrees: number): (typeof SECTORS_8)[number] {
  return SECTORS_8[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

/** Sectors that carried at least 20% of the height-weighted hours, largest first. */
function dominantSectors(points: TrendPoint[]): string[] {
  const weights = new Map<string, number>();
  let total = 0;
  let hours = 0;
  for (const point of points) {
    const direction = point.swD ?? point.mwd;
    if (direction === null || point.hs === null) continue;
    const weight = point.swH ?? point.hs;
    if (weight <= 0) continue;
    weights.set(sector8(direction), (weights.get(sector8(direction)) ?? 0) + weight);
    total += weight;
    hours += 1;
  }
  if (hours < MIN_DIRECTION_HOURS || total <= 0) return [];
  return [...weights.entries()]
    .filter(([, weight]) => weight / total >= MIN_SECTOR_SHARE)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([sector]) => sector);
}

function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

interface ExplainerInput {
  station: Pick<WaveStationRow, "name" | "station_type">;
  nearestBeachKm: number | null;
  trend: TrendPoint[];
  formatDay: (ms: number) => string;
}

export function buildExplainerLines({ station, nearestBeachKm, trend, formatDay }: ExplainerInput): string[] {
  const lines: string[] = [];
  const exposure = classifyExposure(nearestBeachKm);
  const distance = nearestBeachKm === null ? null : formatDistanceKm(nearestBeachKm);

  if (station.station_type === "fixed") {
    lines.push(
      `${station.name} is a fixed station on a pier, platform or shore, not a floating buoy. Its waves are shaped by the nearby coast and seabed.`,
    );
  } else if (exposure === "offshore") {
    lines.push(
      `${station.name} sits in open water, ${distance} from the closest beach listed here. It sees swell before the coast bends, blocks or shrinks it, so expect beach surf to differ from this reading.`,
    );
  } else if (exposure === "nearshore") {
    lines.push(
      `${station.name} sits close to shore, ${distance} from the closest beach listed here. Its readings already include some of the local shadowing, so they track nearby beaches more closely than an offshore buoy.`,
    );
  } else if (exposure === "coastal") {
    lines.push(
      `${station.name} sits ${distance} from the closest beach listed here: near enough to show what is arriving, far enough that islands, points and the seabed still change it before it breaks.`,
    );
  }

  const sectors = dominantSectors(trend);
  if (sectors.length > 0) {
    lines.push(`Over the readings shown here, most wave energy reached this buoy from the ${joinWords(sectors)}.`);
  }

  const peak = trend.reduce<TrendPoint | null>(
    (best, point) => (point.hs !== null && (best === null || (best.hs ?? 0) < point.hs) ? point : best),
    null,
  );
  if (peak?.hs != null) {
    const period = formatPeriod(peak.dpd);
    lines.push(
      `Biggest hourly reading in that record: ${formatHeightFt(peak.hs)}${period ? ` at ${period}` : ""} on ${formatDay(peak.t)}.`,
    );
  }
  return lines;
}
