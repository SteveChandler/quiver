import type {
  WeekScoutDayResponse,
  WeekScoutWindowResponse,
} from "@/lib/services/discovery/week-scout";

function hasValidDisplayPair(window: WeekScoutWindowResponse): boolean {
  const startMs = Date.parse(window.displayWindowStart);
  const endMs = Date.parse(window.displayWindowEnd);
  return Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs;
}

function canonicalEnd(window: WeekScoutWindowResponse): string {
  return hasValidDisplayPair(window) ? window.displayWindowEnd : window.end;
}

function canonicalStart(window: WeekScoutWindowResponse): string {
  return hasValidDisplayPair(window) ? window.displayWindowStart : window.start;
}

/**
 * Mirrors native Home's canonical-week-scout.ts projectDayBestWindow;
 * parity is pinned in quiver-native src/__tests__/day-call-parity.test.ts.
 */
export function selectDayCall(
  day: WeekScoutDayResponse,
  now: Date,
  options: { closeBufferMs: number },
): WeekScoutWindowResponse | null {
  if (day.bestWindowId === null) return null;

  const nowMs = now.getTime();
  const isOpen = (window: WeekScoutWindowResponse): boolean => {
    const endMs = Date.parse(canonicalEnd(window));
    return endMs - nowMs >= options.closeBufferMs && endMs > nowMs;
  };
  const nominated = day.windows.find((window) => window.id === day.bestWindowId);
  if (nominated && isOpen(nominated)) return nominated;

  return day.windows.filter(isOpen).sort((left, right) => (
    right.conditionScore - left.conditionScore
    || Date.parse(canonicalStart(left)) - Date.parse(canonicalStart(right))
    || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
  ))[0] ?? null;
}
