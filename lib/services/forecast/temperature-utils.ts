/**
 * Temperature Estimation Utilities
 *
 * Provides seasonal temperature estimates for California coast
 * when actual data is unavailable.
 */

/**
 * Estimate water temperature based on location and season
 * Uses sinusoidal model with 65°F base for California coast
 */
export function estimateWaterTemperature(lat: number, date: Date): string {
  const month = date.getMonth();
  const baseTemp = 65; // Base temperature for California coast

  // Seasonal variation: peaks in late summer (offset by 3 months from sin wave)
  const seasonalAdjustment = 10 * Math.sin(((month - 3) * Math.PI) / 6);
  const estimatedTemp = Math.round(baseTemp + seasonalAdjustment);

  return `${estimatedTemp}°F`;
}

/**
 * Estimate air temperature based on location and season
 * Uses sinusoidal model with 70°F base for California coast
 */
export function estimateAirTemperature(lat: number, date: Date): string {
  const month = date.getMonth();
  const baseTemp = 70; // Base temperature for California coast

  // Seasonal variation: larger swing than water (±15°F vs ±10°F)
  const seasonalAdjustment = 15 * Math.sin(((month - 3) * Math.PI) / 6);
  const estimatedTemp = Math.round(baseTemp + seasonalAdjustment);

  return `${estimatedTemp}°F`;
}
