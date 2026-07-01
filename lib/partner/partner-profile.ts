import type { createSupabaseServerClient } from "@/lib/supabase/server";

export interface ResolvedPartner {
  id: string;
  name: string | null;
}

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export async function fetchPartnerByReferralCode(
  supabase: SupabaseServerClient,
  code: string,
): Promise<ResolvedPartner | null> {
  // Partner === a user whose referral_code is printed on the QR. Best-effort:
  // an unknown code still renders the public landing/flyer.
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, full_name, avatar_url")
    .eq("referral_code", code)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.display_name || data.full_name || null,
  };
}
