/**
 * Morning Intel Utilities
 * Helper functions for analyzing and formatting surf conditions
 *
 * NOTE: This file is being refactored into focused modules.
 * Formatting functions have been extracted to lib/formatters/intel-formatter.ts
 */

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
export { windAt } from "@/lib/analyzers/wind-analyzer";

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
  confidenceHeuristic,
} from "@/lib/scorers/session-window-scorer";
