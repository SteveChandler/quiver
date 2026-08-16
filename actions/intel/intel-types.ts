import type { IntelPostTag, IntelPostWithUser } from "@/types/database";
import type { XPTrackingResult } from "@/lib/gamification/types";
import type { XPAction } from "@/lib/gamification";
import type { withAuthenticatedAction } from "@/lib/server-action-utils";
import { FEET_TO_METERS } from "@/lib/utils/unit-conversions";

export { FEET_TO_METERS };

// Result types for intel actions
export interface IntelPostsData {
  posts: IntelPostWithUser[];
  total: number;
  filters: {
    lat?: number;
    lon?: number;
    radius?: number;
    tag: string;
    limit: number;
  };
}

export interface ConfirmationData {
  confirmed: boolean;
  confirmations_count: number;
  /**
   * Semantic note: after the voting migration, `confirmation_id` is actually
   * the `intel_votes.id` for the user's `confirmed` vote, not a row from
   * the legacy `intel_post_confirmations` table. Existing callers rely on
   * the field name for backward-compat.
   */
  confirmation_id: string;
}

export type IntelVoteType = 'helpful' | 'off' | 'confirmed';

export interface VoteData {
  vote_type: IntelVoteType | null;
  helpful_count: number;
  off_count: number;
  confirmed_count: number;
}

export interface SupabaseErrorLike {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

export interface IntelPostRPCResult {
  id: string;
  user_id: string;
  beach_id: string;
  latitude: number;
  longitude: number;
  tag: IntelPostTag;
  title: string;
  description: string;
  photo_url: string;
  is_active: boolean;
  expires_at: string;
  created_at: string;
  updated_at: string;
  confirmations_count: number;
  helpful_count: number;
  off_count: number;
  confirmed_count: number;
  rank_score: number;
  beach_name: string;
  distance_miles: number;
  user_name: string;
  surf_conditions: import("@/types/database.generated").Json | null;
  vibe: string | null;
  wave_size_range: string | null;
  session_id?: string | null;
}

export type TrackXPFn = (
  action: XPAction,
  relatedEntityId?: string,
  relatedEntityType?: "session" | "board" | "intel_post" | "review" | "invite" | "photo"
) => Promise<XPTrackingResult>;

export interface IntelDeps {
  trackXP?: TrackXPFn;
  authWrapper?: typeof withAuthenticatedAction;
}

export const GLOBAL_INTEL_FALLBACK = {
  lat: 32.7507, // Ocean Beach, San Diego acts as seeded demo hub
  lon: -117.254,
  radius: 400,
};

export const MPH_TO_METERS_PER_SECOND = 0.44704;

export const INTEL_FALLBACK_ERROR_CODES = new Set(["0A000", "42P01", "42501", "42703"]);

export const WIND_DIRECTION_DEGREES: Record<string, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
  OFFSHORE: 180,
  ONSHORE: 0,
  CROSS: 90,
};

export const toMetricWaveHeight = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Number((value * FEET_TO_METERS).toFixed(3));
};

export const toMetricWindSpeed = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Number((value * MPH_TO_METERS_PER_SECOND).toFixed(3));
};

export const toMetricWaterTemp = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Number((((value - 32) * 5) / 9).toFixed(3));
};

export const toWindDirectionDegreesFallback = (direction?: string | null) => {
  if (!direction) return null;
  const key = direction.toUpperCase();
  return WIND_DIRECTION_DEGREES[key] ?? null;
};

export const parseNullableNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export const shouldFallbackToConditionReports = (error: SupabaseErrorLike | null): boolean => {
  if (!error) return false;
  const code = typeof error.code === "string" ? error.code : undefined;
  if (code && INTEL_FALLBACK_ERROR_CODES.has(code)) return true;

  const message = [error.message, error.details, error.hint]
    .filter(Boolean)
    .map((part) => String(part).toLowerCase())
    .join(" ");

  return (
    message.includes("condition_reports") ||
    message.includes("cannot insert into view") ||
    message.includes("intel_posts")
  );
};
