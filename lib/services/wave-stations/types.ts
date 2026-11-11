/**
 * Wave-station catalogue types.
 *
 * Row types are local because types/database.generated.ts has no entry for
 * wave_stations / wave_station_observations until the migration
 * 20261110200000_wave_station_catalogue.sql is applied and types are regenerated.
 */

/** One id per data provider; the station id is `{source}:{source_station_id}`. */
export type WaveStationSource = "ndbc" | "marine_ie" | "aodn" | "fmi" | "smhi";

export interface WaveStationRow {
  id: string;
  source: WaveStationSource;
  source_station_id: string;
  name: string;
  slug: string;
  country_code: string | null;
  region: string | null;
  lat: number;
  lon: number;
  station_type: string | null;
  owner: string | null;
  program: string | null;
  cdip_station_id: string | null;
  /** WMO number when the source gives one; used to find the same buoy in two sources. */
  wmo_id: string | null;
  /** Set when another source's station is the same physical buoy; readers hide this row. */
  duplicate_of: string | null;
  has_wave: boolean;
  has_swell_split: boolean;
  has_met: boolean;
  license: string;
  attribution: string;
  active: boolean;
  first_seen_at: string;
  last_observed_at: string | null;
  last_wave_observed_at: string | null;
  spec_checked_at: string | null;
  spec_last_modified: string | null;
  spec_last_observed_at: string | null;
  txt_checked_at: string | null;
  txt_last_modified: string | null;
  txt_last_observed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Observation fields shared by every feed. All units are SI as stored. */
export interface WaveObservationValues {
  wave_height_m: number | null;
  dominant_period_s: number | null;
  average_period_s: number | null;
  mean_wave_direction_deg: number | null;
  swell_height_m: number | null;
  swell_period_s: number | null;
  swell_direction_deg: number | null;
  wind_wave_height_m: number | null;
  wind_wave_period_s: number | null;
  wind_wave_direction_deg: number | null;
  steepness: string | null;
  water_temp_c: number | null;
  air_temp_c: number | null;
  wind_speed_ms: number | null;
  wind_direction_deg: number | null;
  wind_gust_ms: number | null;
  pressure_hpa: number | null;
}

export interface WaveStationObservationRow extends WaveObservationValues {
  station_id: string;
  observed_at: string;
  source: WaveStationSource;
  fetched_at: string;
}

/** A station as one source describes it, before catalogue bookkeeping. */
export interface SourceStation {
  sourceStationId: string;
  name: string;
  lat: number;
  lon: number;
  stationType: string | null;
  owner: string | null;
  program: string | null;
  countryCode: string | null;
  region: string | null;
  cdipStationId: string | null;
  wmoId?: string | null;
  hasWave: boolean;
  hasSwellSplit: boolean;
  hasMet: boolean;
  license: string;
  attribution: string;
}

/** One observation from a source; a feed sets only the fields it carries. */
export interface SourceObservation {
  sourceStationId: string;
  observedAt: string;
  values: Partial<WaveObservationValues>;
}

export type StationHistoryFile = "spec" | "txt";

export type StationHistoryResult =
  | { status: "not_modified" }
  | { status: "not_found" }
  | { status: "ok"; lastModified: string | null; observations: SourceObservation[] };

/**
 * One wave-data source. NDBC needs per-station history files; the other
 * sources answer one bulk request for recent hours, so they leave
 * fetchStationHistory out and the "spec" cron phase skips them.
 */
export interface WaveStationSourceAdapter {
  readonly source: WaveStationSource;
  /** How often the latest phase calls this source (its own update rate), in minutes. */
  readonly latestEveryMinutes: 15 | 30 | 60;
  /**
   * Set for a seasonal source whose station list can be empty for months
   * (buoys lifted for ice). An empty list is then not a failure and stored
   * stations stay active, so they show offline through the 30-day rule.
   */
  readonly emptyStationListReason?: string;
  fetchStations(): Promise<SourceStation[]>;
  /** One cheap request for the newest readings of every station (a bounded recent window). */
  fetchLatestObservations(): Promise<SourceObservation[]>;
  /**
   * Per-station history; honours If-Modified-Since. `file` "spec" (default) has
   * the swell split; "txt" is the standard file (waves with dominant period, plus met).
   */
  fetchStationHistory?(
    sourceStationId: string,
    options: { ifModifiedSince: string | null; file?: StationHistoryFile },
  ): Promise<StationHistoryResult>;
}
