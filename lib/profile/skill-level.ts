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
