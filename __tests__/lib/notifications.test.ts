import { createActivityForInvite } from "@/lib/notifications";
import { createSupabaseServerClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () =>
  require("@/__tests__/setup/mock-supabase")
);

describe("createActivityForInvite", () => {
  it("calls RPC with correct payload", async () => {
    const supabase: any = await createSupabaseServerClient();
    await createActivityForInvite({
      actorId: "u1",
      recipientId: "u2",
      sessionId: "s1",
      metadata: { beachName: "Ocean Beach" },
    });
    expect(supabase.rpc).toHaveBeenCalledWith(
      "create_activity",
      expect.objectContaining({
        p_user_id: "u1",
        p_activity_type: "session_invite.created",
        p_entity_type: "session",
        p_entity_id: "s1",
      })
    );
  });
});

