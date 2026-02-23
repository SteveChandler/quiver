/**
 * CDIP (Coastal Data Information Program) Station Configurations
 *
 * CDIP is operated by the Scripps Institution of Oceanography and provides
 * high-quality wave data from buoy stations along the California coast.
 *
 * Station data includes:
 * - Real-time wave height, period, and direction
 * - Spectral wave data with swell separation
 * - Historical data for trend analysis
 * - Quality-controlled measurements
 */

import { CDIPStationConfig } from "@/types/forecast";

export const CDIP_STATIONS: Record<string, CDIPStationConfig> = {
  // San Diego Area Stations (from CDIP ERDDAP API)
  "100": {
    id: "100",
    name: "Torrey Pines Outer",
    latitude: 32.93,
    longitude: -117.392,
    deployDepth: 550,
    hullType: "3-meter discus buoy",
    parameters: ["wave", "weather", "drifter"],
  },

  "155": {
    id: "155",
    name: "Imperial Beach Nearshore",
    latitude: 32.56968,
    longitude: -117.16895,
    deployDepth: 18,
    hullType: "Waverider buoy",
    parameters: ["wave"],
  },

  "191": {
    id: "191",
    name: "Point Loma South",
    latitude: 32.51753,
    longitude: -117.4253,
    deployDepth: 200,
    hullType: "Waverider buoy",
    parameters: ["wave"],
  },

  "201": {
    id: "201",
    name: "Scripps Nearshore",
    latitude: 32.86785,
    longitude: -117.26667,
    deployDepth: 20,
    hullType: "Waverider buoy",
    parameters: ["wave"],
  },

  "153": {
    id: "153",
    name: "Del Mar Nearshore",
    latitude: 32.95654,
    longitude: -117.2796,
    deployDepth: 15,
    hullType: "Waverider buoy",
    parameters: ["wave"],
  },

  "220": {
    id: "220",
    name: "Mission Bay West",
    latitude: 32.74942,
    longitude: -117.4985,
    deployDepth: 100,
    hullType: "Waverider buoy",
    parameters: ["wave"],
  },

  "208": {
    id: "208",
    name: "Torrey Pines North",
    latitude: 32.951,
    longitude: -117.3846,
    deployDepth: 100,
    hullType: "Waverider buoy",
    parameters: ["wave"],
  },

  "46225": {
    id: "46225",
    name: "Point Reyes",
    latitude: 37.751,
    longitude: -122.839,
    deployDepth: 430,
    hullType: "3-meter discus buoy",
    parameters: ["wave", "weather"],
  },

  "46236": {
    id: "46236",
    name: "Monterey Bay",
    latitude: 36.771,
    longitude: -122.186,
    deployDepth: 1100,
    hullType: "3-meter discus buoy",
    parameters: ["wave", "weather", "sst"],
  },

  // Orange County / Camp Pendleton area
  "45": {
    id: "45",
    name: "Oceanside Offshore",
    latitude: 33.1771,
    longitude: -117.472,
    deployDepth: 200,
    hullType: "Waverider buoy",
    parameters: ["wave"],
  },

  // Ventura / Channel Islands area
  "179": {
    id: "179",
    name: "Anacapa Passage",
    latitude: 34.0008,
    longitude: -119.3592,
    deployDepth: 200,
    hullType: "Waverider buoy",
    parameters: ["wave"],
  },

  // Additional SoCal Stations
  "67": {
    id: "67",
    name: "San Pedro South",
    latitude: 33.618,
    longitude: -118.318,
    deployDepth: 880,
    hullType: "3-meter discus buoy",
    parameters: ["wave", "weather"],
  },

  "071": {
    id: "071",
    name: "Harvest",
    latitude: 34.443,
    longitude: -120.775,
    deployDepth: 476,
    hullType: "3-meter discus buoy",
    parameters: ["wave", "weather"],
  },

  "46221": {
    id: "46221",
    name: "Point Arena",
    latitude: 38.837,
    longitude: -123.737,
    deployDepth: 100,
    hullType: "3-meter discus buoy",
    parameters: ["wave", "weather"],
  },

  // Central California
  "71": {
    id: "71",
    name: "Half Moon Bay",
    latitude: 37.494,
    longitude: -122.469,
    deployDepth: 274,
    hullType: "3-meter discus buoy",
    parameters: ["wave", "weather"],
  },

  "157": {
    id: "157",
    name: "Pt. Sur",
    latitude: 36.3,
    longitude: -121.892,
    deployDepth: 384,
    hullType: "3-meter discus buoy",
    parameters: ["wave", "weather"],
  },
};

