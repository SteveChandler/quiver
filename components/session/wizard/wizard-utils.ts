/**
 * Parses a duration string (e.g., "2h 30m", "1h", "45m") into minutes.
 * @param duration - Duration string in format like "2h 30m"
 * @returns Total duration in minutes, or undefined if parsing fails
 */
export function parseDuration(duration: string): number | undefined {
  if (!duration) return undefined;
  const hourMatch = duration.match(/(\d+)h/);
  const minuteMatch = duration.match(/(\d+)m/);
  const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
  const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;
  return hours * 60 + minutes;
}
