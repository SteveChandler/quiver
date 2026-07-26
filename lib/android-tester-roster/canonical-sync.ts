import {
  decryptTesterIdentity,
  type TesterIdentityEnvelope,
} from "./crypto";
import { loadTesterIdentityKey } from "./keys";
import { syncAndroidTesterRoster } from "./sync";
import { resolveCanonicalAndroidWaitlist } from "./waitlist";

interface CanonicalSyncIdentityRow {
  entry_id: string;
  user_id: string | null;
  key_version: number | null;
  iv: string | null;
  ciphertext: string | null;
  auth_tag: string | null;
}

type SyncOptions = Parameters<typeof syncAndroidTesterRoster>[0];

async function readCanonicalEmail(
  row: CanonicalSyncIdentityRow,
  options: SyncOptions,
): Promise<string> {
  if (row.user_id) {
    const authAdmin = options.supabase.auth?.admin;
    if (!authAdmin) {
      throw new Error("Canonical Android waitlist identity unavailable");
    }
    const { data, error } = await authAdmin.getUserById(row.user_id);
    const email = data.user?.email?.trim().toLowerCase();
    if (error || !email) {
      throw new Error("Canonical Android waitlist identity unavailable");
    }
    return email;
  }

  if (
    row.key_version === null ||
    row.iv === null ||
    row.ciphertext === null ||
    row.auth_tag === null
  ) {
    throw new Error("Canonical Android waitlist identity unavailable");
  }

  const envelope: TesterIdentityEnvelope = {
    keyVersion: row.key_version,
    iv: row.iv,
    ciphertext: row.ciphertext,
    authTag: row.auth_tag,
  };
  const loadKey = options.loadKey ?? loadTesterIdentityKey;
  return decryptTesterIdentity(envelope, loadKey(row.key_version)).email;
}

export async function syncCanonicalAndroidTesterRoster(
  options: SyncOptions,
): Promise<Record<string, unknown>> {
  const result = await syncAndroidTesterRoster(options);
  if (result.complete !== true) {
    return result;
  }

  const { data, error } = await options.supabase.rpc(
    "get_android_tester_roster_sync_identities",
  );
  if (error || !Array.isArray(data)) {
    throw new Error("Canonical Android waitlist roster read unavailable");
  }

  let canonicalSourceCount = 0;
  for (const row of data as CanonicalSyncIdentityRow[]) {
    const email = await readCanonicalEmail(row, options);
    await resolveCanonicalAndroidWaitlist(options.supabase as any, {
      userId: row.user_id,
      email,
      rosterEntryId: row.entry_id,
      sourceKind: "roster_evidence",
      sourceId: row.entry_id,
      source: "google_directory",
      surface: "android_tester_roster",
      placement: "direct_group_membership",
      observedAt: options.now ?? new Date().toISOString(),
    });
    canonicalSourceCount += 1;
  }

  return {
    ...result,
    canonicalSourceCount,
  };
}
