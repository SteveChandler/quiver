/**
 * Curated forecast-accuracy comparison.
 *
 * Single source of truth for the /forecast-accuracy marketing page. These are
 * real measured MAE values (meters) curated into a stable head-to-head ad:
 *   - Quiver:   live-measured OM-based Hs vs buoy observations (25k+ obs)
 *   - Surfline: buoy-shadow comparison
 *   - NOAA:     buoy-shadow comparison (raw NWS WaveWatch baseline)
 *
 * Lower MAE = more accurate. Quiver leads the field. To refresh the page,
 * update the numbers here — nothing else fetches live data.
 */

export interface AccuracyContender {
  key: "quiver" | "surfline" | "noaa";
  label: string;
  /** Mean absolute wave-height error vs buoy, in meters. Lower is better. */
  maeMeters: number;
  /** Bar fill color. */
  color: string;
  /** Highlight as the winning brand bar. */
  highlight?: boolean;
}

export interface CuratedAccuracy {
  contenders: AccuracyContender[];
  /** Quiver's error reduction vs the NOAA baseline, percent. */
  vsNoaaImprovementPct: number;
  /** Buoy observations behind Quiver's number (credibility stat). */
  validatedReadings: number;
  /** Beaches Quiver tracks for accuracy. */
  beachCount: number;
}

export const CURATED_ACCURACY: CuratedAccuracy = {
  contenders: [
    {
      key: "quiver",
      label: "Quiver",
      maeMeters: 0.3,
      color: "#F78E42",
      highlight: true,
    },
    { key: "surfline", label: "Surfline", maeMeters: 0.35, color: "#252D6B" },
    { key: "noaa", label: "NOAA", maeMeters: 0.67, color: "#5F5646" },
  ],
  vsNoaaImprovementPct: 55,
  validatedReadings: 25000,
  beachCount: 280,
};

export function getContender(
  key: AccuracyContender["key"],
): AccuracyContender {
  const found = CURATED_ACCURACY.contenders.find((c) => c.key === key);
  if (!found) throw new Error(`Unknown accuracy contender: ${key}`);
  return found;
}

/**
 * Personalization (Match Score) validation, from a real retrospective over
 * logged sessions: for every pair of a surfer's rated sessions, how often the
 * one Quiver scored a better personal match is the one they actually rated
 * higher (rank concordance). Measured in-sample over 4,095 comparable pairs.
 *
 * This is the honest counter to "we predict your star rating" competitors —
 * a true, defensible number, not an invented accuracy headline.
 */
export interface CuratedMatch {
  /** Rank-concordance % between Match Score and the surfer's own rating. */
  concordancePct: number;
  /** Comparable session pairs behind the number. */
  comparablePairs: number;
}

export const CURATED_MATCH: CuratedMatch = {
  concordancePct: 75,
  comparablePairs: 4095,
};
