import type { SwellLayerId } from "@/components/map/swell-map-theme";
import type { SwellPartition } from "@/app/api/forecasts/bulk/route";

export interface Vec2 {
  x: number;
  y: number;
}

/** One beach reduced to a single (direction, period, height) sample for a layer. */
export interface BeachPartitionPoint {
  lon: number;
  lat: number;
  /** Oceanographic bearing the energy COMES FROM, in degrees. */
  dir: number;
  /** Period in seconds (drives advection speed). */
  periodS: number;
  /** Height in feet (drives alpha/energy). */
  heightFt: number;
}

export interface FlowCell {
  lon: number;
  lat: number;
  /** Unit-ish travel vector (screen-y down). */
  vx: number;
  vy: number;
  /** Normalized advection speed (0..~1.2), from deep-water celerity ~1.56*T. */
  speed: number;
  /** Normalized alpha/energy 0..1, from height^2. */
  alpha: number;
}

export interface FlowField {
  cols: number;
  rows: number;
  cells: FlowCell[];
}

export interface GeoBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** One point of the data footprint used to derive the coastal camera corridor. */
export interface LatLonPoint {
  lat: number | null | undefined;
  lon: number | null | undefined;
}

// Coastal-corridor camera leash padding (degrees). Generous ALONG-coast (lat)
// padding lets the next stretch of beaches enter the viewport and load before the
// corridor edge, so the bbox chains up/down coast on the next recompute; smaller
// cross-shore (lon) margin keeps the field near the coast, not out in open sea.
export const COASTAL_CORRIDOR_LAT_PAD = 0.35;
export const COASTAL_CORRIDOR_LON_PAD = 0.12;
// Floor span for a degenerate (single-beach) footprint so it's still navigable.
export const COASTAL_CORRIDOR_MIN_SPAN = 0.1;

/**
 * Padded lat/lon bounding box of a beach data footprint, for `map.setMaxBounds`.
 * APPROXIMATE rectangular coast corridor, not a pixel-perfect coastline mask.
 * Returns null when no point has finite lat/lon.
 */
export function computeCoastalBounds(points: LatLonPoint[]): GeoBounds | null {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const { lat, lon } of points) {
    if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      continue;
    }
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }
  if (!Number.isFinite(minLat) || !Number.isFinite(minLon)) return null;

  // Pad a degenerate axis to a sane minimum span so the corridor stays navigable.
  if (maxLat - minLat < COASTAL_CORRIDOR_MIN_SPAN) {
    const mid = (minLat + maxLat) / 2;
    minLat = mid - COASTAL_CORRIDOR_MIN_SPAN / 2;
    maxLat = mid + COASTAL_CORRIDOR_MIN_SPAN / 2;
  }
  if (maxLon - minLon < COASTAL_CORRIDOR_MIN_SPAN) {
    const mid = (minLon + maxLon) / 2;
    minLon = mid - COASTAL_CORRIDOR_MIN_SPAN / 2;
    maxLon = mid + COASTAL_CORRIDOR_MIN_SPAN / 2;
  }

  return {
    west: minLon - COASTAL_CORRIDOR_LON_PAD,
    south: minLat - COASTAL_CORRIDOR_LAT_PAD,
    east: maxLon + COASTAL_CORRIDOR_LON_PAD,
    north: maxLat + COASTAL_CORRIDOR_LAT_PAD,
  };
}

/**
 * Convert an oceanographic FROM-bearing to a screen-space travel vector.
 * Energy travels in the bearing + 180deg. Screen-y points DOWN, so a swell
 * coming FROM north (0deg) travels south = +y. Returns a unit vector.
 */
export function degToVector(fromDeg: number): Vec2 {
  const travelDeg = (fromDeg + 180) % 360;
  const rad = (travelDeg * Math.PI) / 180;
  // Compass: 0=N(up,-y in math), 90=E(+x). Screen-y down flips the y sign.
  return {
    x: Math.sin(rad),
    y: -Math.cos(rad),
  };
}

