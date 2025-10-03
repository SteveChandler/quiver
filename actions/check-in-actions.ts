"use server";

import { withAuthenticatedAction, makeAuthenticatedAction } from "@/lib/server-action-utils";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import {
  CheckIn,
  CheckInWithUser,
  ForecastAccuracyStats,
} from "@/types/database";

const FEET_TO_METERS = 0.3048;
const MPH_TO_METERS_PER_SECOND = 0.44704;

const LEGACY_FALLBACK_CODES = new Set(["42P01", "42501", "42703"]);

function round(value: number, precision = 2) {
  const factor = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
}

function convertNullable(
  value: number | null | undefined,
  converter: (input: number) => number
) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  return converter(value);
}

const WIND_DIRECTION_DEGREES: Record<string, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

function toWindDirectionDegrees(direction?: string | null) {
  if (!direction) return null;
  const key = direction.toUpperCase();
  return WIND_DIRECTION_DEGREES[key] ?? null;
}

function parseNullableNumber(value: any) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Submit a new surf condition check-in
 */
type SubmitCheckInInput = {
  wave_height?: number | null;
  wind_speed?: number | null;
  wind_direction?: string | null;
  water_temp?: number | null;
  crowd_level?: number | null;
  vibe?: string | null;
  forecast_accuracy_rating: "accurate" | "somewhat" | "inaccurate";
};

const normalizeWaveHeightMeters = (value: number | null) =>
  convertNullable(value, (feet) => round(feet * FEET_TO_METERS, 3));

const normalizeWindSpeedMs = (value: number | null) =>
  convertNullable(value, (mph) => round(mph * MPH_TO_METERS_PER_SECOND, 3));

const normalizeWaterTempCelsius = (value: number | null) =>
  convertNullable(value, (fahrenheit) => round(((fahrenheit - 32) * 5) / 9, 3));

function shouldFallbackToLegacy(error: any) {
  if (!error) return false;

  const code = typeof error.code === "string" ? error.code : undefined;
  if (code && LEGACY_FALLBACK_CODES.has(code)) {
    return true;
  }

  const message = [error.message, error.details, error.hint]
    .filter(Boolean)
    .map((part) => String(part).toLowerCase())
    .join(" ");

  return message.includes("condition_reports") || message.includes("relation") || message.includes("permission");
}

function buildLegacyCheckInPayload(
  userId: string,
  beachId: string,
  data: SubmitCheckInInput
) {
  return {
    beach_id: beachId,
    user_id: userId,
    checked_in_at: new Date().toISOString(),
    wave_height: parseNullableNumber(data.wave_height),
    wind_speed: parseNullableNumber(data.wind_speed),
    wind_direction: data.wind_direction ?? null,
    water_temp: parseNullableNumber(data.water_temp),
    crowd_level: parseNullableNumber(data.crowd_level),
    vibe: data.vibe ?? null,
    forecast_accuracy_rating: data.forecast_accuracy_rating,
  };
}

async function fetchCheckInWithUser(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  id: string
) {
  const { data, error } = await supabase
    .from("check_ins")
    .select(
      `
      *,
      profiles:user_id (
        username,
        profile_picture_url
      )
    `
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new Error("Failed to load submitted check-in");
  }

  return {
    ...data,
    user: {
      username: data.profiles?.username || null,
      profile_picture_url: data.profiles?.profile_picture_url || null,
    },
  } as CheckInWithUser;
}

export const submitCheckIn = makeAuthenticatedAction(
  async (
    user,
    supabase,
    beachId: string,
    data: SubmitCheckInInput
  ) => {
    try {
      if (!beachId) {
        throw new Error("Beach ID is required");
      }

      if (!data.forecast_accuracy_rating) {
        throw new Error("Forecast accuracy rating is required");
      }

      const { error: beachError } = await supabase
        .from("beaches")
        .select("id")
        .eq("id", beachId)
        .single();

      if (beachError) {
        throw new Error("Beach not found");
      }

      const insertPayload = {
        beach_id: beachId,
        reporter_id: user.id,
        reported_at: new Date().toISOString(),
        kind: "check_in",
        wave_height_m: normalizeWaveHeightMeters(data.wave_height ?? null),
        wind_speed_ms: normalizeWindSpeedMs(data.wind_speed ?? null),
        wind_direction_deg: toWindDirectionDegrees(data.wind_direction),
        water_temp_c: normalizeWaterTempCelsius(data.water_temp ?? null),
        crowd_level: parseNullableNumber(data.crowd_level),
        vibe: data.vibe ?? null,
        forecast_accuracy: data.forecast_accuracy_rating,
      };

      const { data: report, error } = await supabase
        .from("condition_reports")
        .insert(insertPayload)
        .select()
        .single();

      let createdId = report?.id as string | undefined;
      let conditionReportsError = error;

      if (!createdId && shouldFallbackToLegacy(error)) {
        console.warn(
          "condition_reports insert failed, attempting legacy check_ins fallback",
          error
        );

        const legacyPayload = buildLegacyCheckInPayload(user.id, beachId, data);
        const { data: legacyCheckIn, error: legacyError } = await supabase
          .from("check_ins")
          .insert(legacyPayload)
          .select()
          .single();

        if (legacyError || !legacyCheckIn) {
          console.error(
            "Legacy check_in fallback failed:",
            legacyError || conditionReportsError
          );
          throw new Error("Failed to submit check-in");
        }

        createdId = legacyCheckIn.id as string;
        conditionReportsError = null;
      }

      if (!createdId) {
        console.error("Error submitting condition report:", conditionReportsError);
        throw new Error("Failed to submit check-in");
      }

      const checkIn = await fetchCheckInWithUser(supabase, createdId);
      return checkIn;
    } catch (error) {
      console.error("Error submitting check-in:", error);
      throw error;
    }
  }
);

