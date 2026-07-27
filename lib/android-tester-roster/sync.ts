import {
  decryptTesterIdentity,
  encryptTesterIdentity,
  type TesterIdentityEnvelope,
} from "./crypto";
import {
  fetchGoogleGroupMembers,
  type GoogleDirectoryConfig,
} from "./google-directory";
import {
  reconcileRosterSnapshot,
  type DirectoryRosterSnapshot,
  type ExistingRosterIdentity,
  type RosterObservation,
} from "./reconciliation";
import {
  loadActiveTesterIdentityKey,
  loadTesterIdentityKey,
} from "./keys";

interface SyncClient {
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<{ data: any; error: { message?: string } | null }>;
  auth?: {
    admin: {
      getUserById(userId: string): Promise<{
        data: { user: { email?: string | null } | null };
        error: { message?: string } | null;
      }>;
    };
  };
}

interface SyncIdentityRow {
  entry_id: string;
  user_id: string | null;
  eligibility_status: "eligible" | "ineligible";
  purge_after: string | null;
  key_version: number | null;
  iv: string | null;
  ciphertext: string | null;
  auth_tag: string | null;
}

export function loadGoogleDirectoryConfig(): GoogleDirectoryConfig {
  return {
    groupKey: process.env.ANDROID_TESTER_ROSTER_GOOGLE_GROUP_KEY ?? "",
    delegatedSubject:
      process.env.ANDROID_TESTER_ROSTER_GOOGLE_DELEGATED_SUBJECT ?? "",
    clientEmail:
      process.env.ANDROID_TESTER_ROSTER_GOOGLE_CLIENT_EMAIL ?? "",
    privateKey: (
      process.env.ANDROID_TESTER_ROSTER_GOOGLE_PRIVATE_KEY ?? ""
    ).replace(/\\n/g, "\n"),
  };
}

async function applyIncompleteRun({
  actorUserId,
  claimToken,
  now,
  supabase,
  failureCode,
}: {
  actorUserId: string | null;
  claimToken: string;
  now: string;
  supabase: SyncClient;
  failureCode: string;
}): Promise<{ complete: false }> {
  const { error } = await supabase.rpc(
    "apply_android_tester_roster_snapshot",
    {
      p_actor_user_id: actorUserId,
      p_claim_token: claimToken,
      p_snapshot_complete: false,
      p_observed_at: now,
      p_observations: [],
      p_direct_user_count: 0,
      p_failure_code: failureCode,
    },
  );
  if (error) {
    await releaseSyncClaim(supabase, claimToken);
    throw new Error("Android tester roster sync persistence unavailable");
  }
  return { complete: false };
}

async function releaseSyncClaim(
  supabase: SyncClient,
  claimToken: string,
): Promise<void> {
  await supabase.rpc("release_android_tester_roster_sync_claim", {
    p_claim_token: claimToken,
  });
}

function encryptedObservation(
  observation: Extract<
    RosterObservation,
    { kind: "new" | "rejoined" | "identity_refresh" }
  >,
  key: Buffer,
  keyVersion: number,
): Record<string, unknown> {
  const envelope = encryptTesterIdentity(
    {
      email: observation.email,
      externalMemberId: observation.externalMemberId,
    },
    key,
    keyVersion,
  );
  return {
    kind: observation.kind,
    ...(observation.kind === "rejoined" ||
    observation.kind === "identity_refresh"
      ? { entryId: observation.entryId }
      : {}),
    observedAt: observation.observedAt,
    keyVersion: envelope.keyVersion,
    iv: envelope.iv,
    ciphertext: envelope.ciphertext,
    authTag: envelope.authTag,
  };
}

