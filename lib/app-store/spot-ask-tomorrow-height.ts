import type { ForecastRecommendationContext } from "@/lib/services/forecast-recommendation-context";
import { isDataStale } from "@/lib/utils/forecast-client-utils";

/**
 * Tomorrow's figures from the same forecast rows (one query, one timestamp)
 * the beach hero used. `context` is what the hero would show in tomorrow mode;
 * `tableLabel` is the tomorrow card of the day strip on the same page.
 */
export interface SpotAskTomorrowInputs {
  context: ForecastRecommendationContext | null;
  tableLabel: string | null;
}

interface SelectInput {
  /** The hero's context. */
  today: ForecastRecommendationContext | null;
  /** True when the hero already shows tomorrow (no window left today). */
  heroIsTomorrow: boolean;
  tomorrow: SpotAskTomorrowInputs | null | undefined;
  now?: Date;
}

export function upperBoundFt(label: string | null | undefined): number | null {
  if (typeof label !== "string") return null;
  const numbers = (label.match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter(Number.isFinite);
  return numbers.length > 0 ? Math.max(...numbers) : null;
}

function nextLocalDate(localDate: string): string | null {
  const date = new Date(`${localDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function isFresh(context: ForecastRecommendationContext, now: Date): boolean {
  if (!context.sourceDataUpdatedAt) return false;
  const updatedAt = new Date(context.sourceDataUpdatedAt).getTime();
  if (Number.isNaN(updatedAt) || updatedAt > now.getTime()) return false;
  return !isDataStale(context.sourceDataUpdatedAt, context.primaryDataSource);
}

/**
 * The height for copy B ("{H} at {Spot} tomorrow"), or null for copy A.
 *
 * B needs both displayed labels (today's hero, tomorrow's hero-mode label),
 * both fresh, tomorrow the day after today, tomorrow's upper bound above
 * today's, and the page's tomorrow card agreeing on that upper bound, so the
 * ask never contradicts a number on the same page. Anything else is A.
 */
export function selectSpotAskTomorrowHeight({
  today,
  heroIsTomorrow,
  tomorrow,
  now = new Date(),
}: SelectInput): string | null {
  if (heroIsTomorrow || !today || !tomorrow?.context) return null;

  const todayLabel = today.waveHeightRangeLabel;
  const tomorrowLabel = tomorrow.context.waveHeightRangeLabel;
  const todayUpper = upperBoundFt(todayLabel);
  const tomorrowUpper = upperBoundFt(tomorrowLabel);
  if (todayUpper === null || tomorrowUpper === null || !tomorrowLabel) return null;

  if (nextLocalDate(today.localDate) !== tomorrow.context.localDate) return null;
  if (!isFresh(today, now) || !isFresh(tomorrow.context, now)) return null;
  if (tomorrowUpper <= todayUpper) return null;
  if (upperBoundFt(tomorrow.tableLabel) !== tomorrowUpper) return null;

  return tomorrowLabel;
}
