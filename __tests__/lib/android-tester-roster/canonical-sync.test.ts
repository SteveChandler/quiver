import { encryptTesterIdentity } from "@/lib/android-tester-roster/crypto";
import { syncCanonicalAndroidTesterRoster } from "@/lib/android-tester-roster/canonical-sync";

const KEY = Buffer.from("11".repeat(32), "hex");
const NOW = "2026-07-26T12:00:00.000Z";
const CLAIM_TOKEN = "50000000-0000-4000-8000-000000000005";
const ROSTER_ENTRY_ID = "20000000-0000-4000-8000-000000000002";

describe("canonical Android tester roster sync", () => {
  it("links each completed roster row by exact roster ID and normalized email hash", async () => {
    const envelope = encryptTesterIdentity(
      {
        email: "SURFER@example.com",
        externalMemberId: "google-member-1",
      },
      KEY,
      1,
    );
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({ data: CLAIM_TOKEN, error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({
        data: { complete: true, addedCount: 1 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            entry_id: ROSTER_ENTRY_ID,
            user_id: null,
            eligibility_status: "eligible",
            purge_after: null,
            key_version: 1,
            iv: envelope.iv,
            ciphertext: envelope.ciphertext,
            auth_tag: envelope.authTag,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: "30000000-0000-4000-8000-000000000003",
        error: null,
      });

    const result = await syncCanonicalAndroidTesterRoster({
      actorUserId: null,
      now: NOW,
      supabase: { rpc },
      fetchSnapshot: async () => ({
        complete: true,
        members: [
          {
            email: "surfer@example.com",
            externalMemberId: "google-member-1",
          },
        ],
      }),
      loadActiveKey: () => ({ key: KEY, keyVersion: 1 }),
      loadKey: () => KEY,
    });

    expect(result).toEqual(
      expect.objectContaining({
        complete: true,
        canonicalSourceCount: 1,
      }),
    );
    expect(rpc).toHaveBeenLastCalledWith(
      "resolve_android_waitlist_entry",
      expect.objectContaining({
        p_user_id: null,
        p_normalized_email_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        p_roster_entry_id: ROSTER_ENTRY_ID,
        p_source_kind: "roster_evidence",
        p_source_id: ROSTER_ENTRY_ID,
      }),
    );
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(
      "surfer@example.com",
    );
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("google-member-1");
  });

  it("does no canonical read or write for busy and incomplete snapshots", async () => {
    const busyRpc = jest.fn().mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(
      syncCanonicalAndroidTesterRoster({
        actorUserId: null,
        now: NOW,
        supabase: { rpc: busyRpc },
        fetchSnapshot: jest.fn(),
        loadActiveKey: () => ({ key: KEY, keyVersion: 1 }),
        loadKey: () => KEY,
      }),
    ).resolves.toEqual({ complete: false, busy: true });
    expect(busyRpc).toHaveBeenCalledTimes(1);

    const incompleteRpc = jest
      .fn()
      .mockResolvedValueOnce({ data: CLAIM_TOKEN, error: null })
      .mockResolvedValueOnce({ data: { complete: false }, error: null });
    await expect(
      syncCanonicalAndroidTesterRoster({
        actorUserId: null,
        now: NOW,
        supabase: { rpc: incompleteRpc },
        fetchSnapshot: async () => ({ complete: false, members: [] }),
        loadActiveKey: () => ({ key: KEY, keyVersion: 1 }),
        loadKey: () => KEY,
      }),
    ).resolves.toEqual({ complete: false });
    expect(incompleteRpc).toHaveBeenCalledTimes(2);
  });
});