export async function syncAndroidTesterRoster({
  actorUserId,
  now = new Date().toISOString(),
  supabase,
  fetchSnapshot = () =>
    fetchGoogleGroupMembers(loadGoogleDirectoryConfig()),
  loadActiveKey = loadActiveTesterIdentityKey,
  loadKey = loadTesterIdentityKey,
}: {
  actorUserId: string | null;
  now?: string;
  supabase: SyncClient;
  fetchSnapshot?: () => Promise<DirectoryRosterSnapshot>;
  loadActiveKey?: () => { key: Buffer; keyVersion: number };
  loadKey?: (keyVersion: number) => Buffer;
}): Promise<Record<string, unknown>> {
  const { data: claimToken, error: claimError } = await supabase.rpc(
    "claim_android_tester_roster_sync",
    {
      p_actor_user_id: actorUserId,
      p_observed_at: now,
    },
  );
  if (claimError) {
    throw new Error("Android tester roster sync claim unavailable");
  }
  if (typeof claimToken !== "string" || claimToken.length === 0) {
    return { complete: false, busy: true };
  }

  let snapshot: DirectoryRosterSnapshot;
  try {
    snapshot = await fetchSnapshot();
  } catch {
    return applyIncompleteRun({
      actorUserId,
      claimToken,
      now,
      supabase,
      failureCode: "directory_fetch_failed",
    });
  }

  if (!snapshot.complete) {
    return applyIncompleteRun({
      actorUserId,
      claimToken,
      now,
      supabase,
      failureCode: "directory_snapshot_incomplete",
    });
  }

  const { data, error } = await supabase.rpc(
    "get_android_tester_roster_sync_identities",
  );
  if (error) {
    return applyIncompleteRun({
      actorUserId,
      claimToken,
      now,
      supabase,
      failureCode: "identity_read_failed",
    });
  }

  let existing: ExistingRosterIdentity[];
  let identityFailureCode = "identity_decryption_failed";
  try {
    existing = [];
    for (const row of (data ?? []) as SyncIdentityRow[]) {
      if (row.user_id) {
        identityFailureCode = "linked_account_email_read_failed";
        const authAdmin = supabase.auth?.admin;
        if (!authAdmin) {
          throw new Error("Linked account identity lookup unavailable");
        }
        const { data: userData, error: userError } = await authAdmin.getUserById(
          row.user_id,
        );
        const email = userData.user?.email?.trim().toLowerCase();
        if (userError || !email) {
          throw new Error("Linked account identity lookup unavailable");
        }
        existing.push({
          id: row.entry_id,
          email,
          externalMemberId: "",
          eligibilityStatus: row.eligibility_status,
          purgeAfter: row.purge_after,
          isLinked: true,
        });
        continue;
      }

      identityFailureCode = "identity_decryption_failed";
      if (
        row.key_version === null ||
        row.iv === null ||
        row.ciphertext === null ||
        row.auth_tag === null
      ) {
        throw new Error("Unlinked tester identity envelope unavailable");
      }
      const envelope: TesterIdentityEnvelope = {
        keyVersion: row.key_version,
        iv: row.iv,
        ciphertext: row.ciphertext,
        authTag: row.auth_tag,
      };
      const identity = decryptTesterIdentity(
        envelope,
        loadKey(row.key_version),
      );
      existing.push({
        id: row.entry_id,
        email: identity.email,
        externalMemberId: identity.externalMemberId,
        eligibilityStatus: row.eligibility_status,
        purgeAfter: row.purge_after,
        isLinked: false,
      });
    }
  } catch {
    return applyIncompleteRun({
      actorUserId,
      claimToken,
      now,
      supabase,
      failureCode: identityFailureCode,
    });
  }

  const reconciliation = reconcileRosterSnapshot({
    now,
    snapshot,
    existing,
  });
  const requiresEncryption = reconciliation.observations.some(
    (observation) =>
      observation.kind === "new" ||
      observation.kind === "rejoined" ||
      observation.kind === "identity_refresh",
  );
  let observations: Record<string, unknown>[];
  try {
    const activeKey = requiresEncryption ? loadActiveKey() : null;
    observations = reconciliation.observations.map((observation) => {
      if (
        observation.kind === "new" ||
        observation.kind === "rejoined" ||
        observation.kind === "identity_refresh"
      ) {
        if (!activeKey) {
          throw new Error("Tester identity encryption key unavailable");
        }
        return encryptedObservation(
          observation,
          activeKey.key,
          activeKey.keyVersion,
        );
      }
      return observation;
    });
  } catch {
    return applyIncompleteRun({
      actorUserId,
      claimToken,
      now,
      supabase,
      failureCode: "identity_encryption_failed",
    });
  }

  const { data: applied, error: applyError } = await supabase.rpc(
    "apply_android_tester_roster_snapshot",
    {
      p_actor_user_id: actorUserId,
      p_claim_token: claimToken,
      p_snapshot_complete: true,
      p_observed_at: now,
      p_observations: observations,
      p_direct_user_count: snapshot.members.length,
      p_failure_code: null,
    },
  );
  if (applyError) {
    await releaseSyncClaim(supabase, claimToken);
    throw new Error("Android tester roster sync persistence unavailable");
  }
  return (applied ?? { complete: true }) as Record<string, unknown>;
}
