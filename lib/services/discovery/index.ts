/**
 * Discovery Services
 *
 * Barrel export for surf discovery related services.
 *
 * @module lib/services/discovery
 */

// Orchestrator (main entry point)
export {

  getBatchSunTimes,
} from './surf-discovery-orchestrator';

// Candidate Pool Builder

// Pre-forecast preference fit used to order the candidate pool

// Distance friction

// Forecast Batch Fetcher

// Window Selector
export {
  selectBestWindow,
  capEndTimeToTimeSlot,




} from './window-selector';

// Window authority (one selector run per beach and day). Consumers that need
// the ruler or the daypart helpers import './window-authority' directly.
export {
  selectBeachDayWindows,
  type AuthoritativeWindow,
} from './window-authority';

// Response Formatter

// Personalization Layer (batch personalization, avoids N+1 per-beach queries)
