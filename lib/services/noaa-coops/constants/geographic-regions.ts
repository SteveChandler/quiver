/**
 * Geographic regions for station fallback lookup
 *
 * When a beach name is not found in COOPS_STATIONS,
 * these geographic bounds are used to find the nearest station.
 */

import type { RegionBounds } from "../types";

export const GEOGRAPHIC_STATIONS: RegionBounds[] = [
  // ==================== WEST COAST ====================

  // Hawaii
  {
    latMin: 18.5,
    latMax: 22.5,
    lonMin: -160.5,
    lonMax: -154.5,
    stationId: "1612340",
    name: "Hawaii (Honolulu)",
  },

  // Southern California - San Diego
  {
    latMin: 32.5,
    latMax: 33.0,
    lonMin: -117.5,
    lonMax: -117.0,
    stationId: "9410170",
    name: "San Diego",
  },

  // Southern California - North County
  {
    latMin: 33.0,
    latMax: 33.5,
    lonMin: -117.5,
    lonMax: -117.1,
    stationId: "9410230",
    name: "La Jolla",
  },

  // Orange County
  {
    latMin: 33.3,
    latMax: 33.8,
    lonMin: -118.1,
    lonMax: -117.4,
    stationId: "9410580",
    name: "Newport Beach",
  },

  // Los Angeles
  {
    latMin: 33.7,
    latMax: 34.1,
    lonMin: -118.8,
    lonMax: -118.1,
    stationId: "9410840",
    name: "Santa Monica",
  },

  // Ventura / Santa Barbara
  {
    latMin: 34.0,
    latMax: 34.5,
    lonMin: -120.0,
    lonMax: -119.0,
    stationId: "9411340",
    name: "Santa Barbara",
  },

  // Central California
  {
    latMin: 34.5,
    latMax: 37.0,
    lonMin: -122.5,
    lonMax: -120.0,
    stationId: "9413450",
    name: "Monterey",
  },

  // Northern California
  {
    latMin: 37.0,
    latMax: 42.0,
    lonMin: -124.5,
    lonMax: -122.0,
    stationId: "9414290",
    name: "San Francisco",
  },

  // Southern Oregon
  {
    latMin: 42.0,
    latMax: 43.5,
    lonMin: -125.0,
    lonMax: -124.0,
    stationId: "9432780",
    name: "Charleston OR",
  },

  // Central Oregon
  {
    latMin: 43.5,
    latMax: 45.0,
    lonMin: -125.0,
    lonMax: -123.5,
    stationId: "9435380",
    name: "South Beach OR",
  },

  // Northern Oregon
  {
    latMin: 45.0,
    latMax: 46.5,
    lonMin: -124.5,
    lonMax: -123.5,
    stationId: "9439040",
    name: "Astoria OR",
  },

  // Washington
  {
    latMin: 46.0,
    latMax: 49.0,
    lonMin: -125.0,
    lonMax: -123.0,
    stationId: "9441102",
    name: "Westport WA",
  },

  // Baja Mexico (use San Diego)
  {
    latMin: 30.0,
    latMax: 32.5,
    lonMin: -117.5,
    lonMax: -116.0,
    stationId: "9410170",
    name: "San Diego (Baja)",
  },

  // ==================== EAST COAST ====================

  // Maine
  {
    latMin: 43.0,
    latMax: 45.5,
    lonMin: -71.0,
    lonMax: -69.5,
    stationId: "8418150",
    name: "Portland ME",
  },

  // New Hampshire
  {
    latMin: 42.8,
    latMax: 43.2,
    lonMin: -71.0,
    lonMax: -70.5,
    stationId: "8423898",
    name: "Fort Point NH",
  },

  // Massachusetts
  {
    latMin: 41.0,
    latMax: 43.0,
    lonMin: -71.5,
    lonMax: -69.5,
    stationId: "8443970",
    name: "Boston MA",
  },

  // Rhode Island
  {
    latMin: 41.0,
    latMax: 42.0,
    lonMin: -72.0,
    lonMax: -71.0,
    stationId: "8452660",
    name: "Newport RI",
  },

  // Connecticut / Long Island Sound
  {
    latMin: 40.5,
    latMax: 41.5,
    lonMin: -74.0,
    lonMax: -72.0,
    stationId: "8531680",
    name: "Sandy Hook NJ",
  },

  // New York - Long Island
  {
    latMin: 40.4,
    latMax: 41.2,
    lonMin: -74.0,
    lonMax: -71.5,
    stationId: "8531680",
    name: "Sandy Hook NJ (NY)",
  },

  // New Jersey
  {
    latMin: 38.9,
    latMax: 40.5,
    lonMin: -75.0,
    lonMax: -73.5,
    stationId: "8534720",
    name: "Atlantic City NJ",
  },

  // Delaware / Maryland
  {
    latMin: 38.0,
    latMax: 39.0,
    lonMin: -75.5,
    lonMax: -74.5,
    stationId: "8570283",
    name: "Ocean City MD",
  },

  // Virginia
  {
    latMin: 36.5,
    latMax: 38.0,
    lonMin: -76.5,
    lonMax: -75.0,
    stationId: "8638610",
    name: "Virginia Beach VA",
  },

  // North Carolina - Outer Banks
  {
    latMin: 34.5,
    latMax: 36.5,
    lonMin: -76.5,
    lonMax: -75.0,
    stationId: "8652587",
    name: "Oregon Inlet NC",
  },

  // North Carolina - South
  {
    latMin: 33.5,
    latMax: 34.5,
    lonMin: -78.5,
    lonMax: -77.5,
    stationId: "8658120",
    name: "Wrightsville NC",
  },

  // South Carolina
  {
    latMin: 32.0,
    latMax: 34.0,
    lonMin: -81.0,
    lonMax: -78.5,
    stationId: "8665530",
    name: "Charleston SC",
  },

  // Georgia
  {
    latMin: 30.5,
    latMax: 32.5,
    lonMin: -82.0,
    lonMax: -80.5,
    stationId: "8670870",
    name: "Fort Pulaski GA",
  },

  // Florida - Northeast
  {
    latMin: 29.0,
    latMax: 31.0,
    lonMin: -82.0,
    lonMax: -80.0,
    stationId: "8720218",
    name: "Mayport FL",
  },

  // Florida - Central Atlantic
  {
    latMin: 27.5,
    latMax: 29.5,
    lonMin: -81.0,
    lonMax: -79.5,
    stationId: "8721604",
    name: "Ponce Inlet FL",
  },

  // Florida - Southeast
  {
    latMin: 25.5,
    latMax: 27.5,
    lonMin: -80.5,
    lonMax: -79.5,
    stationId: "8723214",
    name: "Virginia Key FL",
  },

  // Florida Keys
  {
    latMin: 24.0,
    latMax: 25.5,
    lonMin: -82.0,
    lonMax: -80.0,
    stationId: "8724580",
    name: "Key West FL",
  },

  // ==================== GULF COAST ====================

  // Florida - Gulf
  {
    latMin: 27.0,
    latMax: 30.0,
    lonMin: -83.5,
    lonMax: -82.0,
    stationId: "8726520",
    name: "St. Petersburg FL",
  },

  // Florida - Panhandle
  {
    latMin: 29.5,
    latMax: 31.0,
    lonMin: -87.5,
    lonMax: -84.0,
    stationId: "8729108",
    name: "Panama City FL",
  },

  // Alabama / Mississippi
  {
    latMin: 29.5,
    latMax: 31.0,
    lonMin: -89.5,
    lonMax: -87.5,
    stationId: "8735180",
    name: "Dauphin Island AL",
  },

  // Louisiana
  {
    latMin: 28.5,
    latMax: 30.5,
    lonMin: -93.5,
    lonMax: -89.0,
    stationId: "8761724",
    name: "Grand Isle LA",
  },

  // Texas - Upper Coast
  {
    latMin: 28.5,
    latMax: 30.0,
    lonMin: -96.0,
    lonMax: -93.5,
    stationId: "8771450",
    name: "Galveston TX",
  },

  // Texas - South Padre
  {
    latMin: 25.5,
    latMax: 28.5,
    lonMin: -98.0,
    lonMax: -96.0,
    stationId: "8779770",
    name: "Port Isabel TX",
  },

  // ==================== CARIBBEAN ====================

  // Puerto Rico - West
  {
    latMin: 17.5,
    latMax: 18.6,
    lonMin: -67.5,
    lonMax: -66.5,
    stationId: "9759394",
    name: "Mayaguez PR",
  },

  // Puerto Rico - North/East
  {
    latMin: 17.5,
    latMax: 18.6,
    lonMin: -66.5,
    lonMax: -65.0,
    stationId: "9755371",
    name: "San Juan PR",
  },
];
