import { createHash } from "node:crypto";

export type AndroidWaitlistSourceKind =
  | "anonymous_lead"
  | "profile_intent"
  | "roster_evidence";

interface AndroidWaitlistClient {
  rpc(
    name: "resolve_android_waitlist_entry",
    args: Record<string, unknown>,
  ): PromiseLike<{
    data: unknown;
    error: { message?: string } | null;
  }>;
}

interface ResolveCanonicalAndroidWaitlistInput {
  userId: string | null;
  email: string | null;
  rosterEntryId: string | null;
  sourceKind: AndroidWaitlistSourceKind;
  sourceId: string;
  source: string;
  surface: string;
  placement: string;
  observedAt: string;
}

export function normalizedEmailSha256(email: string): string {
  return createHash("sha256")
    .update(email.trim().toLowerCase(), "utf8")
    .digest("hex");
}

export async function resolveCanonicalAndroidWaitlist(
  client: AndroidWaitlistClient,
  input: ResolveCanonicalAndroidWaitlistInput,
): Promise<string> {
  const { data, error } = await client.rpc("resolve_android_waitlist_entry", {
    p_user_id: input.userId,
    p_normalized_email_sha256: input.email
      ? normalizedEmailSha256(input.email)
      : null,
    p_roster_entry_id: input.rosterEntryId,
    p_source_kind: input.sourceKind,
    p_source_id: input.sourceId,
    p_source: input.source,
    p_surface: input.surface,
    p_placement: input.placement,
    p_observed_at: input.observedAt,
  });

  if (error || typeof data !== "string" || data.length === 0) {
    throw new Error("Canonical Android waitlist resolver unavailable");
  }

  return data;
}
