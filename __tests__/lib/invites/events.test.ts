/**
 * @jest-environment node
 */

import { recordInviteConsumedEvent } from "@/lib/invites/events";
import { expectConsoleErrors } from "@/__tests__/setup/test-utils";

function createSupabaseMock(allowImplicitTracking: boolean | null = true) {
  const insert = jest.fn().mockResolvedValue({ error: null });
  const rpc = jest.fn().mockResolvedValue({
    data: allowImplicitTracking === true,
    error: null,
  });
  const from = jest.fn((table: string) => {
    if (table === "user_events") return { insert };
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    supabase: { from, rpc },
    insert,
    rpc,
  };
}

describe("recordInviteConsumedEvent", () => {
  it("records invite_consumed when product telemetry is allowed", async () => {
    const { supabase, insert } = createSupabaseMock(true);

    await expect(
      recordInviteConsumedEvent(supabase as any, {
        followerId: "follower-id",
        inviterId: "inviter-id",
        tokenHash: "hash-token",
        surface: "native",
        selfInvite: false,
        flags: {
          followCreated: true,
          referralCreated: true,
        },
      }),
    ).resolves.toBe(true);

    expect(supabase.rpc).toHaveBeenCalledWith(
      "get_my_analytics_tracking_allowed",
      { p_expected_user_id: "follower-id" },
    );

    expect(insert).toHaveBeenCalledWith({
      user_id: "follower-id",
      event_type: "invite_consumed",
      beach_id: null,
      metadata: expect.objectContaining({
        token_hash: "hash-token",
        inviter_id: "inviter-id",
        surface: "native",
        follow_created: true,
        referral_created: true,
        self_invite: false,
      }),
    });
  });

  it("skips invite_consumed when product telemetry is disabled", async () => {
    const { supabase, insert } = createSupabaseMock(false);

    await expect(
      recordInviteConsumedEvent(supabase as any, {
        followerId: "follower-id",
        inviterId: "inviter-id",
        tokenHash: "hash-token",
        surface: "web",
        selfInvite: false,
      }),
    ).resolves.toBe(false);

    expect(insert).not.toHaveBeenCalled();
  });

  it("does not authorize downstream telemetry when the event insert fails", async () => {
    const { supabase, insert } = createSupabaseMock(true);
    insert.mockResolvedValueOnce({
      error: { code: "42501", message: "row-level security violation" },
    });

    await expect(
      recordInviteConsumedEvent(supabase as any, {
        followerId: "follower-id",
        inviterId: "inviter-id",
        tokenHash: "hash-token",
        surface: "native",
        selfInvite: false,
      }),
    ).resolves.toBe(false);
    expectConsoleErrors([/failed to record invite_consumed/]);
  });
});
