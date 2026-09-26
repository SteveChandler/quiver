import { seawardNormalDeg } from "./geo";
import type { ClimatologyPlace, ClimatologyRole, SourceKind } from "./types";

export interface ClimatologySourceConfig {
  id: string;
  alias: string | null;
  name: string;
  role: ClimatologyRole;
  kind: SourceKind;
  lat: number;
  lon: number;
  years: readonly [number, number];
  pageUrl: string;
}

export interface CityClimatologyConfig {
  citySlug: string;
  cityName: string;
  timezone: string;
  reference: ClimatologyPlace;
  places: ClimatologyPlace[];
  shoreNormalDeg: number | null;
  sources: ClimatologySourceConfig[];
}

// Pier and Doheny coordinates are from Wikipedia. Cocoa Beach Pier and
// Satellite Beach are from the beaches seed in
// supabase/migrations/20251207000001_add_southeast_gulf_beaches.sql.
const COCOA_BEACH_PIER: ClimatologyPlace = { label: "Cocoa Beach Pier", lat: 28.367648, lon: -80.602777 };
const SATELLITE_BEACH: ClimatologyPlace = { label: "Satellite Beach", lat: 28.1707, lon: -80.5913 };
const NEWPORT_PIER: ClimatologyPlace = { label: "Newport Pier", lat: 33.607328, lon: -117.928942 };
const HUNTINGTON_BEACH_PIER: ClimatologyPlace = { label: "Huntington Beach Pier", lat: 33.655093, lon: -118.004193 };
const DOHENY_STATE_BEACH: ClimatologyPlace = { label: "Doheny State Beach", lat: 33.460833, lon: -117.678056 };
const WAIKIKI: ClimatologyPlace = { label: "Waikīkī", lat: 21.2766, lon: -157.8269 };

// Station positions are the current NDBC deployment coordinates.
const ndbcPage = (id: string): string =>
  `https://www.ndbc.noaa.gov/station_page.php?station=${id.toLowerCase()}`;

export const CITY_CLIMATOLOGY_CONFIGS: readonly CityClimatologyConfig[] = [
  {
    citySlug: "cocoa-beach",
    cityName: "Cocoa Beach",
    timezone: "America/New_York",
    reference: COCOA_BEACH_PIER,
    places: [COCOA_BEACH_PIER, SATELLITE_BEACH],
    // Walking south from the pier to Satellite Beach, the sea is on the left.
    shoreNormalDeg: Math.round(seawardNormalDeg(COCOA_BEACH_PIER, SATELLITE_BEACH, "left")),
    sources: [
      {
        id: "41113",
        alias: "CDIP 143",
        name: "Cape Canaveral Nearshore",
        role: "waves",
        kind: "ndbc",
        lat: 28.4,
        lon: -80.533,
        years: [2007, 2025],
        pageUrl: ndbcPage("41113"),
      },
      {
        id: "TRDF1",
        alias: "CO-OPS 8721604",
        name: "Trident Pier",
        role: "wind",
        kind: "ndbc",
        lat: 28.416,
        lon: -80.593,
        years: [2007, 2025],
        pageUrl: ndbcPage("trdf1"),
      },
    ],
  },
  {
    citySlug: "newport-beach",
    cityName: "Newport Beach",
    timezone: "America/Los_Angeles",
    reference: NEWPORT_PIER,
    places: [NEWPORT_PIER, HUNTINGTON_BEACH_PIER, DOHENY_STATE_BEACH],
    // Walking southeast from Huntington to Newport, the sea is on the right.
    shoreNormalDeg: Math.round(seawardNormalDeg(HUNTINGTON_BEACH_PIER, NEWPORT_PIER, "right")),
    sources: [
      {
        id: "46253",
        alias: "CDIP 213",
        name: "San Pedro South",
        role: "waves",
        kind: "ndbc",
        lat: 33.576,
        lon: -118.182,
        years: [2015, 2025],
        pageUrl: ndbcPage("46253"),
      },
      {
        // Same years as San Pedro South so the comparison covers one period.
        id: "46224",
        alias: "CDIP 045",
        name: "Oceanside Offshore",
        role: "comparison-waves",
        kind: "ndbc",
        lat: 33.178,
        lon: -117.472,
        years: [2015, 2025],
        pageUrl: ndbcPage("46224"),
      },
      {
        id: "SNA",
        alias: null,
        name: "John Wayne Airport",
        role: "wind",
        kind: "iem-asos",
        lat: 33.6757,
        lon: -117.8682,
        years: [2015, 2025],
        pageUrl: "https://mesonet.agron.iastate.edu/sites/site.php?station=SNA&network=CA_ASOS",
      },
    ],
  },
  {
    citySlug: "honolulu",
    cityName: "Honolulu",
    timezone: "Pacific/Honolulu",
    reference: WAIKIKI,
    places: [WAIKIKI],
    shoreNormalDeg: null,
    sources: [
      {
        id: "51211",
        alias: "CDIP 233",
        name: "Pearl Harbor Entrance",
        role: "waves",
        kind: "ndbc",
        lat: 21.297,
        lon: -157.959,
        years: [2017, 2025],
        pageUrl: ndbcPage("51211"),
      },
    ],
  },
];
