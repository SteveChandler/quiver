import {
  APP_HANDOFF_LINK_OPENED_EVENT,
  APP_HANDOFF_VIEW_EVENT,
  type AppHandoffMetadata,
  type ExactCallHandoffMetadata,
  trackAppHandoffEmailSubmit,
  trackAppHandoffLinkOpened,
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

  it("preserves the exact pre-BFR metadata keys for a legacy handoff view", () => {
    trackAppHandoffView({
      source: "landing_hero",
      surface: "landing-page",
      placement: "hero_primary",
      handoff_id: HANDOFF_ID,
      platform: "desktop",
    });

    const postHogMetadata = (track as jest.Mock).mock.calls[0][1];
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    const expectedKeys = [
      "cta_family",
      "handoff_id",
      "page_type",
      "placement",
      "platform",
      "query_intent",
      "seo_landing_page",
      "source",
      "surface",
      "viewport_width",
    ];

    expect(Object.keys(postHogMetadata).sort()).toEqual(expectedKeys);
    expect(Object.keys(body.metadata).sort()).toEqual(expectedKeys);
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

  it("rejects source-only exact-call metadata before either legacy sink", () => {
    trackAppHandoffLinkOpened({
      source: "exact_call",
      email: "surfer@example.com",
      lat: 32.1,
      handoff_token: "secret",
    } as unknown as AppHandoffMetadata);

    expect(track).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps legitimate legacy link-open sources unchanged", () => {
    trackAppHandoffLinkOpened({
      source: "landing_hero",
      surface: "landing-page",
      placement: "hero_primary",
    });

    expect(track).toHaveBeenCalledWith(
      APP_HANDOFF_LINK_OPENED_EVENT,
      expect.objectContaining({ source: "landing_hero" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/events",
      expect.objectContaining({ method: "POST" }),
    );
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

  it("rejects an impossible classification and reason pair before both sinks", () => {
    trackExactCallHandoffLinkOpened({
      handoff_id: HANDOFF_ID,
      source: "exact_call",
      handoff_context: "exact_call",
      fallback_classification: "exact",
      reason: "expired",
    } as unknown as ExactCallHandoffMetadata);

    expect(track).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects the shared mixed-case handoff fixture before both sinks", () => {
    trackExactCallHandoffLinkOpened({
      handoff_id: "AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE",
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

    const impossiblePair: ExactCallHandoffMetadata = {
      handoff_id: HANDOFF_ID,
      source: "exact_call",
      handoff_context: "exact_call",
      fallback_classification: "exact",
      // @ts-expect-error exact classifications never carry a reason
      reason: "expired",
    };

    expect(impossiblePair.fallback_classification).toBe("exact");

    if (false) {
      // @ts-expect-error exact-call sources must use the dedicated emitter
      trackAppHandoffLinkOpened({ source: "exact_call" });

      trackAppHandoffView({
        source: "exact_call",
        // @ts-expect-error exact-call fields cannot use the open legacy emitter
        handoff_context: "exact_call",
      });
    }
  });
});
