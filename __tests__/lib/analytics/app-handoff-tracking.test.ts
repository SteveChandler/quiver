import {
  APP_HANDOFF_LINK_OPENED_EVENT,
  APP_HANDOFF_VIEW_EVENT,
  type ExactCallHandoffMetadata,
  trackAppHandoffEmailSubmit,
  trackAppHandoffView,
  trackExactCallHandoffLinkOpened,
} from "@/lib/analytics/app-handoff-tracking";

jest.mock("@/lib/analytics", () => ({ track: jest.fn() }));
import { track } from "@/lib/analytics";

describe("app-handoff-tracking", () => {
  const HANDOFF_ID = "33333333-3333-4333-8333-333333333333";
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit]>(
    () => Promise.resolve(new Response("{}")),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = fetchMock;
    Object.defineProperty(window, "innerWidth", {
      value: 1280,
      configurable: true,
    });
  });

  it("emits the view event to external analytics and /api/events", () => {
    trackAppHandoffView({
      source: "landing_hero",
      surface: "landing-page",
      placement: "hero_primary",
      handoff_id: "33333333-3333-4333-8333-333333333333",
      platform: "desktop",
    });
    expect(track).toHaveBeenCalledWith(
      APP_HANDOFF_VIEW_EVENT,
      expect.objectContaining({ source: "landing_hero" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/events",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.eventType).toBe("app_handoff_view");
    expect(body.metadata.handoff_id).toBe(
      "33333333-3333-4333-8333-333333333333",
    );
  });

  it("never includes a raw email - only the domain", () => {
    trackAppHandoffEmailSubmit({
      source: "landing_hero",
      surface: "landing-page",
      placement: "hero_primary",
      platform: "desktop",
      email_domain: "gmail.com",
    });
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(JSON.stringify(body)).not.toContain("@");
    expect(body.metadata.email_domain).toBe("gmail.com");
  });

  it("cannot throw into exact-link actions when either analytics sink fails", () => {
    (track as jest.Mock).mockImplementationOnce(() => {
      throw new Error("PostHog unavailable");
    });
    fetchMock.mockImplementationOnce(() => {
      throw new Error("events API unavailable");
    });

    expect(() =>
      trackExactCallHandoffLinkOpened({
        handoff_id: HANDOFF_ID,
        source: "exact_call",
        handoff_context: "exact_call",
        fallback_classification: "exact",
      })
    ).not.toThrow();
  });

  it("sanitizes dedicated exact-call metadata before both sinks", () => {
    const unsafeMetadata = {
      handoff_id: HANDOFF_ID,
      source: "exact_call",
      handoff_context: "exact_call",
      fallback_classification: "replaced",
      reason: "window_replaced",
      surface: "beach_detail",
      email: "surfer@example.com",
      lat: 32.1,
      handoff_token: "secret",
    } as unknown as ExactCallHandoffMetadata;

    trackExactCallHandoffLinkOpened(unsafeMetadata);

    expect(track).toHaveBeenCalledWith(
      APP_HANDOFF_LINK_OPENED_EVENT,
      expect.objectContaining({
        handoff_id: HANDOFF_ID,
        source: "exact_call",
        handoff_context: "exact_call",
        fallback_classification: "replaced",
        reason: "window_replaced",
        surface: "beach_detail",
      })
    );
    const postHogMetadata = (track as jest.Mock).mock.calls[0][1];
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string
    );
    for (const metadata of [postHogMetadata, body.metadata]) {
      expect(metadata).not.toHaveProperty("email");
      expect(metadata).not.toHaveProperty("lat");
      expect(metadata).not.toHaveProperty("handoff_token");
    }
  });

  it("emits the exact-call start with its canonical handoff ID", () => {
    trackExactCallHandoffLinkOpened({
      handoff_id: HANDOFF_ID,
      source: "exact_call",
      handoff_context: "exact_call",
      fallback_classification: "exact",
    });

    expect(track).toHaveBeenCalledWith(
      APP_HANDOFF_LINK_OPENED_EVENT,
      expect.objectContaining({ handoff_id: HANDOFF_ID }),
    );
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body).toMatchObject({
      eventType: APP_HANDOFF_LINK_OPENED_EVENT,
      metadata: { handoff_id: HANDOFF_ID },
    });
  });

  it("rejects token-like exact-call handoff IDs before either sink", () => {
    trackExactCallHandoffLinkOpened({
      handoff_id: "shared-campaign-token",
      source: "exact_call",
      handoff_context: "exact_call",
      fallback_classification: "exact",
    });

    expect(track).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the exact-call input type closed", () => {
    const metadata: ExactCallHandoffMetadata = {
      handoff_id: HANDOFF_ID,
      source: "exact_call",
      handoff_context: "exact_call",
      fallback_classification: "exact",
      // @ts-expect-error exact-call metadata does not accept arbitrary keys
      email: "surfer@example.com",
    };

    expect(metadata.source).toBe("exact_call");

    if (false) {
      trackAppHandoffView({
        source: "exact_call",
        // @ts-expect-error exact-call fields cannot use the open legacy emitter
        handoff_context: "exact_call",
      });
    }
  });
});
