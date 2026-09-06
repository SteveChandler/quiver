import { mapSwellPartition } from "@/app/api/forecasts/bulk/swell-partition";
import type { SwellPartition } from "@/app/api/forecasts/bulk/route";
import type { Beach } from "@/types/database";

export const CONDITIONS_CALLOUT_COLORS = {
  s1: "#F78E42", // Charming Orange (brand)
  s2: "#7AC74F", // green — kept for clear hue separation from S1
  wind: "#00D4AA", // Pacific Teal (brand-sanctioned; never cyan)
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
  p = mapSwellPartition(p);
  const out: CalloutComponent[] = [];

  const s1Dir = p.s1Dir;
  if (isReal(s1Dir) && isReal(p.s1HeightFt) && p.s1HeightFt > 0) {
    out.push({ kind: "s1", name: "SWELL", bearingDeg: s1Dir, label: swellLabel(p.s1HeightFt, p.s1PeriodS), color: CONDITIONS_CALLOUT_COLORS.s1 });
  }
  if (isReal(p.s2Dir) && isReal(p.s2HeightFt) && p.s2HeightFt > 0) {
    out.push({ kind: "s2", name: "SWELL 2", bearingDeg: p.s2Dir, label: swellLabel(p.s2HeightFt, p.s2PeriodS), color: CONDITIONS_CALLOUT_COLORS.s2 });
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
  const cosLat = Math.cos((lat * Math.PI) / 180);
  for (const beach of beaches) {
    if (!isReal(beach.lat) || !isReal(beach.lon)) continue;
    if (!inBounds(beach.lon, beach.lat, bounds)) continue; // choose among visible beaches only
    const dLon = (beach.lon - lon) * cosLat; // correct for longitude convergence away from equator
    const dLat = beach.lat - lat;
    const d = dLon * dLon + dLat * dLat;
    if (d < bestD) {
      bestD = d;
      best = beach;
    }
  }
  return best;
}

export function decideCalloutAction(
  currentBeachId: string | null,
  nextBeachId: string
): "toggle-off" | "show" {
  return currentBeachId === nextBeachId ? "toggle-off" : "show";
}

/** Formats a raw water_temp DB string (e.g. "68", "68.4") to a center-label like "68°". Null when absent/non-numeric. */
export function formatTempLabel(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? `${Math.round(parsed)}°` : null;
}
