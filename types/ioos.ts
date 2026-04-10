/**
 * TypeScript types for IOOS (Integrated Ocean Observing System) data
 * Used for wave buoy observations from ERDDAP API
 */

import type { CanonicalVar } from "@/lib/constants/ioos-config";

/**
 * IOOS station metadata as stored in the database
 */
export interface IOOSStation {
  station_id: string;
  source_network: IOOSNetwork;
  name: string | null;
  latitude: number;
  longitude: number;
  sensors: IOOSSensor[] | null;
  has_wave_data: boolean;
  nearest_beach_id: string | null;
  distance_to_beach_km: number | null;
  active: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
  // Capability fields for dynamic variable discovery
  available_variables?: string[];
  variable_map?: Partial<Record<CanonicalVar, string>>;
  variables_last_synced_at?: string | null;
}

/**
 * IOOS observation record
 */
export interface IOOSObservation {
  id?: number;
  station_id: string;
  observed_at: string;
  wave_height_m: number | null;
  wave_period_s: number | null;
  wave_direction_deg: number | null;
  water_temp_c: number | null;
  wind_speed_ms: number | null;
  wind_direction_deg: number | null;
  raw_data?: Record<string, unknown>;
  created_at?: string;
}

/**
 * Regional IOOS networks
 */
export type IOOSNetwork =
  | "PacIOOS"      // Pacific Islands
  | "NANOOS"       // Northwest Association of Networked Ocean Observing Systems
  | "CeNCOOS"      // Central and Northern California
  | "SCCOOS"       // Southern California Coastal Ocean Observing System
  | "GCOOS"        // Gulf of Mexico
  | "SECOORA"      // Southeast Coastal Ocean Observing Regional Association
  | "MARACOOS"     // Mid-Atlantic Regional Association
  | "NERACOOS"     // Northeastern Regional Association
  | "GLOS"         // Great Lakes
  | "AOOS"         // Alaska
  | "NDBC"         // National Data Buoy Center (fallback/overlap)
  | "unknown";

/**
 * Sensor types available at IOOS stations
 */
export type IOOSSensor =
  | "wave_height"
  | "wave_period"
  | "wave_direction"
  | "water_temp"
  | "wind_speed"
  | "wind_direction"
  | "air_temp"
  | "air_pressure"
  | "salinity"
  | "current";

/**
 * Geographic bounds for station queries
 */
export interface GeoBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/**
 * Raw ERDDAP station response
 */
export interface ERDDAPStationResponse {
  table: {
    columnNames: string[];
    columnTypes: string[];
    rows: (string | number | null)[][];
  };
}

/**
 * Raw ERDDAP observation response
 */
export interface ERDDAPObservationResponse {
  table: {
    columnNames: string[];
    columnTypes: string[];
    rows: (string | number | null)[][];
  };
}

/**
 * IOOS service configuration
 */
export interface IOOSServiceConfig {
  baseUrl: string;
  userAgent: string;
  timeoutMs: number;
  maxConcurrentRequests: number;
  batchDelayMs: number;
  cacheTtlMs: number;
}

/**
 * Station discovery result
 */
export interface IOOSStationDiscoveryResult {
  stations: IOOSStation[];
  totalFound: number;
  waveStationsFound: number;
  linkedToBeaches: number;
  errors: string[];
}

/**
 * Observation sync result
 */
export interface IOOSObservationSyncResult {
  stationsSynced: number;
  observationsInserted: number;
  stationsFailed: number;
  duration_ms: number;
  errors: string[];
}

/**
 * Default IOOS service configuration
 */
export const DEFAULT_IOOS_CONFIG: IOOSServiceConfig = {
  baseUrl: "https://erddap.sensors.ioos.us/erddap",
  userAgent: "quiver-surf-app/1.0 (contact: team@quiversurf.app)",
  timeoutMs: 30000,
  maxConcurrentRequests: 5,
  batchDelayMs: 500,
  cacheTtlMs: 10 * 60 * 1000, // 10 minutes
};

/**
 * IOOS networks by US region
 */
export const IOOS_NETWORKS_BY_REGION: Record<string, IOOSNetwork[]> = {
  hawaii: ["PacIOOS"],
  alaska: ["AOOS"],
  westCoast: ["CeNCOOS", "SCCOOS", "NANOOS"],
  gulfCoast: ["GCOOS"],
  eastCoast: ["SECOORA", "MARACOOS", "NERACOOS"],
  greatLakes: ["GLOS"],
};

/**
 * Priority networks for initial rollout
 * NDBC is critical - it's the National Data Buoy Center with most wave buoys
 */
export const PRIORITY_NETWORKS: IOOSNetwork[] = [
  "NDBC",      // National Data Buoy Center - primary source of wave data
  "CeNCOOS",   // Central/Northern California (includes CDIP stations)
  "SCCOOS",    // Southern California (includes CDIP stations)
  "NANOOS",    // Oregon/Washington
  "PacIOOS",   // Hawaii
  "SECOORA",   // Southeast (FL, GA, SC, NC)
  "MARACOOS",  // Mid-Atlantic (VA, MD, DE, NJ, NY)
  "NERACOOS",  // Northeast (MA, NH, ME)
  "GCOOS",     // Gulf of Mexico
];
