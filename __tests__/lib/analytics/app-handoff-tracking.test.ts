import {
  APP_HANDOFF_VIEW_EVENT,
  trackAppHandoffEmailSubmit,
  trackAppHandoffView,
} from "@/lib/analytics/app-handoff-tracking";

jest.mock("@/lib/analytics", () => ({ track: jest.fn() }));
import { track } from "@/lib/analytics";

describe("app-handoff-tracking", () => {
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
      trackAppHandoffView({
        source: "exact_call",
        handoff_context: "exact_call",
        fallback_classification: "exact",
      })
    ).not.toThrow();
  });
});
