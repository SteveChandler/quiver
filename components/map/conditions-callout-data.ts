import type { SwellPartition } from "@/app/api/forecasts/bulk/route";
import type { Beach } from "@/types/database";

export const CONDITIONS_CALLOUT_COLORS = {
  s1: "#F2A24C",
  s2: "#7AC74F",
  wind: "#74C7E3",
} as const;

export interface CalloutComponent {
  kind: "s1" | "s2" | "wind";
  name: string;
  bearingDeg: number;
  label: string;
  color: string;
}

function isReal(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function swellLabel(heightFt: number, periodS: number | null): string {
  const h = `${Math.round(heightFt * 10) / 10}ft`;
  return isReal(periodS) && periodS > 0 ? `${h}, ${Math.round(periodS)}s` : h;
}

export function resolveCalloutComponents(p: SwellPartition): CalloutComponent[] {
  const out: CalloutComponent[] = [];

  const s1Dir = isReal(p.swellDirOm) ? p.swellDirOm : p.s1Dir;
  if (isReal(s1Dir) && isReal(p.s1HeightFt) && p.s1HeightFt > 0) {
    out.push({ kind: "s1", name: "SWELL", bearingDeg: s1Dir, label: swellLabel(p.s1HeightFt, p.s1PeriodS), color: CONDITIONS_CALLOUT_COLORS.s1 });
  }
  if (isReal(p.s2Dir) && isReal(p.s2HeightFt) && p.s2HeightFt > 0) {
    out.push({ kind: "s2", name: "S2", bearingDeg: p.s2Dir, label: swellLabel(p.s2HeightFt, p.s2PeriodS), color: CONDITIONS_CALLOUT_COLORS.s2 });
  }
  if (isReal(p.windDir) && isReal(p.windMph) && p.windMph > 0) {
    out.push({ kind: "wind", name: "WIND", bearingDeg: p.windDir, label: `${Math.round(p.windMph)} mph`, color: CONDITIONS_CALLOUT_COLORS.wind });
  }
  return out;
}

export interface CalloutBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

function inBounds(lon: number, lat: number, b: CalloutBounds): boolean {
  const lonOk = b.west <= b.east ? lon >= b.west && lon <= b.east : lon >= b.west || lon <= b.east;
  return lat >= b.south && lat <= b.north && lonOk;
}

export function nearestBeachInBounds(
  lon: number,
  lat: number,
  beaches: Beach[],
  bounds: CalloutBounds
): Beach | null {
  let best: Beach | null = null;
  let bestD = Infinity;
  for (const beach of beaches) {
    if (!Number.isFinite(beach.lat) || !Number.isFinite(beach.lon)) continue;
    const dLon = beach.lon - lon;
    const dLat = beach.lat - lat;
    const d = dLon * dLon + dLat * dLat;
    if (d < bestD) {
      bestD = d;
      best = beach;
    }
  }
  if (!best || !inBounds(best.lon, best.lat, bounds)) return null;
  return best;
}