/**
 * Get recent check-ins for a beach
 */
export async function getRecentCheckIns(
  beachId: string,
  hoursBack: number = 24,
  limitCount: number = 10
): Promise<CheckInWithUser[]> {
  const supabase = createAPIServerClient();

  // Use the database function for optimized query
  const { data, error } = await supabase.rpc("get_recent_check_ins", {
    beach_uuid: beachId,
    hours_back: hoursBack,
    limit_count: limitCount,
  });

  if (error) {
    console.error("Error fetching recent check-ins:", error);
    throw new Error("Failed to fetch recent check-ins");
  }

  return data || [];
}

/**
 * Get forecast accuracy statistics for a beach
 */
export async function getForecastAccuracyStats(
  beachId: string,
  daysBack: number = 7
): Promise<ForecastAccuracyStats> {
  const supabase = createAPIServerClient();

  // Use the database function for optimized query
  const { data, error } = await supabase.rpc("get_forecast_accuracy_stats", {
    beach_uuid: beachId,
    days_back: daysBack,
  });

  if (error) {
    console.error("Error fetching forecast accuracy stats:", error);
    throw new Error("Failed to fetch forecast accuracy stats");
  }

  // Return first result or default empty stats
  const stats = data?.[0];
  return {
    total_reports: stats?.total_reports || 0,
    accurate_count: stats?.accurate_count || 0,
    somewhat_count: stats?.somewhat_count || 0,
    inaccurate_count: stats?.inaccurate_count || 0,
    accuracy_percentage: stats?.accuracy_percentage || 0,
  };
}

/**
 * Update an existing check-in (user can only update their own)
 */
export const updateCheckIn = makeAuthenticatedAction(
  async (
    user,
    supabase,
    checkInId: string,
    data: Partial<{
      wave_height: number | null;
      wind_speed: number | null;
      wind_direction: string | null;
      water_temp: number | null;
      crowd_level: number | null;
      vibe: string | null;
      forecast_accuracy_rating: "accurate" | "somewhat" | "inaccurate";
    }>
  ) => {

    // Update check-in (RLS ensures user can only update their own)
    const { data: checkIn, error } = await supabase
      .from("check_ins")
      .update(data)
      .eq("id", checkInId)
      .eq("user_id", user.id) // Extra safety check
      .select()
      .single();

    if (error) {
      console.error("Error updating check-in:", error);
      throw new Error("Failed to update check-in");
    }

    if (!checkIn) {
      throw new Error("Check-in not found or access denied");
    }

    return checkIn;
  }
);

/**
 * Delete a check-in (user can only delete their own)
 */
export const deleteCheckIn = makeAuthenticatedAction(
  async (user, supabase, checkInId: string) => {

    // Delete check-in (RLS ensures user can only delete their own)
    const { error } = await supabase
      .from("check_ins")
      .delete()
      .eq("id", checkInId)
      .eq("user_id", user.id); // Extra safety check

    if (error) {
      console.error("Error deleting check-in:", error);
      throw new Error("Failed to delete check-in");
    }

    return { success: true };
  }
);

/**
 * Get check-ins by user (for profile/history view)
 */
export async function getUserCheckIns(
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<CheckIn[]> {
  const supabase = createAPIServerClient();

  const { data, error } = await supabase
    .from("check_ins")
    .select(
      `
      *,
      beaches:beach_id (
        name,
        location_text:location
      )
    `
    )
    .eq("user_id", userId)
    .order("checked_in_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching user check-ins:", error);
    throw new Error("Failed to fetch user check-ins");
  }

  return data || [];
}

/**
 * Get all check-ins for a beach with pagination
 */
export async function getBeachCheckIns(
  beachId: string,
  limit: number = 20,
  offset: number = 0
): Promise<CheckInWithUser[]> {
  const supabase = createAPIServerClient();

  const { data, error } = await supabase
    .from("check_ins")
    .select(
      `
      *,
      profiles:user_id (
        username,
        profile_picture_url
      )
    `
    )
    .eq("beach_id", beachId)
    .order("checked_in_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching beach check-ins:", error);
    throw new Error("Failed to fetch beach check-ins");
  }

  // Transform data to match CheckInWithUser type
  return (data || []).map((item) => ({
    ...item,
    user: {
      username: item.profiles?.username || null,
      profile_picture_url: item.profiles?.profile_picture_url || null,
    },
  }));
}
