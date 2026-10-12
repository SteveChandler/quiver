/**
 * CDIP-NDBC Station Overlap Mappings
 *
 * Many buoy stations are shared between CDIP (Scripps) and NDBC (NOAA) networks.
 * This mapping helps deduplicate data when both sources return the same station.
 *
 * Format: CDIP station ID -> NDBC station ID
 * CDIP takes priority (higher credibility for wave data)
 */
export const CDIP_NDBC_OVERLAPS: Record<string, string> = {
  // Southern California
  "100": "46225", // Torrey Pines Outer
  "045": "46242", // Pt. Fermin Outer
  "073": "46086", // San Clemente Basin
  "157": "46232", // Point Loma South
  "093": "46253", // San Pedro Basin
  "067": "46219", // San Nicolas Island

  // Central California
  "094": "46214", // Point Reyes
  "029": "46236", // Harvest Platform
  "071": "46218", // Harvest
  "156": "46251", // Cape Mendocino

  // Northern California
  "168": "46237", // San Francisco Bar
  "142": "46213", // Cape Mendocino
};
