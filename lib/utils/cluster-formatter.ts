/**
 * Format wave height range for cluster display
 * @param waveHeights Array of wave heights in feet
 * @returns Formatted range string (e.g., "1-4ft") or "—" if no data
 */
export function formatClusterWaveRange(
  waveHeights: (number | undefined | null)[]
): string {
  const validHeights = waveHeights.filter(
    (h): h is number => typeof h === "number" && !isNaN(h) && isFinite(h)
  );

  if (validHeights.length === 0) return "—";

  const min = Math.min(...validHeights);
  const max = Math.max(...validHeights);

  // Convert to display buckets
  const minBucket = Math.max(0, Math.floor(min));
  const maxBucket = Math.ceil(max);

  // If same bucket, show single range
  if (minBucket === maxBucket || maxBucket - minBucket <= 1) {
    if (minBucket === 0) return "0-1ft";
    return `${minBucket}-${minBucket + 1}ft`;
  }

  return `${minBucket}-${maxBucket}ft`;
}

/**
 * Get cluster marker background color
 * @param hasFavorite Whether cluster contains a favorite beach
 * @returns CSS gradient string
 */
export function getClusterColor(hasFavorite: boolean): string {
  if (hasFavorite) {
    return "linear-gradient(to right, #3b82f6, #2563eb)";
  }
  return "linear-gradient(to right, #fbbf24, #f59e0b)";
}
