import { mapSwellPartition } from "@/app/api/forecasts/bulk/swell-partition";
import type { SwellLayerId } from "@/components/map/swell-map-theme";
import {
  interpolateSwellPartition,
  type SwellPartition,
} from "@/app/api/forecasts/bulk/swell-partition";

export { interpolateSwellPartition };

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

interface FlowCellBeachWeight {
  beachIndex: number;
  weight: number;
}

export interface FlowFieldGrid extends FlowField {
  beachWeights: FlowCellBeachWeight[][];
}

export type FlowComponentId = "s1" | "s2" | "wind";

const WIND_PARTICLE_MIN_SCALE = 0.25;
const WIND_PARTICLE_FULL_SPEED = 0.85;

export function resolveWindParticleCount(
  baseCount: number,
  field: FlowField
): number {
  const safeBase = Math.max(1, Math.floor(baseCount));
  const liveCells = field.cells.filter((cell) => cell.speed > 0);
  if (liveCells.length === 0) return 1;

  const averageSpeed =
    liveCells.reduce((sum, cell) => sum + cell.speed, 0) / liveCells.length;
  const densityScale = Math.min(
    1,
    Math.max(WIND_PARTICLE_MIN_SCALE, averageSpeed / WIND_PARTICLE_FULL_SPEED)
  );

  return Math.max(1, Math.round(safeBase * densityScale));
}

/** Minimal style-layer shape we need to sniff water layers (id only). */
export interface StyleLayerLike {
  id: string;
}

/**
 * Pick the basemap layer ids that represent water from a style's layer list, by
 * matching id substrings (`water`/`ocean`/`bathymetry`). On the light Mapbox style
 * the open ocean returns the `water` fill layer, so masking field cells to these
 * layers keeps the flow field on the sea and off the land.
 */
export function detectWaterLayerIds(layers: StyleLayerLike[]): string[] {
  const ids: string[] = [];
  for (const layer of layers) {
    if (typeof layer?.id !== "string") continue;
    const id = layer.id.toLowerCase();
    if (id.includes("water") || id.includes("ocean") || id.includes("bathymetry")) {
      ids.push(layer.id);
    }
  }
  return ids;
}

export function waterMaskableFlowComponents(
  components: ReadonlyArray<FlowComponentId>
): FlowComponentId[] {
  return components.filter((component) => component !== "wind");
}

/** Minimal projected screen point (CSS pixels). */
export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * Just enough of a Mapbox map for water masking: project a lng/lat to screen pixels
 * and query rendered features at a point against specific layers.
 */
export interface WaterMaskMap {
  areTilesLoaded?: () => boolean;
  project(lngLat: [number, number]): ScreenPoint;
  queryRenderedFeatures(
    point: [number, number],
    options: { layers: string[] }
  ): unknown[];
}

export interface WaterMaskOptions {
  /** Current map canvas size in CSS pixels. */
  width: number;
  height: number;
  /** Basemap layer ids that count as water. */
  waterLayerIds: string[];
  /** Cell verdicts reused while forecast time and camera position change. */
  waterMaskCache?: Map<string, boolean>;
  zoomBucket?: number;
}

/**
 * Mutate a flow field IN PLACE so cells over land are zeroed (speed/alpha 0),
 * leaving water cells untouched. Robust against mask-timing pitfalls:
 *  - Only masks cells whose projected point is INSIDE the current viewport
 *    (0..width / 0..height); off-screen points are left alone (never zeroed),
 *    so a cell isn't blanked just because it's projected off the edge.
 *  - A throw from project/query is treated as water (skip zeroing) so a transient
 *    failure can never blank the whole field.
 * Returns false when a deferred or untrusted pass needs a retry.
 * No-ops when there are no water layer ids (nothing to query against → err toward
 * leaving the field intact rather than zeroing everything).
 */
