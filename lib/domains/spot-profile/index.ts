/**
 * Spot Profile Domain
 *
 * Encapsulates beach characteristics for scoring.
 */

export type {
  SpotProfile,
  SwellWindow,
  WindThresholds,
  TidePreferences,
  SkillLevel,
} from './types';

export { SPOT_PROFILE_DEFAULTS } from './types';

export {
  createSpotProfile,
  angularDifference,
  isDirectionInWindow,
  calculateWindowAlignment,
} from './spot-profile';