/** Deep-water group celerity ~ 1.56 * T (m/s). Normalize against a 20s ceiling. */
function speedFromPeriod(periodS: number): number {
  if (!Number.isFinite(periodS) || periodS <= 0) return 0;
  const celerity = 1.56 * periodS; // m/s
  return Math.min(1.2, celerity / 26); // ~14s -> 0.84, ~20s -> 1.2 (clamped)
}

/** Energy ~ H^2. Normalize against a 10ft ceiling, clamp to [0.08, 1]. */
function alphaFromHeight(heightFt: number): number {
  if (!Number.isFinite(heightFt) || heightFt <= 0) return 0;
  const energy = (heightFt * heightFt) / 100; // 10ft -> 1.0
  return Math.max(0.08, Math.min(1, energy));
}

/**
 * Reduce a beach's full partition to the single sample relevant to `layerId`.
 * Returns null when that layer has no usable data at the beach.
 */
export function partitionToPoint(
  lon: number,
  lat: number,
  partition: SwellPartition,
  layerId: SwellLayerId
): BeachPartitionPoint | null {
  if (layerId === "wind") {
    if (partition.windDir == null || partition.windMph == null) return null;
    // Treat wind like a short-period, height-proxied flow: period from mph, height from mph.
    return {
      lon,
      lat,
      dir: partition.windDir,
      periodS: Math.max(3, partition.windMph * 0.4),
      heightFt: Math.max(0.5, partition.windMph * 0.12),
    };
  }
  if (layerId === "s2") {
    if (partition.s2Dir == null) return null;
    return {
      lon,
      lat,
      dir: partition.s2Dir,
      periodS: partition.s2PeriodS ?? 8,
      heightFt: partition.s2HeightFt ?? 1,
    };
  }
  // "s1" and "combined" both anchor on the primary swell.
  if (partition.s1Dir == null) return null;
  return {
    lon,
    lat,
    dir: partition.s1Dir,
    periodS: partition.s1PeriodS ?? 12,
    heightFt: partition.s1HeightFt ?? 2,
  };
}

/**
 * Build a coarse `resolution x resolution` IDW-interpolated flow field over
 * `bounds`. Pure: no DOM, no GL. `power=2` inverse-distance weighting.
 */
export function buildFlowField(
  points: BeachPartitionPoint[],
  bounds: GeoBounds,
  resolution: number
): FlowField {
  const cols = Math.max(2, Math.floor(resolution));
  const rows = cols;
  if (points.length === 0) {
    return { cols, rows, cells: [] };
  }

  const cells: FlowCell[] = [];
  const lonSpan = bounds.east - bounds.west;
  const latSpan = bounds.north - bounds.south;
  const POWER = 2;
  const EPS = 1e-9;

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lon = bounds.west + (lonSpan * c) / (cols - 1);
      const lat = bounds.south + (latSpan * r) / (rows - 1);

      let wSum = 0;
      let vx = 0;
      let vy = 0;
      let speed = 0;
      let alpha = 0;

      for (const p of points) {
        const dLon = lon - p.lon;
        const dLat = lat - p.lat;
        const dist2 = dLon * dLon + dLat * dLat;
        const w = 1 / Math.pow(dist2 + EPS, POWER / 2);
        const vec = degToVector(p.dir);
        vx += w * vec.x;
        vy += w * vec.y;
        speed += w * speedFromPeriod(p.periodS);
        alpha += w * alphaFromHeight(p.heightFt);
        wSum += w;
      }

      const inv = wSum > 0 ? 1 / wSum : 0;
      // Re-normalize the blended direction to a unit vector (magnitude carries via speed).
      let nvx = vx * inv;
      let nvy = vy * inv;
      const mag = Math.hypot(nvx, nvy);
      if (mag > EPS) {
        nvx /= mag;
        nvy /= mag;
      } else {
        nvx = 0;
        nvy = 0;
      }

      cells.push({
        lon,
        lat,
        vx: nvx,
        vy: nvy,
        speed: speed * inv,
        alpha: alpha * inv,
      });
    }
  }

  return { cols, rows, cells };
}
