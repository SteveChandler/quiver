/**
 * A single-row buoy observation anchor used by ForecastBuilder when building
 * the nowcast display for an observable beach. Represents ground truth at
 * `observedAt` from the matched NDBC/IOOS/CDIP station.
 */
export interface NowcastAnchor {
  beachId: string;
  stationId: string;
  observedAt: string; // ISO timestamp
  waveHeightM: number; // offshore Hs (pre-shoaling, same frame as NDBC buoy input)
  wavePeriodS: number | null;
  waveDirectionDeg: number | null;
}

/** Feature flag value carried in `beaches.features` text[] column. */
export const NOWCAST_ANCHOR_FEATURE_FLAG = "observation_anchor" as const;

/**
 * Gate 1 of the nowcast-anchor feature: the beach must opt in via its
 * `features` column. Additional gates (freshness, forecast-window) are
 * enforced inside ForecastBuilder by shouldApplyNowcastAnchor().
 */
export function isNowcastAnchorEnabled(beachFeatures: string[] | null | undefined): boolean {
  if (!beachFeatures) return false;
  return beachFeatures.includes(NOWCAST_ANCHOR_FEATURE_FLAG);
}
