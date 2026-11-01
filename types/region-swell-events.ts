// Response contract for GET /api/beaches/[id]/swell-events. quiver-native mirrors this file,
// so it stays types only, with no imports.

export type RegionSwellConfidence = 'on_the_way' | 'likely' | 'early_look';

export interface RegionBeachRating {
  beachId: string;
  beachName: string;
  /** GOOD / FAIR / RIDEABLE / MEH (EPIC while it is on); LIKELY or EARLY LOOK for an early look. */
  label: string;
  /** "Mon 9 AM–3 PM": the longest run of daylight hours at `label` in one day of the event's window. */
  window: string | null;
  /** ISO instants bounding the same run of hours `window` names; null when `window` is. */
  windowStartAt?: string | null;
  windowEndAt?: string | null;
  /** "3-4 ft", the forecast face at the best hour of the event's window. */
  faceFt: string | null;
  /** "too big for most", "blown out", "small, sheltered", "closing out" or "exposure unknown". */
  reason: string | null;
  exposure: 'open' | 'partial' | 'shadowed' | null;
  /** Why it does or doesn't work for this event, with digits only in foot ranges and wind clock hours; null for an early look, or when the beach has no swell window or no wind in its hours. */
  why?: string | null;
}

export interface RegionWatchBeach {
  beachId: string;
  beachName: string;
  exposure: 'open' | 'partial' | 'shadowed' | null;
  /** The regional rating's not-working reason, null when it works or has no rating. */
  reason: string | null;
  /** One line per beach-local day of the event's window with daylight rows, earliest first; [] for an early look. */
  days: Array<{ localDate: string; faceFt: string | null; why: string | null }>;
}

export interface RegionSwellEvent {
  key: string;
  kind: 'swell' | 'storm';
  /** 'wam': an early-look peak past the stored forecast; its beaches are rated by exposure only (LIKELY / EARLY LOOK). */
  source: 'forecast' | 'wam';
  /** Lead time only: a stored-forecast event 10+ days out is 'early_look' with real ratings. */
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
  /** The event in one sentence with digits only in foot ranges and wind clock hours: direction, kind, period and days. Null for an early look. */
  story?: string | null;
  breaker?: 'pitching' | 'crumbly' | null;
  /** Present only when the request names beaches: each named region beach's standing for this event. */
  watch?: RegionWatchBeach[];
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
