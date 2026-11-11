/**
 * Local row types for `tide_stations` (migration 20261110200000_create_tide_stations).
 * `types/database.generated.ts` does not know this table until the migration is
 * applied and types are regenerated, so reads cast to these shapes.
 */

export type TideStationSource = "noaa" | "ticon";

export type TideStationKind = "reference" | "subordinate" | "harmonic-model";

export interface StoredTideConstituent {
  name: string;
  amplitudeM: number;
  phaseDeg: number;
}

export interface TideStationRow {
  id: string;
  source: TideStationSource;
  source_station_id: string;
  name: string;
  slug: string;
  country_code: string;
  country_slug: string;
  region: string | null;
  region_slug: string | null;
  lat: number;
  lon: number;
  timezone: string;
  station_kind: TideStationKind;
  reference_station_id: string | null;
  datum_label: string;
  datum_offset_m: number | null;
  constituents: StoredTideConstituent[] | null;
  operator: string;
  licence: string;
  licence_url: string;
  attribution: string;
  commercial_use: boolean;
  active: boolean;
}

/** List-view columns: never select `constituents` for more than one station. */
export type TideStationSummary = Pick<
  TideStationRow,
  "id" | "source" | "name" | "slug" | "country_code" | "country_slug" | "region" | "region_slug" | "lat" | "lon" | "station_kind"
>;

export interface TideStationRegionCount {
  country_code: string;
  country_slug: string;
  region: string | null;
  region_slug: string | null;
  station_count: number;
}
