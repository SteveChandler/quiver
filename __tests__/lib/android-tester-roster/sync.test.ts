import { encryptTesterIdentity } from "@/lib/android-tester-roster/crypto";
import { syncAndroidTesterRoster } from "@/lib/android-tester-roster/sync";

const KEY = Buffer.from("11".repeat(32), "hex");
const NOW = "2026-07-25T12:00:00.000Z";
const CLAIM_TOKEN = "50000000-0000-4000-8000-000000000005";

describe("Android tester roster sync", () => {
  it("owns the database claim before Directory fetch and rejects a concurrent fetch", async () => {
    const callOrder: string[] = [];
    let claimOwned = false;
    let finishFirstFetch: (value: {
      complete: true;
      members: [];
    }) => void = () => {
      throw new Error("First Directory fetch did not start");
    };
    const rpc = jest.fn(async (name: string) => {
      if (name === "claim_android_tester_roster_sync") {
        callOrder.push("claim");
        if (claimOwned) {
          return { data: null, error: null };
        }
        claimOwned = true;
        return { data: CLAIM_TOKEN, error: null };
      }
      if (name === "get_android_tester_roster_sync_identities") {
        return { data: [], error: null };
      }
      if (name === "apply_android_tester_roster_snapshot") {
        claimOwned = false;
        return { data: { complete: true }, error: null };
      }
      return { data: false, error: null };
    });
    const firstFetch = jest.fn(
      () =>
        new Promise<{ complete: true; members: [] }>((resolve) => {
          callOrder.push("fetch");
          finishFirstFetch = resolve;
        }),
    );
    const secondFetch = jest.fn(async () => ({
      complete: true as const,
      members: [],
    }));

    const first = syncAndroidTesterRoster({
      actorUserId: "10000000-0000-4000-8000-000000000001",
      now: NOW,
      supabase: { rpc },
      fetchSnapshot: firstFetch,
      loadActiveKey: () => ({ key: KEY, keyVersion: 1 }),
      loadKey: () => KEY,
    });
    await Promise.resolve();
    await Promise.resolve();

    const second = await syncAndroidTesterRoster({
      actorUserId: "10000000-0000-4000-8000-000000000001",
      now: NOW,
      supabase: { rpc },
      fetchSnapshot: secondFetch,
      loadActiveKey: () => ({ key: KEY, keyVersion: 1 }),
      loadKey: () => KEY,
    });

    expect(callOrder.slice(0, 2)).toEqual(["claim", "fetch"]);
    expect(second).toEqual({ complete: false, busy: true });
    expect(secondFetch).not.toHaveBeenCalled();

    finishFirstFetch({ complete: true, members: [] });
    await first;
  });

  it("records an incomplete run and never reconciles identities when Directory fails", async () => {
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({ data: CLAIM_TOKEN, error: null })
      .mockResolvedValueOnce({ data: { complete: false }, error: null });
    const fetchSnapshot = jest.fn().mockResolvedValue({
      complete: false,
      members: [],
    });

    const result = await syncAndroidTesterRoster({
      actorUserId: "10000000-0000-4000-8000-000000000001",
      now: NOW,
      supabase: { rpc },
      fetchSnapshot,
      loadActiveKey: () => ({ key: KEY, keyVersion: 1 }),
      loadKey: () => KEY,
    });

    expect(result).toEqual({ complete: false });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenNthCalledWith(
      1,
      "claim_android_tester_roster_sync",
      {
        p_actor_user_id: "10000000-0000-4000-8000-000000000001",
        p_observed_at: NOW,
      },
    );
    expect(rpc).toHaveBeenCalledWith(
      "apply_android_tester_roster_snapshot",
      expect.objectContaining({
        p_snapshot_complete: false,
        p_observations: [],
        p_failure_code: "directory_snapshot_incomplete",
        p_claim_token: CLAIM_TOKEN,
      }),
    );
  });

  it("does not read or apply identities when another sync owns the claim", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await syncAndroidTesterRoster({
      actorUserId: "10000000-0000-4000-8000-000000000001",
      now: NOW,
      supabase: { rpc },
      fetchSnapshot: async () => ({ complete: true, members: [] }),
      loadActiveKey: () => ({ key: KEY, keyVersion: 1 }),
      loadKey: () => KEY,
    });

    expect(result).toEqual({ complete: false, busy: true });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalledWith(
      "get_android_tester_roster_sync_identities",
      expect.anything(),
    );
    expect(rpc).not.toHaveBeenCalledWith(
      "apply_android_tester_roster_snapshot",
      expect.anything(),
    );
  });

  it("finalizes the claimed run when Directory fetch throws", async () => {
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({ data: CLAIM_TOKEN, error: null })
      .mockResolvedValueOnce({ data: { complete: false }, error: null });

    const result = await syncAndroidTesterRoster({
      actorUserId: "10000000-0000-4000-8000-000000000001",
      now: NOW,
      supabase: { rpc },
      fetchSnapshot: async () => {
        throw new Error("Directory unavailable");
      },
      loadActiveKey: () => ({ key: KEY, keyVersion: 1 }),
      loadKey: () => KEY,
    });

    expect(result).toEqual({ complete: false });
    expect(rpc).toHaveBeenLastCalledWith(
      "apply_android_tester_roster_snapshot",
      expect.objectContaining({
        p_claim_token: CLAIM_TOKEN,
        p_failure_code: "directory_fetch_failed",
      }),
    );
  });

  it("releases the claim when snapshot apply fails", async () => {
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({ data: CLAIM_TOKEN, error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "apply failed" },
      })
      .mockResolvedValueOnce({ data: true, error: null });

    await expect(
      syncAndroidTesterRoster({
        actorUserId: "10000000-0000-4000-8000-000000000001",
        now: NOW,
        supabase: { rpc },
        fetchSnapshot: async () => ({ complete: true, members: [] }),
        loadActiveKey: () => ({ key: KEY, keyVersion: 1 }),
        loadKey: () => KEY,
      }),
    ).rejects.toThrow("sync persistence unavailable");
    expect(rpc).toHaveBeenLastCalledWith(
      "release_android_tester_roster_sync_claim",
      { p_claim_token: CLAIM_TOKEN },
    );
  });

  it("finalizes the claimed run when identity encryption is unavailable", async () => {
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({ data: CLAIM_TOKEN, error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: { complete: false }, error: null });

    const result = await syncAndroidTesterRoster({
      actorUserId: "10000000-0000-4000-8000-000000000001",
      now: NOW,
      supabase: { rpc },
      fetchSnapshot: async () => ({
        complete: true,
        members: [
          {
            email: "new@example.com",
            externalMemberId: "member-new",
          },
        ],
      }),
      loadActiveKey: () => {
        throw new Error("key unavailable");
      },
      loadKey: () => KEY,
    });

    expect(result).toEqual({ complete: false });
    expect(rpc).toHaveBeenLastCalledWith(
      "apply_android_tester_roster_snapshot",
      expect.objectContaining({
        p_claim_token: CLAIM_TOKEN,
        p_failure_code: "identity_encryption_failed",
      }),
    );
  });

  it("releases the claim when encryption failure cannot be finalized", async () => {
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({ data: CLAIM_TOKEN, error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "incomplete apply failed" },
      })
      .mockResolvedValueOnce({ data: true, error: null });

    await expect(
      syncAndroidTesterRoster({
        actorUserId: "10000000-0000-4000-8000-000000000001",
        now: NOW,
        supabase: { rpc },
        fetchSnapshot: async () => ({
          complete: true,
          members: [
            {
              email: "new@example.com",
              externalMemberId: "member-new",
            },
          ],
        }),
        loadActiveKey: () => {
          throw new Error("key unavailable");
        },
        loadKey: () => KEY,
      }),
    ).rejects.toThrow("sync persistence unavailable");
    expect(rpc).toHaveBeenLastCalledWith(
      "release_android_tester_roster_sync_claim",
      { p_claim_token: CLAIM_TOKEN },
    );
  });

  it("encrypts new identities before persistence and never sends plaintext or identity hashes to the database", async () => {
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({ data: CLAIM_TOKEN, error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({
        data: {
          complete: true,
          addedCount: 1,
          rejoinedCount: 0,
          leftCount: 0,
          purgedCount: 0,
        },
        error: null,
      });

    await syncAndroidTesterRoster({
      actorUserId: "10000000-0000-4000-8000-000000000001",
      now: NOW,
      supabase: { rpc },
      fetchSnapshot: async () => ({
        complete: true,
        members: [
          {
            email: "new@example.com",
            externalMemberId: "google-member-new",
          },
        ],
      }),
      loadActiveKey: () => ({ key: KEY, keyVersion: 3 }),
      loadKey: () => KEY,
    });

    const applyArgs = rpc.mock.calls[2][1];
    expect(applyArgs.p_claim_token).toBe(CLAIM_TOKEN);
    expect(applyArgs.p_observations).toEqual([
      expect.objectContaining({
        kind: "new",
        keyVersion: 3,
        iv: expect.stringMatching(/^[A-Za-z0-9_-]{16}$/),
        ciphertext: expect.any(String),
        authTag: expect.any(String),
      }),
    ]);
    expect(JSON.stringify(applyArgs)).not.toContain("new@example.com");
    expect(JSON.stringify(applyArgs)).not.toContain("google-member-new");
    expect(JSON.stringify(applyArgs)).not.toMatch(
      /email_hash|member_id_hash|identity_hash/i,
    );
  });

  it("uses only a complete snapshot to mark a missing member left at +30 days", async () => {
    const envelope = encryptTesterIdentity(
      {
        email: "left@example.com",
        externalMemberId: "google-member-left",
      },
      KEY,
      1,
    );
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({ data: CLAIM_TOKEN, error: null })
      .mockResolvedValueOnce({
        data: [
          {
            entry_id: "20000000-0000-4000-8000-000000000002",
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
        data: {
          complete: true,
          addedCount: 0,
          rejoinedCount: 0,
          leftCount: 1,
          purgedCount: 0,
        },
        error: null,
      });

    await syncAndroidTesterRoster({
      actorUserId: "10000000-0000-4000-8000-000000000001",
      now: NOW,
      supabase: { rpc },
      fetchSnapshot: async () => ({ complete: true, members: [] }),
      loadActiveKey: () => ({ key: KEY, keyVersion: 1 }),
      loadKey: () => KEY,
    });

    expect(rpc).toHaveBeenLastCalledWith(
      "apply_android_tester_roster_snapshot",
      expect.objectContaining({
        p_snapshot_complete: true,
        p_observations: [
          {
            kind: "left",
            entryId: "20000000-0000-4000-8000-000000000002",
            observedAt: NOW,
            purgeAfter: "2026-08-24T12:00:00.000Z",
          },
        ],
      }),
    );
  });

  it("fails closed instead of producing leave observations when an existing envelope cannot be decrypted", async () => {
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({ data: CLAIM_TOKEN, error: null })
      .mockResolvedValueOnce({
        data: [
          {
            entry_id: "20000000-0000-4000-8000-000000000002",
            eligibility_status: "eligible",
            purge_after: null,
            key_version: 1,
            iv: "A".repeat(16),
            ciphertext: "broken",
            auth_tag: "A".repeat(22),
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: { complete: false }, error: null });

    const result = await syncAndroidTesterRoster({
      actorUserId: "10000000-0000-4000-8000-000000000001",
      now: NOW,
      supabase: { rpc },
      fetchSnapshot: async () => ({
        complete: true,
        members: [
          {
            email: "active@example.com",
            externalMemberId: "active-member",
          },
        ],
      }),
      loadActiveKey: () => ({ key: KEY, keyVersion: 1 }),
      loadKey: () => KEY,
    });

    expect(result).toEqual({ complete: false });
    expect(rpc).toHaveBeenLastCalledWith(
      "apply_android_tester_roster_snapshot",
      expect.objectContaining({
        p_snapshot_complete: false,
        p_observations: [],
        p_failure_code: "identity_decryption_failed",
      }),
    );
  });

  it("resolves linked account email transiently so the next sync does not recreate a redacted identity", async () => {
    const getUserById = jest.fn().mockResolvedValue({
      data: { user: { email: "surfer@example.com" } },
      error: null,
    });
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({ data: CLAIM_TOKEN, error: null })
      .mockResolvedValueOnce({
        data: [
          {
            entry_id: "20000000-0000-4000-8000-000000000002",
            user_id: "30000000-0000-4000-8000-000000000003",
            eligibility_status: "eligible",
            purge_after: null,
            key_version: null,
            iv: null,
            ciphertext: null,
            auth_tag: null,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: { complete: true, addedCount: 0 },
        error: null,
      });
    const loadActiveKey = jest.fn(() => ({ key: KEY, keyVersion: 1 }));

    await syncAndroidTesterRoster({
      actorUserId: "10000000-0000-4000-8000-000000000001",
      now: NOW,
      supabase: { rpc, auth: { admin: { getUserById } } },
      fetchSnapshot: async () => ({
        complete: true,
        members: [
          {
            email: "surfer@example.com",
            externalMemberId: "google-member-current",
          },
        ],
      }),
      loadActiveKey,
      loadKey: () => KEY,
    });

    const applyArgs = rpc.mock.calls[2][1];
    expect(applyArgs.p_observations).toEqual([
      {
        kind: "seen",
        entryId: "20000000-0000-4000-8000-000000000002",
        observedAt: NOW,
      },
    ]);
    expect(JSON.stringify(applyArgs)).not.toMatch(
      /surfer@example\.com|google-member-current|ciphertext/i,
    );
    expect(loadActiveKey).not.toHaveBeenCalled();
  });

  it("marks a linked account left without reintroducing identity or a 30-day raw-identity purge", async () => {
    const getUserById = jest.fn().mockResolvedValue({
      data: { user: { email: "surfer@example.com" } },
      error: null,
    });
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({ data: CLAIM_TOKEN, error: null })
      .mockResolvedValueOnce({
        data: [
          {
            entry_id: "20000000-0000-4000-8000-000000000002",
            user_id: "30000000-0000-4000-8000-000000000003",
            eligibility_status: "eligible",
            purge_after: null,
            key_version: null,
            iv: null,
            ciphertext: null,
            auth_tag: null,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: { complete: true, leftCount: 1 },
        error: null,
      });

    await syncAndroidTesterRoster({
      actorUserId: "10000000-0000-4000-8000-000000000001",
      now: NOW,
      supabase: { rpc, auth: { admin: { getUserById } } },
      fetchSnapshot: async () => ({ complete: true, members: [] }),
      loadActiveKey: () => ({ key: KEY, keyVersion: 1 }),
      loadKey: () => KEY,
    });

    expect(rpc.mock.calls[2][1].p_observations).toEqual([
      {
        kind: "left_linked",
        entryId: "20000000-0000-4000-8000-000000000002",
        observedAt: NOW,
      },
    ]);
    expect(JSON.stringify(rpc.mock.calls[2][1])).not.toMatch(
      /email|ciphertext|purgeAfter/i,
    );
  });

  it("re-encrypts a changed primary email with a fresh IV and persists no plaintext", async () => {
    const oldEnvelope = encryptTesterIdentity(
      {
        email: "old-primary@example.com",
        externalMemberId: "google-member-stable",
      },
      KEY,
      1,
    );
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({ data: CLAIM_TOKEN, error: null })
      .mockResolvedValueOnce({
        data: [
          {
            entry_id: "20000000-0000-4000-8000-000000000002",
            user_id: null,
            eligibility_status: "eligible",
            purge_after: null,
            key_version: 1,
            iv: oldEnvelope.iv,
            ciphertext: oldEnvelope.ciphertext,
            auth_tag: oldEnvelope.authTag,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: { complete: true, addedCount: 0, refreshedCount: 1 },
        error: null,
      });

    const result = await syncAndroidTesterRoster({
      actorUserId: "10000000-0000-4000-8000-000000000001",
      now: NOW,
      supabase: { rpc },
      fetchSnapshot: async () => ({
        complete: true,
        members: [
          {
            email: "new-primary@example.com",
            externalMemberId: "google-member-stable",
          },
        ],
      }),
      loadActiveKey: () => ({ key: KEY, keyVersion: 2 }),
      loadKey: () => KEY,
    });

    const applyArgs = rpc.mock.calls[2][1];
    expect(applyArgs.p_observations).toEqual([
      expect.objectContaining({
        kind: "identity_refresh",
        entryId: "20000000-0000-4000-8000-000000000002",
        keyVersion: 2,
        iv: expect.not.stringMatching(oldEnvelope.iv),
      }),
    ]);
    expect(JSON.stringify(applyArgs)).not.toMatch(
      /old-primary@example\.com|new-primary@example\.com|google-member-stable/,
    );
    expect(result).toEqual(
      expect.objectContaining({ complete: true, refreshedCount: 1 }),
    );
  });
});
