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
  isDirectionInWindow,
  calculateWindowAlignment,
} from './spot-profile';

export { deriveWavePunchiness } from './wave-punchiness';
export type { WavePunchinessInputs } from './wave-punchiness';
