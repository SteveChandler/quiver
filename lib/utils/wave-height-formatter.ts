/**
 * Parse wave height from various formats to get numeric value
 * @param waveHeight Wave height as number, string, or null/undefined
 * @returns Numeric wave height in feet or undefined
 */
export function parseWaveHeight(
  waveHeight?: number | string | null
): number | undefined {
  if (waveHeight === null || waveHeight === undefined || waveHeight === "")
    return undefined;

  // If it's already a number, return it
  if (typeof waveHeight === "number") {
    return waveHeight;
  }

  // If it's a string, try to parse it
  if (typeof waveHeight === "string") {
    // Handle formats like "4 ft", "4ft", "4.5 ft", "4-5 ft", etc.
    const match = waveHeight.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const parsed = parseFloat(match[1]);
      return isNaN(parsed) ? undefined : parsed;
    }
  }

  return undefined;
}

/**
 * Format wave height for display in badges and UI
 * @param waveHeight Wave height in feet (number, string, or null/undefined)
 * @returns Formatted wave height string (e.g., "2-3ft", "8ft+")
 */
export function formatWaveHeight(waveHeight?: number | string | null): string {
  const parsed = parseWaveHeight(waveHeight);

  if (!parsed || parsed === 0) return "0-1ft";

  if (parsed < 1) return "0-1ft";
  if (parsed < 2) return "1-2ft";
  if (parsed < 3) return "2-3ft";
  if (parsed < 4) return "3-4ft";
  if (parsed < 5) return "4-5ft";
  if (parsed < 6) return "5-6ft";
  if (parsed < 8) return "6-8ft";
  if (parsed < 10) return "8-10ft";
  return `${Math.floor(parsed)}ft+`;
}

/**
 * Get the raw numeric wave height value from any format
 * @param waveHeight Wave height in any format
 * @returns Numeric value or undefined
 */
export function getWaveHeightValue(
  waveHeight?: number | string | null
): number | undefined {
  return parseWaveHeight(waveHeight);
}
