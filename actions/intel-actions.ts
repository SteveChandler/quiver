// Backward-compatibility shim — all logic has moved to actions/intel/
// This file re-exports everything so existing imports still resolve.
export {
  createIntelPost,
  getNearbyIntelPosts,
  getPublicIntelPosts,
  getAllIntelPosts,
  confirmIntelPost,
  removeIntelPostConfirmation,
  GLOBAL_INTEL_FALLBACK,
  FEET_TO_METERS,
  MPH_TO_METERS_PER_SECOND,
  INTEL_FALLBACK_ERROR_CODES,
  WIND_DIRECTION_DEGREES,
  toMetricWaveHeight,
  toMetricWindSpeed,
  toMetricWaterTemp,
  toWindDirectionDegreesFallback,
  parseNullableNumber,
  shouldFallbackToConditionReports,
} from "./intel";

export type {
  IntelPostsData,
  ConfirmationData,
  SupabaseErrorLike,
  IntelPostRPCResult,
  IntelDeps,
  TrackXPFn,
} from "./intel";
