import type { EveningTransition, PersonalizedForecastWindow } from '@/types/personalization';

type SunTimesCache = Map<string, { sunrises: Date[]; sunsets: Date[] }>;

/**
 * Check if current time is past sunset for a given beach.
 */
export function isAfterSunset(
  beachId: string,
  now: Date,
  sunTimesCache: SunTimesCache,
): boolean {
  const sunTimes = sunTimesCache.get(beachId);
  if (!sunTimes?.sunsets.length) return false;

  // Find today's sunset — a sunset that is in the past but within 12 hours
  const todaySunset = sunTimes.sunsets.find(s => {
    const diff = now.getTime() - s.getTime();
    return diff > 0 && diff < 12 * 60 * 60 * 1000;
  });

  if (!todaySunset) {
    // Fallback: any sunset in the past
    return sunTimes.sunsets.some(s => s.getTime() < now.getTime());
  }

  return now.getTime() > todaySunset.getTime();
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

  const hour = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: true,
    timeZone: timezone,
  }).format(remainingWindow.start);

  const conditionParts = [hour];
  if (remainingWindow.wind) conditionParts.push(remainingWindow.wind);
  if (remainingWindow.waveHeight) conditionParts.push(remainingWindow.waveHeight);
  if (remainingWindow.tide) conditionParts.push(remainingWindow.tide);

  return {
    summary: 'Evening session',
    conditions: conditionParts.join(' · '),
    waveHeight: remainingWindow.waveHeight ?? '—',
  };
}
