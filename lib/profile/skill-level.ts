import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseSkillLevel,
  type SkillLevel,
} from "@/lib/domains/user-preferences/skill-level";
import type { Database } from "@/types/database.generated";

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
