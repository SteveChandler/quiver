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
        | "no_experience_level"
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
  "id, name, slug, lat, lon, timezone, wind_offshore_deg, wind_offshore_tol_deg, aspect_deg, preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction, swell_window_center_deg, swell_window_halfwidth_deg";

function pickPreset(level: ExperienceLevel): SeedPresetType | null {
  if (!level) return null;
  if (level === "advanced" || level === "expert") return "clean_groundswell";
  if (level === "beginner" || level === "intermediate") return "mellow_session";
  return null;
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
 * Idempotent — bails if the user already has any rule. Skips when
 * experience_level is null (we don't guess). Called from saveOnboardingData
 * after the profile update commits.
 */
export async function seedDefaultRuleForUser(
  params: SeedDefaultRuleParams
): Promise<SeedResult> {
  const { supabase, userId, beachId, experienceLevel, notifyEmail, notifyPush } =
    params;

  const presetType = pickPreset(experienceLevel);
  if (!presetType) {
    return { seeded: false, reason: "no_experience_level" };
  }

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
  };

  const preset = getPreset(presetType);
  // AlertConditions is a structural shape; the DB column is Json. Cast once
  // here so the insert payload typechecks cleanly.
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
