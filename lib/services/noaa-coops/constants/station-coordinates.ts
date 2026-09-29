/**
 * Coordinates of every station COOPS_STATIONS and GEOGRAPHIC_STATIONS can
 * return, from NOAA's tide-prediction station list
 * (mdapi/prod/webapi/stations.json?type=tidepredictions, read 2026-09-29).
 * The resolver checks name matches against these, so a station added to either
 * table needs an entry here (enforced by station-resolver tests).
 */
export const COOPS_STATION_COORDINATES: Record<string, { lat: number; lon: number }> = {
  "1611400": { lat: 21.9544, lon: -159.3561 }, // NAWILIWILI, HI
  "1612340": { lat: 21.3033, lon: -157.8645 }, // HONOLULU, HI
  "1615680": { lat: 20.8949, lon: -156.469 }, // KAHULUI, HI
  "1617433": { lat: 20.0366, lon: -155.8294 }, // Kawaihae, HI
  "1617760": { lat: 19.7303, lon: -155.0556 }, // HILO, HI
  "8418150": { lat: 43.6581, lon: -70.2442 }, // PORTLAND, ME
  "8423898": { lat: 43.0717, lon: -70.7117 }, // Fort Point, NH
  "8443970": { lat: 42.3539, lon: -71.0503 }, // BOSTON, MA
  "8447930": { lat: 41.5236, lon: -70.6711 }, // OCEANOGRAPHIC INSTITUTION, MA
  "8449130": { lat: 41.285, lon: -70.0967 }, // NANTUCKET, MA
  "8452660": { lat: 41.5043, lon: -71.3261 }, // NEWPORT, RI
  "8510560": { lat: 41.0483, lon: -71.9594 }, // Montauk, Fort Pond Bay, NY
  "8531680": { lat: 40.4669, lon: -74.0094 }, // Sandy Hook, Fort Hancock, NJ
  "8534720": { lat: 39.3567, lon: -74.4181 }, // Atlantic City (Ocean), NJ
  "8536110": { lat: 38.9683, lon: -74.96 }, // Cape May, ferry terminal, NJ
  "8557380": { lat: 38.7828, lon: -75.1193 }, // LEWES (BREAKWATER HARBOR), DE
  "8570283": { lat: 38.3283, lon: -75.0917 }, // Ocean City Inlet, MD
  "8630413": { lat: 37.865, lon: -75.3683 }, // Assateague Beach, Toms Cove, VA
  "8638610": { lat: 36.9428, lon: -76.3286 }, // HAMPTON ROADS (Sewells Point), VA
  "8639208": { lat: 36.8317, lon: -75.9683 }, // Rudee Inlet entrance, VA
  "8639428": { lat: 36.6917, lon: -75.92 }, // Sandbridge, VA
  "8651370": { lat: 36.1833, lon: -75.7467 }, // DUCK PIER, NC
  "8652587": { lat: 35.7957, lon: -75.5482 }, // OREGON INLET MARINA, NC
  "8658120": { lat: 34.2267, lon: -77.9533 }, // Wilmington, NC
  "8658163": { lat: 34.2133, lon: -77.7867 }, // Wrightsville Beach, NC
  "8661070": { lat: 33.655, lon: -78.9183 }, // Springmaid Pier, Myrtle beach, SC
  "8665530": { lat: 32.7808, lon: -79.9236 }, // CHARLESTON (Customhouse Wharf), SC
  "8670870": { lat: 32.0347, lon: -80.903 }, // Fort Pulaski, Savannah River Entrance, GA
  "8677344": { lat: 31.1317, lon: -81.3967 }, // St. Simons Light, GA
  "8720218": { lat: 30.3982, lon: -81.4279 }, // MAYPORT (BAR PILOT DOCK), FL
  "8720587": { lat: 29.8567, lon: -81.2633 }, // St. Augustine Beach, FL
  "8721604": { lat: 28.4158, lon: -80.5931 }, // Port Canaveral (Trident Pier), FL
  "8722670": { lat: 26.6128, lon: -80.0342 }, // Lake Worth Pier (ocean), FL
  "8723214": { lat: 25.7314, lon: -80.1618 }, // Virginia Key, Biscayne Bay, FL
  "8724580": { lat: 24.5557, lon: -81.8079 }, // KEY WEST, FL
  "8725110": { lat: 26.1317, lon: -81.8075 }, // Naples (outer coast), FL
  "8726520": { lat: 27.7606, lon: -82.6269 }, // St. Petersburg, FL
  "8729108": { lat: 30.1497, lon: -85.6644 }, // Panama City, FL
  "8735180": { lat: 30.25, lon: -88.075 }, // DAUPHIN ISLAND, AL
  "8761724": { lat: 29.2633, lon: -89.9567 }, // EAST POINT, GRAND ISLE, LA
  "8771450": { lat: 29.31, lon: -94.7933 }, // GALVESTON, Galveston Channel, TX
  "8775241": { lat: 27.8366, lon: -97.0391 }, // Aransas, Aransas Pass, TX
  "8779770": { lat: 26.0612, lon: -97.2155 }, // Port Isabel, TX
  "9410170": { lat: 32.7156, lon: -117.1767 }, // SAN DIEGO (Broadway), CA
  "9410230": { lat: 32.8669, lon: -117.2571 }, // La Jolla (Scripps Institution Wharf), CA
  "9410580": { lat: 33.6033, lon: -117.883 }, // Newport Bay Entrance, Corona del Mar, CA
  "9410840": { lat: 34.0083, lon: -118.5 }, // Santa Monica, Municipal Pier, CA
  "9411270": { lat: 34.3483, lon: -119.443 }, // Rincon Island, Mussel Shoals, CA
  "9411340": { lat: 34.4046, lon: -119.6925 }, // Santa Barbara, CA
  "9412110": { lat: 35.1689, lon: -120.7542 }, // PORT SAN LUIS, CA
  "9413450": { lat: 36.6089, lon: -121.8914 }, // MONTEREY, MONTEREY BAY, CA
  "9414290": { lat: 37.8063, lon: -122.4659 }, // SAN FRANCISCO (Golden Gate), CA
  "9418767": { lat: 40.7669, lon: -124.2173 }, // HUMBOLDT BAY (North Spit), CA
  "9419059": { lat: 41.0567, lon: -124.147 }, // Trinidad Harbor, CA
  "9430104": { lat: 42.0433, lon: -124.285 }, // Brookings, Chetco Cove, OR
  "9432780": { lat: 43.345, lon: -124.322 }, // CHARLESTON, OR
  "9435380": { lat: 44.6254, lon: -124.0449 }, // Southbeach, OR
  "9437540": { lat: 45.5545, lon: -123.9189 }, // Garibaldi, OR
  "9439040": { lat: 46.2073, lon: -123.7683 }, // ASTORIA (Tongue Point), Oreg., OR
  "9440910": { lat: 46.7075, lon: -123.9669 }, // Toke Point, WA
  "9441102": { lat: 46.9043, lon: -124.1051 }, // Westport, Point Chehalis, WA
  "9442396": { lat: 47.9128, lon: -124.6357 }, // La Push, Quillayute River, WA
  "9755371": { lat: 18.4589, lon: -66.1164 }, // SAN JUAN, PR
  "9759394": { lat: 18.2188, lon: -67.1624 }, // Mayaguez, PR
};
