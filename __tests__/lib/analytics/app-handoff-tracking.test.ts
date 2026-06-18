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
});
