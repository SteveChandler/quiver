import { createClient } from "@/lib/supabase/client";

export type MinimalProfile = { id: string; onboarding_completed_at: string | null } | null;

/** Ensure a profile row exists for the given user id (idempotent). */
export async function ensureProfile(id: string): Promise<void> {
  const supabase = createClient();
  // Try to fetch existing profile
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (existing?.id) return;

  // Insert minimal row; rely on defaults for other columns
  await supabase.from("profiles").insert({ id }).select("id").maybeSingle();
}

/** Fetch minimal profile fields needed for onboarding visibility. */
export async function getProfileMinimal(id: string): Promise<MinimalProfile> {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,onboarding_completed_at")
    .eq("id", id)
    .maybeSingle();
  return (data as any) ?? null;
}

/** Mark onboarding as completed now (idempotent). */
export async function markOnboardingDone(id: string): Promise<void> {
  const supabase = createClient();
  // Use upsert to handle case where profile row doesn't exist yet
  await supabase
    .from("profiles")
    .upsert({ id, onboarding_completed_at: new Date().toISOString() }, { onConflict: "id" });
}


