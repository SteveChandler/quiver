/**
 * @jest-environment node
 */

import { recordInviteConsumedEvent } from "@/lib/invites/events";

function createSupabaseMock(allowImplicitTracking: boolean | null = true) {
  const insert = jest.fn().mockResolvedValue({ error: null });
  const maybeSingle = jest.fn().mockResolvedValue({
    data:
      allowImplicitTracking === null
        ? null
        : { allow_implicit_tracking: allowImplicitTracking },
    error: null,
  });
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq }));
  const from = jest.fn((table: string) => {
    if (table === "profiles") return { select };
    if (table === "user_events") return { insert };
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    supabase: { from },
    insert,
    maybeSingle,
  };
}

describe("recordInviteConsumedEvent", () => {
  it("records invite_consumed when product telemetry is allowed", async () => {
    const { supabase, insert } = createSupabaseMock(true);

    await recordInviteConsumedEvent(supabase as any, {
      followerId: "follower-id",
      inviterId: "inviter-id",
      tokenHash: "hash-token",
      surface: "native",
      selfInvite: false,
      flags: {
        followCreated: true,
        referralCreated: true,
      },
    });

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

    await recordInviteConsumedEvent(supabase as any, {
      followerId: "follower-id",
      inviterId: "inviter-id",
      tokenHash: "hash-token",
      surface: "web",
      selfInvite: false,
    });

    expect(insert).not.toHaveBeenCalled();
  });
});
