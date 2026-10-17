/**
 * Shared Domain Utilities
 *
 * Re-exports all shared utilities for domains.
 */

export {  normalizeAngle, angleDifference, directionName } from './angle-utils';
export {
  DEFAULT_WIND_OFFSHORE_TOL_DEG,
  resolveOffshoreDeg,
  resolveOffshoreToleranceDeg,
  resolveWindOrientation,
  type WindOrientation,
  type WindOrientationSource,
} from './wind-orientation';
