// Response contract for GET /api/beaches/[id]/swell-events. quiver-native mirrors this file,
// so it stays types only, with no imports.

export type RegionSwellConfidence = 'on_the_way' | 'likely' | 'early_look';

export interface RegionBeachRating {
  beachId: string;
  beachName: string;
  /** GOOD / FAIR / RIDEABLE / MEH (EPIC while it is on); LIKELY or EARLY LOOK for an early look. */
  label: string;
  /** "Mon 9 AM–3 PM": the longest run of daylight hours at `label` on the peak day. */
  window: string | null;
  /** "3-4 ft", the forecast face at the best hour. */
  faceFt: string | null;
  /** "too big for most", "blown out", "small, sheltered", "closing out" or "exposure unknown". */
  reason: string | null;
  exposure: 'open' | 'partial' | 'shadowed' | null;
}

export interface RegionSwellEvent {
  key: string;
  kind: 'swell' | 'storm';
  confidence: RegionSwellConfidence;
  leadDays: number;
  directionLabel: string | null;
  periodS: number | null;
  arrivalAt: string | null;
  peakAt: string;
  fadeAt: string | null;
  peakLocalDate: string;
  /** "7 ft", the rounded offshore height. */
  offshoreFt: string | null;
  history: string | null;
  /** The requested beach. */
  here: RegionBeachRating | null;
  /** GOOD/FAIR, best first, max 5. */
  working: RegionBeachRating[];
  /** Max 3, each with a reason. */
  notWorking: RegionBeachRating[];
}

export interface RegionSwellEventsResponse {
  region: string | null;
  buoy: { id: string; name: string } | null;
  beachCount: number;
  events: RegionSwellEvent[];
}
