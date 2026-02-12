// Barrel re-exports for backward compatibility
// Allows: import { createIntelPost } from "@/actions/intel"
// All types and functions that were previously exported from intel-actions.ts

export type {
  IntelPostsData,
  ConfirmationData,
  SupabaseErrorLike,
  IntelPostRPCResult,
  IntelDeps,
  TrackXPFn,
} from "./intel-types";

export {
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
} from "./intel-types";

export { createIntelPost } from "./intel-create-actions";

export {
  getNearbyIntelPosts,
  getPublicIntelPosts,
  getAllIntelPosts,
} from "./intel-query-actions";

export {
  confirmIntelPost,
  removeIntelPostConfirmation,
} from "./intel-confirm-actions";
