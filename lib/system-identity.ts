import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.generated";

/**
 * The one profile automated posters may use. The profile UUID is immutable;
 * the display name is retained only for diagnostics and is not a lookup key.
 */
export const SYSTEM_IDENTITY = {
  profileId: "3290f65d-b474-49e2-ac5e-27de2db3fc9e",
  displayName: "Quiver Surf Forecast",
} as const;

type IdentityProfile = {
  id?: string | null;
  is_system_account?: boolean | null;
};

type IdentityPost = {
  user_id?: string | null;
  profile?: IdentityProfile | null;
  profiles?: IdentityProfile | null;
  user?: IdentityProfile | null;
};

export type SystemAuthoredRecord = IdentityProfile & IdentityPost;

type IdentityClient = Pick<SupabaseClient<Database>, "from">;

/**
 * Resolves the canonical automated-poster profile or throws. Callers must
 * handle the error before creating any automated content.
 */
export async function resolveSystemIdentity(client: IdentityClient): Promise<string> {
  const { data, error } = await client
    .from("profiles")
    .select("id")
    .eq("id", SYSTEM_IDENTITY.profileId)
    .eq("is_system_account", true)
    .limit(1)
    .single();

  if (error || !data || data.id !== SYSTEM_IDENTITY.profileId) {
    const reason = error?.message ?? "canonical profile was not returned";
    throw new Error(`Unable to resolve system identity: ${reason}`);
  }

  return data.id;
}

/** Returns whether a profile or post was authored by a system identity. */
export function isSystemAuthored(
  record: SystemAuthoredRecord | null | undefined
): boolean {
  if (!record) return false;

  const isPost =
    record.user_id !== undefined ||
    record.profile !== undefined ||
    record.profiles !== undefined ||
    record.user !== undefined;

  if (!isPost) {
    return record.is_system_account === true || record.id === SYSTEM_IDENTITY.profileId;
  }

  if (record.user_id === SYSTEM_IDENTITY.profileId) return true;

  return [record.profile, record.profiles, record.user].some(
    (profile) =>
      profile?.is_system_account === true || profile?.id === SYSTEM_IDENTITY.profileId
  );
}