export function maskFieldToWater(
  field: FlowField,
  map: WaterMaskMap,
  options: WaterMaskOptions
): boolean {
  if (options.waterLayerIds.length === 0) return true;
  const tilesLoaded = map.areTilesLoaded?.() ?? true;
  const pendingLandCells: FlowField["cells"] = [];
  let queriedCellCount = 0;
  let waterHitCount = 0;
  let queryFailed = false;
  for (const cell of field.cells) {
    if (cell.speed === 0 && cell.alpha === 0) continue; // already dead
    const cellKey = `${cell.lon}:${cell.lat}`;
    const cacheKey = options.zoomBucket === undefined
      ? cellKey
      : `${options.zoomBucket}:${cellKey}`;
    const cachedIsWater = options.waterMaskCache?.get(cacheKey);
    if (cachedIsWater !== undefined) {
      if (cachedIsWater) {
        // A cached water verdict is a real hit from this same camera. It must
        // count toward the trust threshold: during playback the idle remask
        // caches every live (water) cell, so a rebuilt field only sends LAND
        // cells to the map and a fresh-hits-only count would abort the pass.
        queriedCellCount += 1;
        waterHitCount += 1;
      } else {
        cell.speed = 0;
        cell.alpha = 0;
        cell.vx = 0;
        cell.vy = 0;
      }
      continue;
    }
    try {
      const pt = map.project([cell.lon, cell.lat]);
      // Outside the rendered viewport → can't reliably query; leave it alone.
      if (pt.x < 0 || pt.x > options.width || pt.y < 0 || pt.y > options.height) {
        continue;
      }
      const hits = map.queryRenderedFeatures([pt.x, pt.y], {
        layers: options.waterLayerIds,
      });
      queriedCellCount += 1;
      if (!hits || hits.length === 0) {
        pendingLandCells.push(cell);
      } else {
        waterHitCount += 1;
        options.waterMaskCache?.set(cacheKey, true);
      }
    } catch {
      // Transient projection/query failure → leave the cell and retry.
      queryFailed = true;
    }
  }
  // Some Mapbox styles temporarily expose layer ids before their rendered
  // features are queryable. Treat an all-negative pass as untrusted; otherwise
  // one cached load can irreversibly erase the complete coastal flow field.
  const minimumTrustedWaterHits = queriedCellCount >= 12
    ? Math.max(2, Math.ceil(queriedCellCount * 0.1))
    : 1;
  if (waterHitCount < minimumTrustedWaterHits) {
    return pendingLandCells.length === 0 && !queryFailed && tilesLoaded;
  }
  for (const cell of pendingLandCells) {
    if (tilesLoaded) {
      const cellKey = `${cell.lon}:${cell.lat}`;
      options.waterMaskCache?.set(
        options.zoomBucket === undefined
          ? cellKey
          : `${options.zoomBucket}:${cellKey}`,
        false,
      );
    }
    cell.speed = 0;
    cell.alpha = 0;
    cell.vx = 0;
    cell.vy = 0;
  }
  return tilesLoaded && !queryFailed;
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
// Cross-shore (lon) margin. Wide enough that the default ~zoom-11 embed view (which
// shows open ocean west of the coast) already fits inside the leash bounds, so
// applying setMaxBounds never yanks the camera inland on load.
export const COASTAL_CORRIDOR_LON_PAD = 0.3;
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

/**
 * Strength 0..1 driving particle density/length/opacity. Energy ~ H^2 normalized
 * against a ~6ft ceiling so TYPICAL surf reads as a clearly-alive field (a 10ft
 * ceiling pinned everyday 3-5ft swells near zero, leaving the map looking dead);
 * truly tiny surf still subdues toward the floor and 6ft+ saturates boldest.
 */
function alphaFromHeight(heightFt: number): number {
  if (!Number.isFinite(heightFt) || heightFt <= 0) return 0;
  const energy = (heightFt * heightFt) / 36; // 6ft -> 1.0 (3ft~0.25, 4ft~0.44, 5ft~0.69)
  return Math.max(0.18, Math.min(1, energy));
}

const FLOW_FIELD_POWER = 1.6;
const FLOW_FIELD_EPS = 1e-9;
const FLOW_FIELD_INFLUENCE_RADIUS_DEG = 1.0;
const FLOW_FIELD_INFLUENCE_RADIUS2 =
  FLOW_FIELD_INFLUENCE_RADIUS_DEG * FLOW_FIELD_INFLUENCE_RADIUS_DEG;
const FLOW_FIELD_ALPHA_GAIN = 1.6;

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
  partition = mapSwellPartition(partition);
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
    if (partition.s2Dir == null || !partition.s2PeriodS || !partition.s2HeightFt) return null;
    return {
      lon,
      lat,
      dir: partition.s2Dir,
      periodS: partition.s2PeriodS,
      heightFt: partition.s2HeightFt,
    };
  }
  // "s1" and "combined" both anchor on the primary swell.
  const dir = partition.s1Dir;
  if (dir == null || !partition.s1PeriodS || !partition.s1HeightFt) return null;
  return {
    lon,
    lat,
    dir,
    periodS: partition.s1PeriodS,
    heightFt: partition.s1HeightFt,
  };
}

