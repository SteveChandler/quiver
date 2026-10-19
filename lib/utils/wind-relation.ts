/**
 * Wind relation to the beach (offshore / cross-shore / onshore), shared by the
 * surf call's window summary and the public forecast's wind cell so both draw
 * the same lines.
 *
 * @module lib/utils/wind-relation
 */

import { angleDifference } from "@/lib/domains/shared/angle-utils";

/** Below this the surf call reads the wind as glassy and names no relation. */
export const WIND_SPEED_GLASSY_MPH = 5;

const OFFSHORE_MAX_DEG = 45;
const CROSS_SHORE_MIN_DEG = 135;

type WindRelation = "offshore" | "cross-shore" | "onshore";

export function classifyWindRelation(
  windFromDeg: number,
  offshoreDeg: number,
): WindRelation {
  const diff = angleDifference(windFromDeg, offshoreDeg);
  if (diff <= OFFSHORE_MAX_DEG) return "offshore";
  if (diff >= CROSS_SHORE_MIN_DEG) return "onshore";
  return "cross-shore";
}
