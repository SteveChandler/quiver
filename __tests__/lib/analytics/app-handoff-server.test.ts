import { expectConsoleErrors } from "@/__tests__/setup/test-utils";

const insert = jest.fn<Promise<{ error: Error | null }>, [unknown]>(() =>
  Promise.resolve({ error: null }),
);

jest.mock("@/lib/supabase", () => ({
  createServiceRoleClient: () => ({ from: () => ({ insert }) }),
}));

import { logAppHandoffLinkOpenedServer } from "@/lib/analytics/app-handoff-server";

describe("logAppHandoffLinkOpenedServer", () => {
  beforeEach(() => jest.clearAllMocks());

  it("inserts an anonymous app_handoff_link_opened row and never throws", async () => {
    await logAppHandoffLinkOpenedServer({
      sessionId: "abc",
      metadata: {
        source: "qr",
        platform: "ios",
        destination_type: "app_store",
      },
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "app_handoff_link_opened",
        session_id: "abc",
        user_id: null,
      }),
    );
  });

  it("swallows insert errors because logging must never block a redirect", async () => {
    insert.mockResolvedValueOnce({ error: new Error("db down") });
    await expect(
      logAppHandoffLinkOpenedServer({
        sessionId: "abc",
        metadata: { source: "qr" },
      }),
    ).resolves.toBeUndefined();
    expectConsoleErrors([/app_handoff_link_opened insert failed/]);
  });
});
