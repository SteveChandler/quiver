import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseSkillLevel,
  type SkillLevel,
} from "@/lib/domains/user-preferences/skill-level";
import type { Database } from "@/types/database.generated";

/**
 * Resolve the authenticated user's experience level from a verified session.
 *
 * Auth failures, missing users, and profile lookup errors all collapse to
 * nulls so personalized routes degrade to the anonymous experience instead
 * of erroring.
 */
export async function getVerifiedProfileExperience(
  supabase: SupabaseClient<Database>
): Promise<{ userId: string | null; profileExperience: SkillLevel | null }> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return { userId: null, profileExperience: null };
    }
    return {
      userId: user.id,
      profileExperience: await getProfileExperienceLevel(supabase, user.id),
    };
  } catch {
    return { userId: null, profileExperience: null };
  }
}

export async function getProfileExperienceLevel(
  supabase: SupabaseClient<Database>,
  userId: string | null | undefined
): Promise<SkillLevel | null> {
  if (!userId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("experience_level")
    .eq("id", userId)
    .maybeSingle();

  if (error) return null;

  return parseSkillLevel(data?.experience_level);
}

type ProfileSkillRead = { ok: true; level: SkillLevel | null; blank: boolean } | { ok: false };

/**
 * Read the profile skill and say whether it is blank, so a caller can tell a
 * user with no level from a failed read.
 */
export async function readProfileSkill(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ProfileSkillRead> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("experience_level")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) return { ok: false };

    const raw = data.experience_level;
    return {
      ok: true,
      level: parseSkillLevel(raw),
      blank: raw === null || raw.trim() === "",
    };
  } catch {
    return { ok: false };
  }
}