// Primary stations for Southern California beaches
export const SOCAL_PRIMARY_STATIONS = ["100", "67", "191"];

// Station coverage areas (approximate radius in km)
export const STATION_COVERAGE_RADIUS = {
  "100": 100, // Covers most of San Diego County
  "67": 75, // Covers LA/Orange County
  "191": 50, // Covers Point Loma / South San Diego
  "157": 60, // Covers Big Sur area
  "46236": 80, // Covers Monterey Bay area
  "71": 50, // Covers San Francisco Peninsula
  "46225": 75, // Covers North Bay
  "46221": 60, // Covers Mendocino Coast
} as const;

// API Configuration - Updated to use working ERDDAP endpoints
export const CDIP_API_CONFIG = {
  // Primary API: ERDDAP - reliable and standardized
  baseUrl: "http://erddap.cdip.ucsd.edu/erddap/tabledap/wave_agg.json",
  
  // API endpoints for different data types
  endpoints: {
    // Wave data: Get recent wave measurements
    waveData: "?station_id,time,waveHs,waveTp,waveTa,waveDp&waveFlagPrimary=1&time>max(time)-1days&station_id=\"{stationId}\"",
    // Station metadata: Get station info
    metadata: "?station_id,metaStationName,latitude,longitude&station_id=\"{stationId}\"&distinct()",
  },
  
  // Fallback URLs for alternative access methods
  fallbackUrls: {
    thredds: "https://thredds.cdip.ucsd.edu/thredds/catalog/cdip/realtime/catalog.html",
    ndar: "http://cdip.ucsd.edu/data_access/ndar.cdip",
  },
  
  // Data processing settings
  dataTypes: {
    wave: "xy", // Wave height/period/direction
    weather: "ww", // Wind/weather
    sst: "oc", // Sea surface temperature
  },
  formats: {
    json: "json",
    netcdf: "nc", 
    text: "txt",
  },
  timeFormats: {
    utc: "Z",
    local: "",
  },
} as const;

// Quality thresholds for data validation
export const DATA_QUALITY_THRESHOLDS = {
  // Wave height validation (meters)
  waveHeight: {
    min: 0.1,
    max: 15.0, // Reasonable maximum for Pacific Coast
    typical_max: 8.0, // Typical maximum for Southern California
  },

  // Wave period validation (seconds)
  wavePeriod: {
    min: 2.0, // Minimum for meaningful waves
    max: 30.0, // Maximum realistic period
    swell_min: 8.0, // Minimum for swell classification
  },

  // Wave direction validation (degrees)
  waveDirection: {
    min: 0,
    max: 360,
  },

  // Data freshness (minutes)
  dataFreshness: {
    excellent: 30, // Within 30 minutes
    good: 120, // Within 2 hours
    acceptable: 360, // Within 6 hours
    stale: 720, // Older than 12 hours
  },
} as const;

export function getStationConfig(stationId: string): CDIPStationConfig | null {
  return CDIP_STATIONS[stationId] || null;
}

function getStationCoverageRadius(stationId: string): number {
  return (
    STATION_COVERAGE_RADIUS[
      stationId as keyof typeof STATION_COVERAGE_RADIUS
    ] || 50
  );
}
