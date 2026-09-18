import { expectConsoleErrors } from "@/__tests__/setup/test-utils";

const insert = jest.fn<Promise<{ error: Error | null }>, [unknown]>(() =>
  Promise.resolve({ error: null }),
);
var mockCapturePostHogEvent = jest.fn<Promise<void>, [unknown]>(() =>
  Promise.resolve(),
);

jest.mock("@/lib/supabase", () => ({
  createServiceRoleClient: () => ({ from: () => ({ insert }) }),
}));
jest.mock("@/lib/posthog-server", () => ({
  capturePostHogEvent: (arg: unknown) => mockCapturePostHogEvent(arg),
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
    expect(mockCapturePostHogEvent).toHaveBeenCalledWith({
      distinctId: "abc",
      event: "app_handoff_link_opened",
      properties: expect.objectContaining({
        source: "qr",
        platform: "ios",
        destination_type: "app_store",
        "$process_person_profile": false,
      }),
    });
  });

  it("uses the consented web PostHog distinct ID and omits it from properties", async () => {
    await logAppHandoffLinkOpenedServer({
      sessionId: "handoff-id",
      metadata: {
        handoff_id: "handoff-id",
        web_distinct_id: "web-person",
        source: "web",
      },
    });

    expect(mockCapturePostHogEvent).toHaveBeenCalledWith({
      distinctId: "web-person",
      event: "app_handoff_link_opened",
      properties: {
        handoff_id: "handoff-id",
        source: "web",
      },
    });
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