export function buildFlowFieldGrid(
  beachPositions: Pick<BeachPartitionPoint, "lon" | "lat">[],
  bounds: GeoBounds,
  resolution: number
): FlowFieldGrid {
  const cols = Math.max(2, Math.floor(resolution));
  const rows = cols;
  if (beachPositions.length === 0) {
    return { cols, rows, cells: [], beachWeights: [] };
  }

  const cells: FlowCell[] = [];
  const beachWeights: FlowCellBeachWeight[][] = [];
  const lonSpan = bounds.east - bounds.west;
  const latSpan = bounds.north - bounds.south;

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lon = bounds.west + (lonSpan * c) / (cols - 1);
      const lat = bounds.south + (latSpan * r) / (rows - 1);
      const weights: FlowCellBeachWeight[] = [];
      for (let beachIndex = 0; beachIndex < beachPositions.length; beachIndex += 1) {
        const p = beachPositions[beachIndex];
        const dLon = lon - p.lon;
        const dLat = lat - p.lat;
        const dist2 = dLon * dLon + dLat * dLat;
        if (dist2 > FLOW_FIELD_INFLUENCE_RADIUS2) continue;
        weights.push({
          beachIndex,
          weight: 1 / Math.pow(dist2 + FLOW_FIELD_EPS, FLOW_FIELD_POWER / 2),
        });
      }
      cells.push({ lon, lat, vx: 0, vy: 0, speed: 0, alpha: 0 });
      beachWeights.push(weights);
    }
  }

  return { cols, rows, cells, beachWeights };
}

export function updateFlowFieldValues(
  grid: FlowFieldGrid,
  points: BeachPartitionPoint[]
): FlowFieldGrid {
  for (let cellIndex = 0; cellIndex < grid.cells.length; cellIndex += 1) {
    const cell = grid.cells[cellIndex];
    const weights = grid.beachWeights[cellIndex];
    let wSum = 0;
    let vx = 0;
    let vy = 0;
    let speed = 0;
    let alpha = 0;

    for (const { beachIndex, weight } of weights) {
      const point = points[beachIndex];
      if (!point) continue;
      const vec = degToVector(point.dir);
      vx += weight * vec.x;
      vy += weight * vec.y;
      speed += weight * speedFromPeriod(point.periodS);
      alpha += weight * alphaFromHeight(point.heightFt);
      wSum += weight;
    }

    if (wSum <= 0) {
      cell.vx = 0;
      cell.vy = 0;
      cell.speed = 0;
      cell.alpha = 0;
      continue;
    }

    const inv = 1 / wSum;
    const magnitude = Math.hypot(vx * inv, vy * inv);
    cell.vx = magnitude > FLOW_FIELD_EPS ? (vx * inv) / magnitude : 0;
    cell.vy = magnitude > FLOW_FIELD_EPS ? (vy * inv) / magnitude : 0;
    cell.speed = speed * inv;
    cell.alpha = Math.min(1, alpha * inv * FLOW_FIELD_ALPHA_GAIN);
  }

  return grid;
}

/** Build a coarse IDW-interpolated field over `bounds`. Pure: no DOM, no GL. */
export function buildFlowField(
  points: BeachPartitionPoint[],
  bounds: GeoBounds,
  resolution: number
): FlowField {
  return updateFlowFieldValues(buildFlowFieldGrid(points, bounds, resolution), points);
}
