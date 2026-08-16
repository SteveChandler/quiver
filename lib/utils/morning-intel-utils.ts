/**
 * Morning Intel Utilities
 * Helper functions for analyzing and formatting surf conditions
 *
 * NOTE: This file is being refactored into focused modules.
 * Formatting functions have been extracted to lib/formatters/intel-formatter.ts
 */

import { format, parseISO } from "date-fns";
import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz";
import type {
  SurfMetrics,
  TideMetrics,
  SwellComponent,
  WindMetrics,
  MorningIntelData,
  ForecastSlice,
  BeachPreferences,
  ConditionEvaluation,
  ConditionsAnalysis,
  MorningIntelRecommendationSummary,
} from "@/types/morning-intel";

// Re-export formatting functions for backward compatibility
export {
  getWaveHeightDescription,
  deriveSurfRange,
  renderIntelMarkdown,
} from "@/lib/formatters/intel-formatter";

// Re-export swell analysis functions for backward compatibility
export {
  primarySecondarySwell,
  analyzeSwellMatch,
  isAngleInWindow,
} from "@/lib/analyzers/swell-analyzer";

// Re-export wind analysis functions for backward compatibility
export {
  windAt,
  calculateOnOffshore,
} from "@/lib/analyzers/wind-analyzer";

// Re-export tide analysis functions for backward compatibility
export {
  tideAt,
  recommendTideWindow,
  type TideDirection,
} from "@/lib/analyzers/tide-analyzer";

// Re-export conditions analysis functions for backward compatibility
export {
  analyzeConditions,
  getConservativeRecommendation,
} from "@/lib/analyzers/conditions-analyzer";

// Re-export session window scoring functions for backward compatibility
export {
  findNextBestWindow,
  bestWindowHeuristic,
  confidenceHeuristic,
  type ForecastData as SessionForecastData,
  type SessionWindow,
} from "@/lib/scorers/session-window-scorer";

// Import for internal use in this module
import {
  primarySecondarySwell,
  analyzeSwellMatch,
} from "@/lib/analyzers/swell-analyzer";

import {
  windAt,
  calculateOnOffshore,
  analyzeWindConditions,
} from "@/lib/analyzers/wind-analyzer";

import {
  tideAt,
} from "@/lib/analyzers/tide-analyzer";

const FEET_TO_METERS = 0.3048;

// primarySecondarySwell function moved to lib/analyzers/swell-analyzer.ts

// windAt function moved to lib/analyzers/wind-analyzer.ts

// calculateOnOffshore function moved to lib/analyzers/wind-analyzer.ts

// degreesToCardinal function moved to lib/analyzers/wind-analyzer.ts

// bestWindowHeuristic function moved to lib/scorers/session-window-scorer.ts

// findNextBestWindow function moved to lib/scorers/session-window-scorer.ts

// confidenceHeuristic function moved to lib/scorers/session-window-scorer.ts

// isAngleInWindow function moved to lib/analyzers/swell-analyzer.ts

// analyzeSwellMatch function moved to lib/analyzers/swell-analyzer.ts

// analyzeWindConditions function moved to lib/analyzers/wind-analyzer.ts

// analyzeTideConditions function moved to lib/analyzers/conditions-analyzer.ts

// analyzeConditions function moved to lib/analyzers/conditions-analyzer.ts

// getConservativeRecommendation function moved to lib/analyzers/conditions-analyzer.ts

// Intel markdown rendering moved to IntelFormatter module
