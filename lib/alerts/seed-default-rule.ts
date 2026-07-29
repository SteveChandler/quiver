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
export type SeedSchedulePresetType =
  | "dawn_patrol"
  | "after_work"
  | "weekend_warrior";

type SeedRulePresetType = SeedPresetType | SeedSchedulePresetType;

type SeededRule = {
  ruleId: string;
  presetType: string;
};

export type SeedResult =
  | { seeded: true; rules: SeededRule[] }
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
  preferredTimeBucket: string | null;
  notifyEmail: boolean;
  notifyPush: boolean;
  // Whether `beachId` is the user's home break. Defaults to true so existing
  // callers (web onboarding, native with no override) keep seeding "at your
  // home break" rules unchanged. Set false when `beachId` targets a
  // different beach (e.g. a recommended nearby break) so rule names credit
  // the actual beach instead.
  isHomeBeach?: boolean;
}

// Fields required to build a BeachAlertMeta for preset conditions.
// Mirrors the BeachAlertMeta type in lib/alerts/types.ts.
const BEACH_META_COLUMNS =
  "id, name, slug, lat, lon, timezone, wind_offshore_deg, wind_offshore_tol_deg, aspect_deg, preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction, swell_window_center_deg, swell_window_halfwidth_deg, break_type, skill_level, features, preference_model, wind_onshore_bad_kt";

function pickPreset(level: ExperienceLevel): SeedPresetType {
  if (level === "advanced" || level === "expert") return "clean_groundswell";
  // beginner, intermediate, null, undefined → safe default. We'd rather
  // over-notify a stronger surfer with mellow conditions than leave any
  // new user unreachable because experience_level wasn't captured.
  return "mellow_session";
}

function pickSchedulePreset(
  bucket: string | null | undefined,
): SeedSchedulePresetType {
  const normalized = (bucket ?? "").toLowerCase();
  if (normalized.includes("dawn") || normalized.includes("morning")) {
    return "dawn_patrol";
  }
  if (normalized.includes("even") || normalized.includes("after")) {
    return "after_work";
  }
  return "weekend_warrior";
}

function nameForPreset(preset: SeedRulePresetType, location: string): string {
  switch (preset) {
    case "clean_groundswell":
      return `Clean groundswell at ${location}`;
    case "dawn_patrol":
      return `Dawn patrol at ${location}`;
    case "after_work":
      return `After-work windows at ${location}`;
    case "weekend_warrior":
      return `Weekend windows at ${location}`;
    case "mellow_session":
      return `Mellow session at ${location}`;
  }
}

/**
 * Seeds default alert rules on `beachId` — the user's home beach, or an
 * explicit override (e.g. onboarding recommends a nearby break) — tuned to
 * their experience level and schedule preference. Non-throwing: returns a
 * structured result the caller logs.
 *
 * `isHomeBeach` (defaults true) controls rule naming: home-beach rules read
 * "... at your home break"; non-home rules are named after `beachId`'s
 * actual beach name instead.
 *
 * Idempotent — bails if the user already has any rule. Falls back to
 * mellow_session when experience_level is null/undefined so every new user
 * is reachable. Called from saveOnboardingData (web) and
 * /api/alerts/seed-default (native) after the profile update commits.
 */
export async function seedDefaultRulesForUser(
  params: SeedDefaultRuleParams,
): Promise<SeedResult> {
  const {
    supabase,
    userId,
    beachId,
    experienceLevel,
    preferredTimeBucket,
    notifyEmail,
    notifyPush,
    isHomeBeach = true,
  } = params;

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
    max_wind_any_mph: null,
    max_wind_onshore_mph:
      beachRow.wind_onshore_bad_kt == null
        ? null
        : Math.round(beachRow.wind_onshore_bad_kt / 0.868976),
  };

  const seedSpecs = [
    { presetType: pickPreset(experienceLevel) },
    { presetType: pickSchedulePreset(preferredTimeBucket) },
  ].filter(
    (spec, index, specs) =>
      specs.findIndex((candidate) => candidate.presetType === spec.presetType) ===
      index,
  );

  const location = isHomeBeach ? "your home break" : beachMeta.name;

  const { data: inserted, error: insertError } = await supabase
    .from("alert_rules")
    .insert(
      seedSpecs.map(({ presetType }) => {
        const preset = getPreset(presetType);
        const conditions = (
          preset ? preset.buildConditions(beachMeta) : {}
        ) as Json;

        return {
          user_id: userId,
          beach_id: beachId,
          name: nameForPreset(presetType, location),
          preset_type: presetType,
          conditions,
          notify_email: notifyEmail,
          notify_push: notifyPush,
          enabled: true,
        };
      }),
    )
    .select("id, preset_type");

  if (insertError) {
    return { seeded: false, reason: "error", error: insertError.message };
  }

  return {
    seeded: true,
    rules: (inserted ?? []).map((rule) => ({
      ruleId: rule.id,
      presetType: rule.preset_type as string,
    })),
  };
}
