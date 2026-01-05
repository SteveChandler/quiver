/**
 * Conditions Analyzer Module
 * 
 * Analyzes surf conditions by combining swell, wind, and tide evaluations
 * to provide overall condition scores and recommendations.
 * 
 * Extracted from lib/utils/morning-intel-utils.ts as part of P1 refactoring
 * to reduce complexity and improve maintainability.
 */

import type {
  BeachPreferences,
  ConditionEvaluation,
  ConditionsAnalysis,
  TideMetrics,
  WindMetrics,
  MorningIntelRecommendationSummary,
} from "@/types/morning-intel";

import { analyzeSwellMatch } from "@/lib/analyzers/swell-analyzer";
import { analyzeWindConditions } from "@/lib/analyzers/wind-analyzer";

/**
 * Analyze tide conditions relative to beach preferences
 * 
 * Evaluates tide height against beach-specific optimal ranges
 * and categorizes as optimal, acceptable, or poor.
 * 
 * @param tideHeight - Current tide height in feet
 * @param beach - Beach preferences including tide range
 * @returns Condition evaluation with status, emoji, and message
 * 
 * @example
 * ```typescript
 * const tideEval = analyzeTideConditions(3.5, {
 *   tideMinFt: 2,
 *   tideMaxFt: 5
 * });
 * // Returns: { status: 'optimal', emoji: '✅', message: '3.5 ft - within optimal range...' }
 * ```
 */
export function analyzeTideConditions(
  tideHeight: number,
  beach: BeachPreferences
): ConditionEvaluation {
  // If no tide preference defined, consider acceptable
  if (beach.tideMinFt == null || beach.tideMaxFt == null) {
    return {
      status: "acceptable",
      emoji: "⚠️",
      message: `${tideHeight.toFixed(1)} ft (no preference set)`,
    };
  }

  // Check if tide is within preferred range
  if (tideHeight >= beach.tideMinFt && tideHeight <= beach.tideMaxFt) {
    return {
      status: "optimal",
      emoji: "✅",
      message: `${tideHeight.toFixed(1)} ft - within optimal range (${beach.tideMinFt}-${beach.tideMaxFt} ft)`,
    };
  }

  // Check if tide is close to the range (within 1 ft)
  const belowMin = beach.tideMinFt - tideHeight;
  const aboveMax = tideHeight - beach.tideMaxFt;

  if ((belowMin > 0 && belowMin <= 1) || (aboveMax > 0 && aboveMax <= 1)) {
    return {
      status: "acceptable",
      emoji: "⚠️",
      message: `${tideHeight.toFixed(1)} ft - close to optimal range (${beach.tideMinFt}-${beach.tideMaxFt} ft)`,
    };
  }

  return {
    status: "poor",
    emoji: "❌",
    message: `${tideHeight.toFixed(1)} ft - outside optimal range (${beach.tideMinFt}-${beach.tideMaxFt} ft)`,
  };
}

/**
 * Calculate overall conditions score and analysis
 * 
 * Combines swell, wind, and tide evaluations into a single
 * conditions score and analysis.
 * 
 * Scoring: optimal = 3.33 points, acceptable = 1.67 points, poor = 0 points
 * Max score = 10 (all factors optimal)
 * 
 * @param forecast - Forecast data including swell direction, wind, and tide
 * @param beach - Beach preferences for optimal conditions
 * @returns Conditions analysis with overall score and individual factor evaluations
 * 
 * @example
 * ```typescript
 * const analysis = analyzeConditions({
 *   swellDirection: 270,
 *   wind: { speed: 5, direction: 'offshore' },
 *   tide: { height: 3.5, direction: 'rising' }
 * }, beachPrefs);
 * // Returns: { score: 10, swell: {...}, wind: {...}, tide: {...} }
 * ```
 */
export function analyzeConditions(
  forecast: {
    swellDirection?: number | null;
    wind: WindMetrics;
    tide: TideMetrics;
  },
  beach: BeachPreferences
): ConditionsAnalysis {
  const swellEval = analyzeSwellMatch(forecast.swellDirection, beach);
  const windEval = analyzeWindConditions(forecast.wind, beach);
  const tideEval = analyzeTideConditions(forecast.tide.height, beach);

  // Calculate score: optimal = 3.33 points, acceptable = 1.67 points, poor = 0 points
  const scoreMap = { optimal: 3.33, acceptable: 1.67, poor: 0 };
  const score = Math.round(
    scoreMap[swellEval.status] +
      scoreMap[windEval.status] +
      scoreMap[tideEval.status]
  );

  return {
    score: Math.min(10, score),
    swell: swellEval,
    wind: windEval,
    tide: tideEval,
  };
}

/**
 * Convert factor key to human-readable name
 * 
 * @param factor - Factor key (swell, wind, or tide)
 * @returns Human-readable factor name
 * @private
 */
function humanizeFactorName(factor: "swell" | "wind" | "tide"): string {
  switch (factor) {
    case "swell":
      return "swell direction";
    case "wind":
      return "wind";
    case "tide":
      return "tide";
  }
}

/**
 * Get conservative daily recommendation based on conditions
 * 
 * Conservative strategy:
 * - Worth it: All factors optimal
 * - Maybe: No poor factors but at least one acceptable
 * - Skip: Any poor factor
 * 
 * @param conditions - Conditions analysis from analyzeConditions()
 * @returns Recommendation summary with decision, label, and reasons
 * 
 * @example
 * ```typescript
 * const recommendation = getConservativeRecommendation(conditions);
 * // Returns: { decision: 'worth_it', label: 'Worth it', reasons: ['all factors line up'] }
 * // or:      { decision: 'skip', label: 'Skip', reasons: ['wind', 'tide'] }
 * ```
 */
export function getConservativeRecommendation(
  conditions: ConditionsAnalysis
): MorningIntelRecommendationSummary {
  const statuses: Array<{ key: "swell" | "wind" | "tide"; status: ConditionEvaluation["status"] }> = [
    { key: "swell", status: conditions.swell.status },
    { key: "wind", status: conditions.wind.status },
    { key: "tide", status: conditions.tide.status },
  ];

  const poor = statuses.filter((s) => s.status === "poor").map((s) => humanizeFactorName(s.key));
  const acceptable = statuses
    .filter((s) => s.status === "acceptable")
    .map((s) => humanizeFactorName(s.key));

  if (poor.length > 0) {
    return {
      decision: "skip",
      label: "Skip",
      reasons: poor,
    };
  }

  if (acceptable.length === 0) {
    return {
      decision: "worth_it",
      label: "Worth it",
      reasons: ["all factors line up"],
    };
  }

  return {
    decision: "maybe",
    label: "Maybe",
    reasons: acceptable,
  };
}



