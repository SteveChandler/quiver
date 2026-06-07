import type { Json, SupabaseServerClient } from "@/types/supabase";
import { getPreset } from "@/lib/alerts/presets";
import type { BeachAlertMeta } from "@/lib/alerts/types";

export type ExperienceLevel =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "expert"
  | null
  | undefined;

export type SeedPresetType = "mellow_session" | "clean_groundswell";

export type SeedResult =
  | { seeded: true; ruleId: string; presetType: SeedPresetType }
  | {
      seeded: false;
      reason:
        | "already_has_rules"
        | "beach_not_found"
        | "beach_missing_coordinates"
        | "error";
      error?: string;
    };

export interface SeedDefaultRuleParams {
  supabase: SupabaseServerClient;
  userId: string;
  beachId: string;
  experienceLevel: ExperienceLevel;
  notifyEmail: boolean;
  notifyPush: boolean;
}

// Fields required to build a BeachAlertMeta for preset conditions.
// Mirrors the BeachAlertMeta type in lib/alerts/types.ts.
const BEACH_META_COLUMNS =
  "id, name, slug, lat, lon, timezone, wind_offshore_deg, wind_offshore_tol_deg, aspect_deg, preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction, swell_window_center_deg, swell_window_halfwidth_deg, break_type, skill_level, features, preference_model";

function pickPreset(level: ExperienceLevel): SeedPresetType {
  if (level === "advanced" || level === "expert") return "clean_groundswell";
  // beginner, intermediate, null, undefined → safe default. We'd rather
  // over-notify a stronger surfer with mellow conditions than leave any
  // new user unreachable because experience_level wasn't captured.
  return "mellow_session";
}

function nameForPreset(preset: SeedPresetType): string {
  return preset === "clean_groundswell"
    ? "Clean groundswell at your home break"
    : "Mellow session at your home break";
}

/**
 * Seeds a single default alert rule on a user's home beach, tuned to their
 * experience level. Non-throwing: returns a structured result the caller logs.
 *
 * Idempotent — bails if the user already has any rule. Falls back to
 * mellow_session when experience_level is null/undefined so every new user
 * is reachable. Called from saveOnboardingData (web) and
 * /api/alerts/seed-default (native) after the profile update commits.
 */
export async function seedDefaultRuleForUser(
  params: SeedDefaultRuleParams,
): Promise<SeedResult> {
  const {
    supabase,
    userId,
    beachId,
    experienceLevel,
    notifyEmail,
    notifyPush,
  } = params;

  const presetType = pickPreset(experienceLevel);

  const { count, error: countError } = await supabase
    .from("alert_rules")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countError) {
    return { seeded: false, reason: "error", error: countError.message };
  }

  if ((count ?? 0) > 0) {
    return { seeded: false, reason: "already_has_rules" };
  }

  const { data: beachRow, error: beachError } = await supabase
    .from("beaches")
    .select(BEACH_META_COLUMNS)
    .eq("id", beachId)
    .maybeSingle();

  if (beachError) {
    return { seeded: false, reason: "error", error: beachError.message };
  }
  if (!beachRow) {
    return { seeded: false, reason: "beach_not_found" };
  }
  if (beachRow.lat == null || beachRow.lon == null) {
    return { seeded: false, reason: "beach_missing_coordinates" };
  }

  const beachMeta: BeachAlertMeta = {
    id: beachRow.id,
    name: beachRow.name,
    slug: beachRow.slug,
    lat: beachRow.lat,
    lon: beachRow.lon,
    timezone: beachRow.timezone ?? "America/Los_Angeles",
    wind_offshore_deg: beachRow.wind_offshore_deg,
    wind_offshore_tol_deg: beachRow.wind_offshore_tol_deg,
    aspect_deg: beachRow.aspect_deg,
    preferred_tide_ft_min: beachRow.preferred_tide_ft_min,
    preferred_tide_ft_max: beachRow.preferred_tide_ft_max,
    preferred_tide_direction: beachRow.preferred_tide_direction,
    swell_window_center_deg: beachRow.swell_window_center_deg,
    swell_window_halfwidth_deg: beachRow.swell_window_halfwidth_deg,
    break_type: beachRow.break_type ?? null,
    skill_level: beachRow.skill_level ?? null,
    features: beachRow.features ?? null,
    preference_model: beachRow.preference_model ?? null,
  };

  const preset = getPreset(presetType);
  const conditions = (preset ? preset.buildConditions(beachMeta) : {}) as Json;

  const { data: inserted, error: insertError } = await supabase
    .from("alert_rules")
    .insert({
      user_id: userId,
      beach_id: beachId,
      name: nameForPreset(presetType),
      preset_type: presetType,
      conditions,
      notify_email: notifyEmail,
      notify_push: notifyPush,
      enabled: true,
    })
    .select("id")
    .single();

  if (insertError) {
    return { seeded: false, reason: "error", error: insertError.message };
  }

  return { seeded: true, ruleId: inserted.id, presetType };
}
