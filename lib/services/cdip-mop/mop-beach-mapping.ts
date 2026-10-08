import { isUuid } from "@/lib/utils/validation";
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
/** A point facing further than this from the nearest point is on another stretch of coast (a headland's far side). */
const MAX_NORMAL_TURN_DEG = 90;
const REVIEW_NORMAL_DIFFERENCE_DEG = 20;
/** Past these, the match is written commented out for Steven to opt into rather than applied. */
const HOLD_NORMAL_DIFFERENCE_DEG = 45;
/** Most beaches sit 0.4–1.2 km inland of their point; past that the pin or the transect deserves a look. */
const HOLD_LANDWARD_M = 1200;
const POINT_ID = /^[A-Z]+\d+$/;

export interface MappableBeach {
  id: string;
  name: string;
  lat: number;
  lon: number;
  aspect_deg: number | null;
}

interface MopMatch {
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

/**
 * The point whose transect passes closest to the beach (ties to the nearer point), ignoring points that face
 * away from the nearest point's stretch of coast: their landward rays can cross a narrow headland.
 */
export function matchMopTransect(beach: MappableBeach, points: readonly MopPointMeta[]): MopMatch | null {
  const measured = points.map((point) => {
    const distanceM = haversineDistance(point.lat, point.lon, beach.lat, beach.lon) * 1000;
    const offNormal = ((bearingDeg(point.lat, point.lon, beach.lat, beach.lon) - (point.shoreNormalDeg + 180)) * Math.PI) / 180;
    return { point, distanceM, crossTrackM: Math.abs(distanceM * Math.sin(offNormal)), landwardM: distanceM * Math.cos(offNormal) };
  });
  const nearest = measured.reduce<MopMatch | null>((best, m) => (!best || m.distanceM < best.distanceM ? m : best), null);
  if (!nearest) return null;
  let best: MopMatch | null = null;
  for (const m of measured) {
    if (m.landwardM < MIN_LANDWARD_M || m.landwardM > MAX_LANDWARD_M || m.crossTrackM > MAX_TRANSECT_CROSS_M) continue;
    if (angleDifference(m.point.shoreNormalDeg, nearest.point.shoreNormalDeg) > MAX_NORMAL_TURN_DEG) continue;
    if (!best || m.crossTrackM < best.crossTrackM || (m.crossTrackM === best.crossTrackM && m.distanceM < best.distanceM)) {
      best = m;
    }
  }
  return best;
}

const wholeDegrees = (value: number): number => ((Math.round(value) % 360) + 360) % 360;
const commentText = (value: string): string => value.replace(/\s+/g, " ").trim();

/** Why a match is held back for Steven to opt into, or null to apply it. */
function holdReason(beach: MappableBeach, match: MopMatch): string | null {
  const name = commentText(beach.name);
  if (beach.aspect_deg !== null) {
    const difference = Math.round(angleDifference(beach.aspect_deg, match.point.shoreNormalDeg));
    if (difference > HOLD_NORMAL_DIFFERENCE_DEG) {
      return `${name}: aspect_deg ${beach.aspect_deg} vs MOP normal ${wholeDegrees(match.point.shoreNormalDeg)} (${difference}°)`;
    }
  }
  if (match.landwardM > HOLD_LANDWARD_M) {
    return (
      `${name}: ${Math.round(match.landwardM)} m inland of MOP ${match.point.pointId} ` +
      `(normal ${wholeDegrees(match.point.shoreNormalDeg)}, ${Math.round(match.crossTrackM)} m off-transect)`
    );
  }
  return null;
}

function updateStatement(beach: MappableBeach, match: MopMatch): string {
  if (!isUuid(beach.id)) throw new Error(`beach id ${JSON.stringify(beach.id)} is not a uuid`);
  if (!POINT_ID.test(match.point.pointId)) throw new Error(`MOP point id ${JSON.stringify(match.point.pointId)} is malformed`);
  return (
    `UPDATE public.beaches SET mop_point_id = '${match.point.pointId}', ` +
    `mop_shore_normal_deg = ${wholeDegrees(match.point.shoreNormalDeg)}, ` +
    `mop_point_distance_m = ${Math.round(match.distanceM)} WHERE id = '${beach.id}';`
  );
}

/** Reviewable SQL for beaches.mop_*; the script writes it, Steven approves it, nothing runs it automatically. */
export function buildMopMappingSql(
  rows: ReadonlyArray<{ beach: MappableBeach; match: MopMatch | null }>,
  generatedAt: string,
): string {
  const mapped = rows.filter((row): row is { beach: MappableBeach; match: MopMatch } => row.match !== null);
  const unmapped = rows.filter((row) => row.match === null);
  const applied = mapped.filter(({ beach, match }) => holdReason(beach, match) === null);
  const held = mapped.filter(({ beach, match }) => holdReason(beach, match) !== null);
  const furthest = applied.reduce((max, row) => Math.max(max, Math.round(row.match.landwardM)), 0);

  const header = [
    `-- CDIP MOP point per California beach, generated ${generatedAt} by scripts/map-beaches-to-mop.ts.`,
    `-- The MOP nowcast point whose shore-normal transect passes closest to the beach (within ${MAX_TRANSECT_CROSS_M} m),`,
    `-- with the beach up to ${MAX_LANDWARD_M} m landward of it. Review before applying (needs APPROVE).`,
    `-- Held rows are commented out inside the transaction; uncomment one to apply it.`,
    `-- applied: ${applied.length}, held for review: ${held.length}, unmapped: ${unmapped.length}, ` +
      `furthest applied beach: ${furthest} m inland of its point`,
    ...unmapped.map((row) => `-- unmapped: ${row.beach.id} ${commentText(row.beach.name)}`),
  ];
  const review = applied.flatMap(({ beach, match }) => {
    if (beach.aspect_deg === null) return [];
    const difference = Math.round(angleDifference(beach.aspect_deg, match.point.shoreNormalDeg));
    if (difference <= REVIEW_NORMAL_DIFFERENCE_DEG) return [];
    return [
      `-- review: ${commentText(beach.name)} aspect_deg ${beach.aspect_deg} vs MOP ${match.point.pointId} normal ${wholeDegrees(match.point.shoreNormalDeg)} (${difference}°)`,
    ];
  });
  const updates = applied.map(({ beach, match }) => updateStatement(beach, match));
  const heldUpdates = held.map(({ beach, match }) => `-- ${updateStatement(beach, match)} -- ${holdReason(beach, match)}`);

  return [
    ...header,
    ...review,
    "",
    "BEGIN;",
    ...updates,
    ...(heldUpdates.length > 0 ? ["", "-- Held for review:", ...heldUpdates] : []),
    "COMMIT;",
    "",
  ].join("\n");
}
