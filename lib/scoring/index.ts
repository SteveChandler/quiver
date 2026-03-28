/**
 * Unified Surf Scoring Module
 *
 * Provides consistent scoring and window calculation for both
 * Morning Intel and Discovery Service.
 *
 * @example
 * ```typescript
 * import { scoreConditions, calculateOptimalWindow } from '@/lib/scoring';
 *
 * const score = scoreConditions(forecast, beach);
 * const window = calculateOptimalWindow(forecasts, beach, { sunsetTime });
 * ```
 */

export { computeTrendTags, type TrendTag } from './trend-tags';
export { scoreConditions } from './surf-conditions-scorer';
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
  type ConditionScore,
  type ConditionSubscores,
  type ForecastForScoring,
  type MatchQuality,
  type OptimalWindow,
  type RecommendationLabel,
  type WindowBoundaryReason,
  type WindowCalculatorOptions,
} from './types';
export { calculateMultipleWindows } from './window-calculator';
export { getConditionBoardPick, type BoardForPick, type BoardPickResult } from './board-pick';
export { calculateRelativeContext, type DailyScore } from './relative-context';
export { getConditionCharacter, angleDifference } from './surf-conditions-scorer';
export { type ConditionCharacter, type ConditionCharacterCategory, type MultiWindowResult, type RelativeContext } from './types';
