/**
 * Format wave height for display in badges and UI
 * @param waveHeight Wave height in feet (optional)
 * @returns Formatted wave height string (e.g., "2-3ft", "8ft+")
 */
export function formatWaveHeight(waveHeight?: number): string {
  if (!waveHeight || waveHeight === 0) return "0-1ft";

  if (waveHeight < 1) return "0-1ft";
  if (waveHeight < 2) return "1-2ft";
  if (waveHeight < 3) return "2-3ft";
  if (waveHeight < 4) return "3-4ft";
  if (waveHeight < 5) return "4-5ft";
  if (waveHeight < 6) return "5-6ft";
  if (waveHeight < 8) return "6-8ft";
  if (waveHeight < 10) return "8-10ft";
  return `${Math.floor(waveHeight)}ft+`;
}
