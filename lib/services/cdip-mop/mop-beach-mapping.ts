import { angleDifference } from "@/lib/domains/shared";
import { haversineDistance } from "@/lib/utils/geo-utils";
import type { MopPointMeta } from "./mop-client";

/**
 * MOP points sit on the 10 m depth contour, often 0.5–2 km seaward of a beach pin, so "nearest point within
 * 500 m" maps a fifth of California. A beach instead takes the point whose shore-normal transect runs
 * through it: the beach must lie landward along the normal (which also rejects the far side of a headland)
 * and close to the transect line. A wrong point is worse than none, so anything else stays unmapped.
 */
export const MAX_TRANSECT_CROSS_M = 300;
export const MAX_LANDWARD_M = 2000;
/** Pins are approximate; allow a beach to sit just seaward of its point. */
const MIN_LANDWARD_M = -100;
const REVIEW_NORMAL_DIFFERENCE_DEG = 20;
/** Most beaches sit 0.4–1.2 km inland of their point; past that the pin or the transect deserves a look. */
const REVIEW_LANDWARD_M = 1200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POINT_ID = /^[A-Z]+\d+$/;

export interface MappableBeach {
  id: string;
  name: string;
  lat: number;
  lon: number;
  aspect_deg: number | null;
}

export interface MopMatch {
  point: MopPointMeta;
  distanceM: number;
  /** Distance from the beach to the point's shore-normal line. */
  crossTrackM: number;
  /** How far landward of the point the beach sits, measured along the normal. */
  landwardM: number;
}

function bearingDeg(fromLat: number, fromLon: number, toLat: number, toLon: number): number {
  const phi1 = (fromLat * Math.PI) / 180;
  const phi2 = (toLat * Math.PI) / 180;
  const deltaLambda = ((toLon - fromLon) * Math.PI) / 180;
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function matchMopTransect(beach: MappableBeach, points: readonly MopPointMeta[]): MopMatch | null {
  let best: MopMatch | null = null;
  for (const point of points) {
    const distanceM = haversineDistance(point.lat, point.lon, beach.lat, beach.lon) * 1000;
    const offNormal = ((bearingDeg(point.lat, point.lon, beach.lat, beach.lon) - (point.shoreNormalDeg + 180)) * Math.PI) / 180;
    const landwardM = distanceM * Math.cos(offNormal);
    const crossTrackM = Math.abs(distanceM * Math.sin(offNormal));
    if (landwardM < MIN_LANDWARD_M || landwardM > MAX_LANDWARD_M || crossTrackM > MAX_TRANSECT_CROSS_M) continue;
    if (!best || crossTrackM < best.crossTrackM || (crossTrackM === best.crossTrackM && distanceM < best.distanceM)) {
      best = { point, distanceM, crossTrackM, landwardM };
    }
  }
  return best;
}

const wholeDegrees = (value: number): number => ((Math.round(value) % 360) + 360) % 360;
const commentText = (value: string): string => value.replace(/\s+/g, " ").trim();

/** Reviewable SQL for beaches.mop_*; the script writes it, Steven approves it, nothing runs it automatically. */
export function buildMopMappingSql(
  rows: ReadonlyArray<{ beach: MappableBeach; match: MopMatch | null }>,
  generatedAt: string,
): string {
  const mapped = rows.filter((row): row is { beach: MappableBeach; match: MopMatch } => row.match !== null);
  const unmapped = rows.filter((row) => row.match === null);
  const furthest = mapped.reduce((max, row) => Math.max(max, Math.round(row.match.landwardM)), 0);

  const header = [
    `-- CDIP MOP point per California beach, generated ${generatedAt} by scripts/map-beaches-to-mop.ts.`,
    `-- The MOP nowcast point whose shore-normal transect passes within ${MAX_TRANSECT_CROSS_M} m of the beach,`,
    `-- with the beach up to ${MAX_LANDWARD_M} m landward of it. Review before applying (needs APPROVE).`,
    `-- mapped: ${mapped.length}, unmapped: ${unmapped.length}, furthest beach kept: ${furthest} m inland of its point`,
    ...unmapped.map((row) => `-- unmapped: ${row.beach.id} ${commentText(row.beach.name)}`),
  ];
  const review = mapped.flatMap(({ beach, match }) => {
    if (beach.aspect_deg === null) return [];
    const difference = Math.round(angleDifference(beach.aspect_deg, match.point.shoreNormalDeg));
    if (difference <= REVIEW_NORMAL_DIFFERENCE_DEG) return [];
    return [
      `-- review: ${commentText(beach.name)} aspect_deg ${beach.aspect_deg} vs MOP ${match.point.pointId} normal ${wholeDegrees(match.point.shoreNormalDeg)} (${difference}°)`,
    ];
  });
  const far = mapped
    .filter(({ match }) => match.landwardM > REVIEW_LANDWARD_M)
    .sort((a, b) => b.match.landwardM - a.match.landwardM)
    .map(
      ({ beach, match }) =>
        `-- check: ${commentText(beach.name)} is ${Math.round(match.landwardM)} m inland of MOP ${match.point.pointId} ` +
        `(normal ${wholeDegrees(match.point.shoreNormalDeg)}, ${Math.round(match.crossTrackM)} m off-transect)`,
    );
  const updates = mapped.map(({ beach, match }) => {
    if (!UUID.test(beach.id)) throw new Error(`beach id ${JSON.stringify(beach.id)} is not a uuid`);
    if (!POINT_ID.test(match.point.pointId)) throw new Error(`MOP point id ${JSON.stringify(match.point.pointId)} is malformed`);
    return (
      `UPDATE public.beaches SET mop_point_id = '${match.point.pointId}', ` +
      `mop_shore_normal_deg = ${wholeDegrees(match.point.shoreNormalDeg)}, ` +
      `mop_point_distance_m = ${Math.round(match.distanceM)} WHERE id = '${beach.id}';`
    );
  });

  return [...header, ...far, ...review, "", "BEGIN;", ...updates, "COMMIT;", ""].join("\n");
}
