// Backward-compatibility shim — all logic has moved to actions/intel/
// This file re-exports everything so existing imports still resolve.
export {
  createIntelPost,
  getNearbyIntelPosts,
  getPublicIntelPosts,
  getAllIntelPosts,
  confirmIntelPost,
  removeIntelPostConfirmation,
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
