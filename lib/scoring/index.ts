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
export { calculateOptimalWindow } from './window-calculator';
export {
  generateWindowMessage,
  generateConditionSummary,
  formatTimeCompact,
  formatTimeRange,
  type ConditionSummaryInput,
} from './message-generator';
export {
  toForecastForScoring,
  type BeachWithThresholds,
  type ConditionSubscores,
  type ForecastForScoring,
  type MatchQuality,
  type OptimalWindow,
  type RecommendationLabel,
  type WindowBoundaryReason,
  type WindowCalculatorOptions,
} from './types';
export { calculateMultipleWindows } from './window-calculator';
export {
  getConditionBoardPick,
  type BoardForPick,
  type BoardPickContext,
  type BoardPickResult,
} from './board-pick';
export { calculateRelativeContext, type DailyScore } from './relative-context';
export { type ConditionCharacter, type ConditionCharacterCategory, type MultiWindowResult, type RelativeContext } from './types';
