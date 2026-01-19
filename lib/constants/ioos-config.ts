/**
 * IOOS (Integrated Ocean Observing System) Configuration
 *
 * Configuration for fetching wave buoy data from IOOS ERDDAP API.
 * Prioritizes Hawaii (PacIOOS) and East Coast coverage.
 */

import { IOOSServiceConfig, IOOSNetwork } from "@/types/ioos";

/**
 * IOOS ERDDAP API Configuration
 */
export const IOOS_API_CONFIG: IOOSServiceConfig = {
  // Primary IOOS ERDDAP server
  baseUrl: "https://erddap.sensors.ioos.us/erddap",
  userAgent: "quiver-surf-app/1.0 (contact: team@quiversurf.app)",
  timeoutMs: 30000,
  maxConcurrentRequests: 5,
  batchDelayMs: 500,
  cacheTtlMs: 10 * 60 * 1000, // 10 minutes
};

/**
 * Regional ERDDAP servers (fallbacks and specialized endpoints)
 */
export const IOOS_REGIONAL_SERVERS: Record<IOOSNetwork, string> = {
  PacIOOS: "https://pae-paha.pacioos.hawaii.edu/erddap",
  NANOOS: "https://nvs.nanoos.org/erddap",
  CeNCOOS: "https://erddap.cencoos.org/erddap",
  SCCOOS: "https://erddap.sccoos.org/erddap",
  GCOOS: "https://erddap.gcoos.org/erddap",
  SECOORA: "https://erddap.secoora.org/erddap",
  MARACOOS: "https://erddap.maracoos.org/erddap",
  NERACOOS: "https://www.neracoos.org/erddap",
  GLOS: "https://glbuoys.glos.org/erddap",
  AOOS: "https://erddap.aoos.org/erddap",
  NDBC: "https://erddap.ioos.us/erddap",
  unknown: "https://erddap.sensors.ioos.us/erddap",
};

/**
 * ERDDAP endpoints for different data types
 */
export const IOOS_ENDPOINTS = {
  // List all datasets
  allDatasets: "/tabledap/allDatasets.json",

  // Dataset info (replace {datasetId})
  datasetInfo: "/info/{datasetId}/index.json",

  // Observations query (replace {datasetId} and add query params)
  observations: "/tabledap/{datasetId}.json",
} as const;

/**
 * Wave-related variable names in IOOS datasets
 * Different datasets may use different naming conventions
 */
export const IOOS_WAVE_VARIABLES = {
  // Common wave height variable names
  waveHeight: [
    "sea_surface_wave_significant_height",
    "wave_height",
    "significant_wave_height",
    "Hs",
    "WVHT",
  ],

  // Common wave period variable names
  wavePeriod: [
    "sea_surface_wave_peak_period",
    "sea_surface_wave_mean_period",
    "wave_period",
    "dominant_wave_period",
    "Tp",
    "DPD",
  ],

  // Common wave direction variable names
  waveDirection: [
    "sea_surface_wave_from_direction",
    "sea_surface_wave_to_direction",
    "wave_direction",
    "mean_wave_direction",
    "MWD",
  ],

  // Water temperature
  waterTemp: [
    "sea_water_temperature",
    "water_temperature",
    "WTMP",
  ],

  // Wind speed
  windSpeed: [
    "wind_speed",
    "WSPD",
  ],

  // Wind direction
  windDirection: [
    "wind_from_direction",
    "wind_to_direction",
    "WDIR",
  ],
} as const;

/**
 * Data quality thresholds for IOOS observations
 */
export const IOOS_QUALITY_THRESHOLDS = {
  // Wave height validation (meters)
  waveHeight: {
    min: 0.05,  // 5cm minimum
    max: 25.0,  // 25m maximum (extreme case)
    typicalMax: 10.0,
  },

  // Wave period validation (seconds)
  wavePeriod: {
    min: 1.0,
    max: 30.0,
  },

  // Wave direction (degrees)
  waveDirection: {
    min: 0,
    max: 360,
  },

  // Water temperature (Celsius)
  waterTemp: {
    min: -2.0,  // Can be slightly below freezing
    max: 35.0,
  },

  // Wind speed (m/s)
  windSpeed: {
    min: 0,
    max: 50.0,
  },

  // Observation age (hours) - mark as stale after this
  maxObservationAgeHours: 6,

  // Station inactive threshold (days)
  stationInactiveDays: 7,
} as const;

/**
 * Station filtering settings
 */
export const IOOS_STATION_FILTERS = {
  // Maximum distance from any beach to include station (km)
  maxDistanceFromBeachKm: 150,

  // Minimum distance to prefer closer stations (km)
  preferredDistanceKm: 100,

  // Batch size for station discovery
  discoveryBatchSize: 50,

  // Batch size for observation sync
  observationBatchSize: 10,
} as const;

/**
 * Sync schedule configuration
 */
export const IOOS_SYNC_CONFIG = {
  // Station discovery runs weekly (Sunday 5 AM UTC)
  stationDiscoveryCron: "0 5 * * 0",

  // Observation sync runs every 2 hours
  observationSyncCron: "0 */2 * * *",

  // Maximum runtime for observation sync (ms)
  observationSyncMaxRuntimeMs: 5 * 60 * 1000, // 5 minutes

  // Maximum runtime for station discovery (ms)
  stationDiscoveryMaxRuntimeMs: 10 * 60 * 1000, // 10 minutes
} as const;
