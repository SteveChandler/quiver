import { incrementUserXP } from "@/lib/gamification/xp-service";

describe("incrementUserXP", () => {
  it("calls the hardened XP increment RPC with idempotency metadata", async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({
        data: [{ xp_total: 150, level: 2, awarded: 50 }],
        error: null,
      }),
    };

    const result = await incrementUserXP(
      "user-1",
      50,
      "log_session",
      "session-1",
      "log_session:session-1",
      supabase as never,
    );

    expect(supabase.rpc).toHaveBeenCalledWith("increment_user_xp", {
      p_user_id: "user-1",
      p_amount: 50,
      p_action: "log_session",
      p_related_entity_id: "session-1",
      p_idempotency_key: "log_session:session-1",
    });
    expect(result).toEqual({ xp_total: 150, level: 2, awarded: 50 });
  });

  it("throws a descriptive error when the RPC fails", async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "permission denied" },
      }),
    };

    await expect(
      incrementUserXP(
        "user-1",
        50,
        "log_session",
        "session-1",
        "log_session:session-1",
        supabase as never,
      ),
    ).rejects.toThrow("Failed to increment user XP: permission denied");
  });
});
