/**
 * Forecast Formatter
 * Formats surf conditions into prose for the Quiver Surf Forecast bot
 */

export { formatWaveRange } from '@/lib/utils/wave-formatters';

export interface RegionalForecastData {
  region: 'norcal' | 'central' | 'socal';
  primaryBeach: {
    id: string;
    name: string;
    waveHeight: number | null;
    wavePeriod: number | null;
    windSpeed: number | null;
    windDirection: string | null;
    windOffshoreDeg: number | null;
    tideTime: string | null;
    tideHeight: number | null;
    tideType: string | null;
    tideAt: string | null;
    waterTemp: number | null;
  };
  secondaryBeaches: Array<{
    name: string;
    waveHeight: number | null;
    windDirection: string | null;
    windOffshoreDeg: number | null;
    windSpeed: number | null;
    conditions: string;
  }>;
}

/**
 * Parse water temperature from DB text format (e.g., "57°F") (Bug 5)
 */
export function parseWaterTemp(waterTempText: string | null): number | null {
  if (!waterTempText) return null;
  const match = waterTempText.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Get deterministic seasonal water temperature for a region (Bug 5)
 * Replaces the random getDefaultWaterTemp()
 */
export function getSeasonalWaterTemp(region: 'norcal' | 'central' | 'socal'): number {
  const month = new Date().getMonth(); // 0-11
  // Seasonal averages by region (Feb=1, Aug=7 peak)
  const seasonalTemps = {
    norcal:  [54, 54, 54, 55, 55, 56, 57, 58, 58, 57, 56, 55],
    central: [56, 56, 56, 57, 58, 59, 61, 62, 62, 61, 59, 57],
    socal:   [60, 60, 60, 61, 63, 65, 68, 70, 70, 68, 64, 61],
  };
  return seasonalTemps[region][month];
}
