/**
 * Scoring Engine
 *
 * Orchestrates multiple scorer plugins to compute a composite score.
 *
 * Design principles:
 * - Plugins are weighted and normalized
 * - Any plugin can trigger a "skip" (disqualifying condition)
 * - Results are aggregated into a composite score
 * - Pure functional design - no side effects
 */

import type {
  ScorerInput,
  ScorerPlugin,
  ScorerResult,
  CompositeScore,
  MatchQuality,
  ScoringEngineConfig,
  ScoringDecisionEffect,
} from "./types";
import { DEFAULT_SCORING_CONFIG } from "./types";
import { waveHeightCeiling } from "./wave-height-ceiling";
import { windChopCeiling } from "./wind-chop-ceiling";

/**
 * Scoring engine that orchestrates multiple scorer plugins.
 */
export class ScoringEngine {
  private readonly scorers: ScorerPlugin[] = [];
  private readonly config: ScoringEngineConfig;

  constructor(config: Partial<ScoringEngineConfig> = {}) {
    this.config = { ...DEFAULT_SCORING_CONFIG, ...config };
  }

  /**
   * Register a scorer plugin.
   * Returns this for chaining.
   */
  register(scorer: ScorerPlugin): this {
    this.scorers.push(scorer);
    return this;
  }

  /**
   * Register multiple scorer plugins.
   */
  registerAll(scorers: ScorerPlugin[]): this {
    scorers.forEach((s) => this.register(s));
    return this;
  }

  /**
   * Get registered scorer names.
   */
  getScorerNames(): string[] {
    return this.scorers.map((s) => s.name);
  }

  /**
   * Run all scorers and compute composite score.
   */
  score(input: ScorerInput): CompositeScore {
    if (this.scorers.length === 0) {
      return this.createEmptyResult("No scorers registered");
    }

    const results: ScorerResult[] = [];

    // Run all scorers
    for (const scorer of this.scorers) {
      try {
        const result = scorer.score(input);
        results.push(result);

        // Early exit if any scorer triggers skip
        if (result.skip) {
          return this.createSkipResult(
            result.skipReason ?? "Conditions not favorable",
            results,
          );
        }
      } catch (error) {
        // Log error but continue with other scorers
        console.error(`Scorer ${scorer.name} threw error:`, error);
      }
    }

    // Aggregate results
    return this.aggregateResults(results, input);
  }

  /**
   * Aggregate individual scorer results into composite score.
   */
  private aggregateResults(
    results: ScorerResult[],
    input: ScorerInput,
  ): CompositeScore {
    // Filter out zero-weight results
    const weightedResults = results.filter((r) => r.weight > 0);

    if (weightedResults.length === 0) {
      return this.createEmptyResult("No weighted scores available");
    }

    // Normalize weights
    const totalWeight = weightedResults.reduce((sum, r) => sum + r.weight, 0);

    // Compute weighted average
    let weightedSum = 0;
    const subscores = new Map<string, number>();
    const allReasons: string[] = [];
    const allWarnings: string[] = [];
    const allEffects: ScoringDecisionEffect[] = [];

    for (const result of weightedResults) {
      const normalizedWeight = result.weight / totalWeight;
      weightedSum += result.score * normalizedWeight;
      subscores.set(result.name, result.score);
      allReasons.push(...result.reasons);
      allWarnings.push(...result.warnings);
      allEffects.push(...(result.effects ?? []));
    }

    const rawTotal = Math.round(weightedSum);

    // Apply post-composite quality ceilings. The underlying subscores remain
    // transparent, but the final band must not overstate marginal surf.
    const ceiling = waveHeightCeiling(input.snapshot.waveHeight);
    const chopCeiling = windChopCeiling(input, subscores);
    const effectCeiling = allEffects.reduce(
      (current, effect) => Math.min(current, effect.verdictCeiling ?? 100),
      100,
    );
    const total = Math.min(
      rawTotal,
      ceiling,
      chopCeiling?.ceiling ?? 100,
      effectCeiling,
    );

    if (ceiling < rawTotal) {
      const heightStr = Number.isFinite(input.snapshot.waveHeight)
        ? input.snapshot.waveHeight.toFixed(1)
        : "unknown";
      const capMessage = `Small wave (${heightStr}ft) caps score at ${ceiling}`;
      allReasons.push(capMessage);
      allWarnings.push(capMessage);
    }
    if (chopCeiling && chopCeiling.ceiling < rawTotal) {
      allReasons.push(chopCeiling.reason);
      allWarnings.push(chopCeiling.reason);
    }
    if (effectCeiling < rawTotal) {
      for (const effect of allEffects) {
        if (
          effect.verdictCeiling !== undefined &&
          effect.verdictCeiling < rawTotal &&
          !allWarnings.includes(effect.message)
        ) {
          allWarnings.push(effect.message);
        }
      }
    }

    const matchQuality = this.classifyScore(total);

    // Get confidence from input snapshot
    const confidence = input.snapshot.confidence;

    return {
      total,
      subscores,
      matchQuality,
      reasons: this.dedupeAndLimit(allReasons, this.config.maxReasons),
      warnings: this.dedupeAndLimit(allWarnings, this.config.maxReasons),
      skipReason: null,
      confidence,
      effects: dedupeEffects(allEffects),
    };
  }

