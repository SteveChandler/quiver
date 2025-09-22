import { notifySessionInvite } from "@/lib/notifications";

// Capture arguments passed to rpc for assertions
const rpcMock = jest.fn(async (_name: string, _args: any) => ({
  data: { id: "activity-123" },
  error: null,
}));

const serverRpcMock = jest.fn(async (_name: string, _args: any) => ({
  data: "activity-id",
  error: null,
}));

describe("notifySessionInvite", () => {
  beforeEach(() => {
    rpcMock.mockClear();
  });

  it("calls RPC with correct params and returns activity id", async () => {
    const input = {
      actorId: "actor-uuid",
      recipientId: "recipient-uuid",
      sessionId: "session-uuid",
      metadata: { beachName: "Ocean Beach", when: "2025-09-16T10:00:00Z" },
    };

    const id = await notifySessionInvite(input as any);

    expect(id).toBe("activity-123");
    expect(rpcMock).toHaveBeenCalledTimes(1);
    const [name, args] = rpcMock.mock.calls[0];
    expect(name).toBe("notify_session_invite");
    expect(args).toEqual({
      p_actor_id: input.actorId,
      p_recipient_id: input.recipientId,
      p_session_id: input.sessionId,
      p_payload: input.metadata,
    });
  });
});

import { createActivityForInvite } from "@/lib/notifications";
import { createSupabaseServerClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => {
  const mock = require("@/__tests__/setup/mock-supabase");
  return {
    // service-role client used by notifySessionInvite
    createSupabaseServiceRoleClient: async () => ({
      rpc: rpcMock,
    }),
    // regular server client used by createActivityForInvite
    createSupabaseServerClient: async () => ({
      rpc: serverRpcMock,
    }),
  };
});

describe("createActivityForInvite", () => {
  it("calls RPC with correct payload", async () => {
    const supabase: any = await createSupabaseServerClient();
    // Ensure rpc is a jest mock function
    expect(typeof supabase.rpc).toBe("function");
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

