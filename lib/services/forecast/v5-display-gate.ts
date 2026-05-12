import type { User } from "@supabase/supabase-js";
import {
  computeV5Shadow,
  getActiveCalibration,
  type CalibrationVersion,
} from "./calibration-v5";
import {
  formatDisplayHeightFt,
  parseDisplayHeightFt,
} from "./apply-beach-height-offset";
import { cardinalToDegrees } from "./forecast-transformer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { METERS_TO_FEET } from "@/lib/utils/unit-conversions";
import type { EnhancedForecastEntity } from "@/types/forecast";

type ForecastDisplayUser = Pick<User, "id" | "email">;

const V51_DISPLAY_USER_IDS = new Set([
  "73040cff-afe9-4fa0-a874-2016203fc015",
  "f0f4ffaa-5f9b-4fad-93a6-2d624d4cdabe",
  "58272d19-78c1-4197-9880-9b4053fe094f",
]);

const V51_DISPLAY_EMAILS = new Set([
  "omg.its.thefuture@gmail.com",
  "jakehumphrey18@gmail.com",
  "jakehumphrey@hey.com",
]);

export function isV51DisplayAllowlistedUser(
  user: ForecastDisplayUser | null | undefined
): boolean {
  if (!user) return false;
  if (user.id && V51_DISPLAY_USER_IDS.has(user.id)) return true;
  const email = user.email?.trim().toLowerCase();
  return !!email && V51_DISPLAY_EMAILS.has(email);
}

export async function isV51DisplayAllowlistedCurrentUser(): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) return false;
    return isV51DisplayAllowlistedUser(user);
  } catch {
    return false;
  }
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function primaryDirectionDeg(forecast: EnhancedForecastEntity): number | null {
  return (
    cardinalToDegrees(forecast.swell_1_direction) ??
    toFiniteNumber(forecast.wave_direction_om) ??
    toFiniteNumber(forecast.swell_direction_om) ??
    null
  );
}

function applyV51DisplayOverrideToForecast<T extends EnhancedForecastEntity>(
  forecast: T,
  calibration: CalibrationVersion
): T {
  const v5 = computeV5Shadow({
    wave_height_om_m: forecast.wave_height_om,
    primary_swell_direction_deg: primaryDirectionDeg(forecast),
    calibration,
  });

  if (!v5) return forecast;

  const parsedDisplay = parseDisplayHeightFt(forecast.wave_height);
  const waveHeight = formatDisplayHeightFt({
    numericFt: v5.v5_shadow_height_m * METERS_TO_FEET,
    rangeSpread: parsedDisplay.rangeSpread,
  });

  if (waveHeight === forecast.wave_height) return forecast;
  return { ...forecast, wave_height: waveHeight };
}

export async function applyV51DisplayOverrideToForecasts<
  T extends EnhancedForecastEntity,
>(
  forecasts: T[],
  options: {
    enabled: boolean;
    calibration?: CalibrationVersion | null;
  }
): Promise<T[]> {
  if (!options.enabled || forecasts.length === 0) return forecasts;

  const calibration =
    options.calibration === undefined
      ? await getActiveCalibration()
      : options.calibration;

  if (!calibration) return forecasts;

  return forecasts.map((forecast) =>
    applyV51DisplayOverrideToForecast(forecast, calibration)
  );
}

