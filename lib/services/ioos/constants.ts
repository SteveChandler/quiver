/**
 * IOOS Service Constants
 *
 * Constants specific to the IOOS service implementation.
 * For API-level constants, see @/lib/constants/ioos-config.ts
 *
 * @module ioos/constants
 */

/**
 * Network name patterns for parsing dataset IDs and institutions
 */
export const NETWORK_PATTERNS = {
  // ISM pattern: "ism-NETWORK-..."
  ISM_PREFIX: /^ism-([a-z]+)-/,

  // Network name mappings (lowercase for case-insensitive matching)
  NETWORKS: {
    pacioos: "PacIOOS",
    nanoos: "NANOOS",
    cencoos: "CeNCOOS",
    sccoos: "SCCOOS",
    gcoos: "GCOOS",
    secoora: "SECOORA",
    maracoos: "MARACOOS",
    neracoos: "NERACOOS",
    glos: "GLOS",
    aoos: "AOOS",
    ndbc: "NDBC",
    cdip: "CeNCOOS", // CDIP maps to CeNCOOS
  } as const,
} as const;

/**
 * Station ID validation pattern
 * Prevents URL injection attacks
 */
export const STATION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Station filtering patterns
 */
export const STATION_FILTERS = {
  /** ISM federated IDs are incompatible with tabledap API */
  ISM_PREFIX: "ism-",

  /** DART buoys are for tsunami detection, not wave height */
  DART_KEYWORD: "dart",

  /** NDBC ocean buoys pattern (wmo_4xxxx or wmo_5xxxx) */
  NDBC_OCEAN_BUOY: /^wmo_[45]\d{4}/,

  /** Keywords indicating wave data capability */
  WAVE_KEYWORDS: ["wave", "cdip"],
} as const;

/**
 * ISM filtering warning threshold
 * Alert if more than this percentage of stations are ISM-prefixed
 */
export const ISM_FILTER_WARNING_THRESHOLD = 0.5;

/**
 * Maximum number of stations to return from nearby search
 * Prevents unbounded queries
 */
export const NEARBY_STATIONS_LIMIT = 100;
