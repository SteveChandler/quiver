import type { EveningTransition, PersonalizedForecastWindow } from '@/types/personalization';

type SunTimesCache = Map<string, { sunrises: Date[]; sunsets: Date[] }>;

/**
 * Check if the current time is nighttime (after sunset, before next sunrise)
 * for a given beach.
 *
 * Correct when the most recent past astronomical event for the beach is a
 * sunset, not a sunrise. A naive "last sunset was < 12h ago" heuristic wrongly
 * returns true in the early morning — today's sunrise has already happened,
 * but yesterday's sunset is still within 12h — which used to cause the
 * "Rest of Today / Evening session" block to render at ~6 AM.
 */
export function isAfterSunset(
  beachId: string,
  now: Date,
  sunTimesCache: SunTimesCache,
): boolean {
  const sunTimes = sunTimesCache.get(beachId);
  if (!sunTimes?.sunsets.length) return false;

  const nowMs = now.getTime();

  const pastSunsets = sunTimes.sunsets
    .map(s => s.getTime())
    .filter(t => t <= nowMs);
  if (pastSunsets.length === 0) return false;

  const lastSunset = Math.max(...pastSunsets);

  const pastSunrises = (sunTimes.sunrises ?? [])
    .map(s => s.getTime())
    .filter(t => t <= nowMs);
  const lastSunrise = pastSunrises.length > 0 ? Math.max(...pastSunrises) : -Infinity;

  // Nighttime iff the most recent past event was a sunset.
  return lastSunset > lastSunrise;
}

/**
 * Map a local-time hour to a session label. The previous implementation
 * hardcoded "Evening session" regardless of the peak hour, which violated the
 * "no hardcoded time-of-day copy" rule and surfaced as "Evening session at
 * 8 AM" when the sunset gate misfired.
 */
function sessionLabelForHour(hour: number): string {
  if (hour < 8) return 'Dawn patrol';
  if (hour < 11) return 'Morning session';
  if (hour < 14) return 'Midday session';
  if (hour < 17) return 'Afternoon session';
  return 'Evening session';
}

function hourInTimezone(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: timezone,
  }).formatToParts(date);
  const hourPart = parts.find(p => p.type === 'hour')?.value ?? '0';
  // Intl can emit '24' for midnight with hour12:false; normalize to 0.
  const parsed = parseInt(hourPart, 10);
  return parsed === 24 ? 0 : parsed;
}

/**
 * Build the condensed "Rest of Today" summary from remaining best window.
 */
export function buildRestOfToday(
  remainingWindow: PersonalizedForecastWindow | null,
  timezone: string,
): EveningTransition['restOfToday'] {
  if (!remainingWindow) {
    return { summary: 'Done for today', conditions: '', waveHeight: '—' };
  }

  const anchor = remainingWindow.peakTime ?? remainingWindow.start;
  const hourNum = hourInTimezone(anchor, timezone);
  const hourDisplay = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: true,
    timeZone: timezone,
  }).format(anchor);

  const conditionParts = [hourDisplay];
  if (remainingWindow.wind) conditionParts.push(remainingWindow.wind);
  if (remainingWindow.tide) conditionParts.push(remainingWindow.tide);

  return {
    summary: sessionLabelForHour(hourNum),
    conditions: conditionParts.join(' · '),
    waveHeight: remainingWindow.waveHeight ?? '—',
  };
}
