/**
 * Surf Discovery Service
 *
 * This module re-exports the surf discovery functionality for backward compatibility.
 * The main implementation has been moved to modular discovery services:
 *
 * - `discovery/surf-discovery-orchestrator.ts` - Main orchestration logic
 * - `discovery/candidate-pool-builder.ts` - Builds candidate beach pool
 * - `discovery/forecast-batch-fetcher.ts` - Fetches forecasts in parallel
 * - `discovery/window-selector.ts` - Selects best surf windows
 * - `discovery/response-formatter.ts` - Formats responses with photos/summaries
 *
 * @module lib/services/surf-discovery-service
 */

// Re-export main orchestrator functions
export {
  discoverSurfSpots,
  getBatchSunTimes,
  SurfDiscoveryOperationalError,
} from './discovery/surf-discovery-orchestrator';
export type {
  SurfDiscoveryOperationalErrorCode,
} from './discovery/surf-discovery-orchestrator';
