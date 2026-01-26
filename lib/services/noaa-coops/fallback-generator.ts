/**
 * Fallback tide data generator
 *
 * Generates synthetic tide data for development/testing when
 * the NOAA API is unavailable or returns no data.
 */

import type { TideData } from "./types";

/**
 * Generate fallback tide data for development/testing
 *
 * Creates a realistic tide schedule with proper high/low patterns
 * based on San Diego's semi-diurnal tide pattern (2 highs, 2 lows per day).
 *
 * @param days - Number of days to generate (default: 15)
 * @returns Array of tide data points
 */
export function generateFallbackTideData(days: number = 15): TideData[] {
  const tides: TideData[] = [];

  // Start from beginning of today
  const startTime = new Date();
  startTime.setHours(0, 0, 0, 0);

  // Generate tides for specified number of days
  for (let day = 0; day < days; day++) {
    const dayStart = new Date(
      startTime.getTime() + day * 24 * 60 * 60 * 1000
    );

    // San Diego typically has 2 high tides and 2 low tides per day
    // Semi-diurnal tide pattern with about 6.2 hour intervals

    // First low tide (around 1:30 AM) - add slight daily variation
    const lowTide1 = new Date(
      dayStart.getTime() + (1.5 + Math.sin(day * 0.1) * 0.5) * 60 * 60 * 1000
    );

    // First high tide (around 7:45 AM)
    const highTide1 = new Date(lowTide1.getTime() + 6.25 * 60 * 60 * 1000);

    // Second low tide (around 2:00 PM)
    const lowTide2 = new Date(highTide1.getTime() + 6.25 * 60 * 60 * 1000);

    // Second high tide (around 8:15 PM)
    const highTide2 = new Date(lowTide2.getTime() + 6.25 * 60 * 60 * 1000);

    // Add some variation to tide heights (spring/neap tide cycle simulation)
    const heightVariation = Math.sin(day * 0.2) * 0.5;

    tides.push({
      time: Math.floor(lowTide1.getTime() / 1000),
      height: Math.round((0.8 + heightVariation) * 10) / 10,
      name: "Low Tide",
      type: "low",
    });

    tides.push({
      time: Math.floor(highTide1.getTime() / 1000),
      height: Math.round((5.2 + heightVariation) * 10) / 10,
      name: "High Tide",
      type: "high",
    });

    tides.push({
      time: Math.floor(lowTide2.getTime() / 1000),
      height: Math.round((1.2 + heightVariation) * 10) / 10,
      name: "Low Tide",
      type: "low",
    });

    tides.push({
      time: Math.floor(highTide2.getTime() / 1000),
      height: Math.round((4.8 + heightVariation) * 10) / 10,
      name: "High Tide",
      type: "high",
    });
  }

  return tides.sort((a, b) => a.time - b.time);
}