  /**
   * Classify score into quality bucket.
   */
  private classifyScore(score: number): MatchQuality {
    const { qualityThresholds } = this.config;

    if (score >= qualityThresholds.perfect) return "perfect";
    if (score >= qualityThresholds.excellent) return "excellent";
    if (score >= qualityThresholds.good) return "good";
    if (score >= qualityThresholds.fair) return "fair";
    return "skip";
  }

  /**
   * Create result for skip condition.
   */
  private createSkipResult(
    reason: string,
    results: ScorerResult[],
  ): CompositeScore {
    const subscores = new Map<string, number>();
    results.forEach((r) => subscores.set(r.name, r.score));

    const allWarnings = results.flatMap((r) => r.warnings);

    return {
      total: 0,
      subscores,
      matchQuality: "skip",
      reasons: [],
      warnings: this.dedupeAndLimit(
        [reason, ...allWarnings],
        this.config.maxReasons,
      ),
      skipReason: reason,
      confidence: 0,
      effects: dedupeEffects(results.flatMap((result) => result.effects ?? [])),
    };
  }

  /**
   * Create empty result when no scoring possible.
   */
  private createEmptyResult(reason: string): CompositeScore {
    return {
      total: 0,
      subscores: new Map(),
      matchQuality: "skip",
      reasons: [],
      warnings: [reason],
      skipReason: reason,
      confidence: 0,
      effects: [],
    };
  }

  /**
   * Deduplicate and limit array of strings.
   */
  private dedupeAndLimit(items: string[], limit: number): string[] {
    const unique = [...new Set(items)];
    return unique.slice(0, limit);
  }
}

function dedupeEffects(
  effects: ScoringDecisionEffect[],
): ScoringDecisionEffect[] {
  const seen = new Set<string>();
  return effects.filter((effect) => {
    const key = `${effect.code}:${effect.message}:${effect.verdictCeiling ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Creates a pre-configured scoring engine with all standard scorers.
 * This is the main factory function for creating scoring engines.
 */
export function createScoringEngine(
  config?: Partial<ScoringEngineConfig>,
): ScoringEngine {
  return new ScoringEngine(config);
}

/**
 * Convenience function to score with a one-off engine.
 * Useful for testing or simple use cases.
 */
export function scoreWithPlugins(
  input: ScorerInput,
  plugins: ScorerPlugin[],
  config?: Partial<ScoringEngineConfig>,
): CompositeScore {
  const engine = createScoringEngine(config);
  engine.registerAll(plugins);
  return engine.score(input);
}
