import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileDTO } from "@/types/profile";

export type ProfileWithHomeBeach = {
  id: string;
  full_name: string | null;
  home_beach_id: string | null;
  home_beach?: { id: string; name: string } | null;
};

export async function getProfileWithHomeBeachById(userId: string, client?: any) {
  const supabase = client || (await createSupabaseServerClient());

  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      id,
      full_name,
      home_beach_id,
      home_beach:beaches!profiles_home_beach_id_fkey ( id, name )
    `
    )
    .eq("id", userId)
    .single();

  if (error) throw error;

  const result: ProfileWithHomeBeach = {
    id: data.id,
    full_name: (data as any).full_name ?? null,
    home_beach_id: (data as any).home_beach_id ?? null,
    home_beach: (data as any).home_beach ?? null,
  };

  return { profile: result, homeBeachName: result.home_beach?.name ?? null };
}

function toProfileDTO(profile: ProfileWithHomeBeach, homeBeachName: string | null): ProfileDTO {
  return {
    id: profile.id,
    full_name: profile.full_name ?? null,
    home_beach_id: profile.home_beach_id ?? null,
    homeBeachName,
    home_beach: profile.home_beach ?? null,
  };
}

export async function getProfileDTOById(userId: string, client?: any): Promise<ProfileDTO | null> {
  const supabase = client || (await createSupabaseServerClient());
  const { data, error } = await supabase
    .from("profiles_with_home_beach")
    .select("id, full_name, home_beach_id, home_beach_name, experience_level, created_at, updated_at, onboarding_completed_at")
    .eq("id", userId)
    .single();

  if (error) throw error;

  return {
    id: data.id,
    full_name: (data as any).full_name ?? null,
    home_beach_id: (data as any).home_beach_id ?? null,
    homeBeachName: (data as any).home_beach_name ?? null,
    experience_level: (data as any).experience_level ?? null,
    created_at: (data as any).created_at ?? null,
    updated_at: (data as any).updated_at ?? null,
    onboarding_completed_at: (data as any).onboarding_completed_at ?? null,
  } as ProfileDTO;
}


