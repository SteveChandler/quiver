/**
 * Scoring Engine Singleton
 *
 * Manages the singleton instance of the discovery scoring engine.
 * Lazy initialization ensures the engine is only created when needed.
 *
 * @module lib/services/discovery/window-selector/scoring-engine-singleton
 */

import {
  createDiscoveryScoringEngine,
} from '@/lib/domains/scoring';
import type { ScoringEngine } from '@/lib/domains/scoring';

// Singleton scoring engine instance (lazy initialized)
let _scoringEngine: ScoringEngine | null = null;

/**
 * Get the singleton scoring engine instance.
 * Creates the engine on first call (lazy initialization).
 *
 * @returns The discovery scoring engine instance
 */
export function getScoringEngine(): ScoringEngine {
  if (!_scoringEngine) {
    _scoringEngine = createDiscoveryScoringEngine();
  }
  return _scoringEngine;
}

/**
 * Reset the singleton scoring engine instance.
 * Used in tests to ensure isolation between test suites.
 */
function resetScoringEngine(): void {
  _scoringEngine = null;
}
