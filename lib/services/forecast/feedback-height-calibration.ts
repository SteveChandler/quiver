import { createServiceRoleClient } from "@/lib/supabase";
import { createContextLogger } from "@/lib/logger";

const log = createContextLogger("FeedbackHeightCalibration");
const MAX_OFFSET_FT = 0.5;
const STALE_FORECAST_GRACE_MS = 2 * 60 * 60 * 1000;

export type FeedbackHeightCalibrationCandidate = {
  id: string;
  beach_id: string;
  status: "active_temp";
  offset_ft: number;
  sample_count: number;
  unique_user_count: number;
  activated_at: string;
  expires_at: string;
};

export type FeedbackHeightCalibrationResult = {
  heightFt: number;
  applied: boolean;
  candidateId: string | null;
  offsetFt: number | null;
};

export function isFeedbackHeightCalibrationEnabled(): boolean {
  return process.env.FEEDBACK_HEIGHT_CALIBRATION_ENABLED === "true";
}

export async function loadFeedbackHeightCalibrationForBeach(
  beachId: string,
  now: Date = new Date(),
): Promise<FeedbackHeightCalibrationCandidate | null> {
  if (!isFeedbackHeightCalibrationEnabled()) return null;

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("beach_feedback_calibration_candidates")
      .select(
        "id,beach_id,status,offset_ft,sample_count,unique_user_count,activated_at,expires_at",
      )
      .eq("beach_id", beachId)
      .eq("status", "active_temp")
      .gt("expires_at", now.toISOString())
      .limit(1)
      .maybeSingle();

    if (error) {
      log.warn("active feedback calibration lookup failed", {
        beachId,
        error: error.message,
        code: error.code,
      });
      return null;
    }
    if (!data) return null;
    return data as unknown as FeedbackHeightCalibrationCandidate;
  } catch (error) {
    log.warn("active feedback calibration lookup failed", {
      beachId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function applyFeedbackHeightCalibration(args: {
  heightFt: number;
  rawDisplayLabel: string | null | undefined;
  forecastAt: string | Date;
  candidate: FeedbackHeightCalibrationCandidate | null | undefined;
  enabled?: boolean;
  now?: Date;
}): FeedbackHeightCalibrationResult {
  const {
    heightFt,
    rawDisplayLabel,
    forecastAt,
    candidate,
    enabled = isFeedbackHeightCalibrationEnabled(),
    now = new Date(),
  } = args;
  const unchanged: FeedbackHeightCalibrationResult = {
    heightFt,
    applied: false,
    candidateId: null,
    offsetFt: null,
  };

  if (!enabled || !candidate || candidate.status !== "active_temp") {
    return unchanged;
  }
  if (!Number.isFinite(heightFt) || heightFt <= 0) return unchanged;
  if (rawDisplayLabel?.trim().toLowerCase() === "flat") return unchanged;

  const forecastTime =
    forecastAt instanceof Date ? forecastAt : new Date(forecastAt);
  if (!Number.isFinite(forecastTime.getTime())) return unchanged;
  if (forecastTime.getTime() < now.getTime() - STALE_FORECAST_GRACE_MS) {
    return unchanged;
  }

  const activatedAt = new Date(candidate.activated_at);
  const expiresAt = new Date(candidate.expires_at);
  if (
    !Number.isFinite(activatedAt.getTime()) ||
    !Number.isFinite(expiresAt.getTime()) ||
    activatedAt.getTime() > now.getTime() ||
    expiresAt.getTime() <= now.getTime()
  ) {
    return unchanged;
  }
  if (
    !Number.isFinite(candidate.offset_ft) ||
    Math.abs(candidate.offset_ft) > MAX_OFFSET_FT
  ) {
    return unchanged;
  }

  return {
    heightFt: Math.max(0, heightFt - candidate.offset_ft),
    applied: Math.abs(candidate.offset_ft) > 1e-9,
    candidateId:
      Math.abs(candidate.offset_ft) > 1e-9 ? candidate.id : null,
    offsetFt:
      Math.abs(candidate.offset_ft) > 1e-9 ? candidate.offset_ft : null,
  };
}
