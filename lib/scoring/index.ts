/**
 * Unified Surf Scoring Module
 *
 * Window calculation, message generation, and trend utilities for the
 * Morning Intel and Discovery flows. The numeric scoring API has moved
 * to `@/lib/domains/scoring` — import the domain engine for new code.
 *
 * @example
 * ```typescript
 * import { calculateOptimalWindow } from '@/lib/scoring';
 *
 * const window = calculateOptimalWindow(forecasts, beach, { sunsetTime });
 * ```
 */

export { computeTrendTags, type TrendTag } from './trend-tags';
;
export {
  toForecastForScoring,





  type RecommendationLabel,


} from './types';
export {
  getConditionBoardPick,
  type BoardForPick,


} from './board-pick';
;
