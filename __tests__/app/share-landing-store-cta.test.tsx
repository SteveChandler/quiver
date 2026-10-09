import { fireEvent, render, screen } from "@testing-library/react";

import { ShareLandingOpenAppLink } from "@/app/app/spot/[slug]/share-landing-open-app-link";
import { ShareLandingStoreCta } from "@/app/app/spot/[slug]/share-landing-store-cta";
import { ShareLinkOpenTracker } from "@/app/app/spot/[slug]/share-link-open-tracker";
import { track } from "@/lib/analytics";

jest.mock("@/lib/analytics", () => ({ track: jest.fn() }));
jest.mock("@/lib/posthog-client", () => ({
  getClientPostHogDistinctId: jest.fn(() => undefined),
}));

const SHARE_ID = "7c1d7f4e-2b6a-4a57-9a5e-3d8f0b2f6a11";
const fetchMock = jest.fn(() => Promise.resolve({ ok: true }));

interface UserEventBody {
  eventType: string;
  metadata: Record<string, unknown>;
}

function userEventBodies(): UserEventBody[] {
  return (fetchMock.mock.calls as unknown[][])
    .filter(([url]) => url === "/api/events")
    .map(([, init]) => JSON.parse((init as { body: string }).body));
}

function clickBodies(): UserEventBody[] {
  return userEventBodies().filter((body) => body.eventType === "cta_click");
}

describe("share landing store CTA", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
  });

  it("tags the handoff and the click row with the share campaign and share id", () => {
    render(<ShareLandingStoreCta shareId={SHARE_ID} isShareLink />);
    const link = screen.getByRole("link", { name: /open app store/i });

    fireEvent.click(link);

    const href = new URL(link.getAttribute("href")!);
    expect(href.origin + href.pathname).toBe(
      "https://go.quiversurf.app/app/handoff",
    );
    expect(href.searchParams.get("source")).toBe("share_landing");
    expect(href.searchParams.get("utm_source")).toBe("share");
    expect(href.searchParams.get("utm_medium")).toBe("link");
    expect(href.searchParams.get("utm_campaign")).toBe("share");
    expect(href.searchParams.get("utm_content")).toBe(SHARE_ID);
    expect(href.searchParams.get("handoff_id")).toMatch(/^[0-9a-f-]{36}$/);

    const [click] = clickBodies();
    expect(click.metadata).toEqual(
      expect.objectContaining({
        cta_family: "ios_app",
        utm_campaign: "share",
        utm_content: SHARE_ID,
        share_id: SHARE_ID,
        handoff_id: href.searchParams.get("handoff_id"),
      }),
    );
  });

  it("still counts a share tap when the link has no share id", () => {
    render(<ShareLandingStoreCta shareId={null} isShareLink />);
    const link = screen.getByRole("link", { name: /open app store/i });

    fireEvent.click(link);

    const href = new URL(link.getAttribute("href")!);
    expect(href.searchParams.get("utm_campaign")).toBe("share");
    expect(href.searchParams.has("utm_content")).toBe(false);
    expect(clickBodies()[0].metadata).not.toHaveProperty("share_id");
  });

  it("keeps exact-call retries on the web campaign", () => {
    render(<ShareLandingStoreCta shareId={SHARE_ID} isShareLink={false} />);
    const link = screen.getByRole("link", { name: /open app store/i });

    fireEvent.click(link);

    const href = new URL(link.getAttribute("href")!);
    expect(href.searchParams.get("source")).toBe("app_spot_handoff");
    expect(href.searchParams.has("utm_campaign")).toBe(false);
    expect(href.searchParams.has("utm_content")).toBe(false);
    expect(clickBodies()[0].metadata).not.toHaveProperty("share_id");
  });

  it("records an Open in Quiver tap outside the ios_app click family", () => {
    render(
      <ShareLandingOpenAppLink
        href="https://go.quiversurf.app/app/spot/blacks?sid=x&o=1"
        shareId={SHARE_ID}
      >
        Open in Quiver
      </ShareLandingOpenAppLink>,
    );

    fireEvent.click(screen.getByRole("link", { name: /open in quiver/i }));

    const [click] = clickBodies();
    expect(click.metadata).toEqual(
      expect.objectContaining({
        cta_family: "share_landing_open_app",
        share_id: SHARE_ID,
      }),
    );
    expect(click.metadata.cta_family).not.toBe("ios_app");
    expect(click.metadata).not.toHaveProperty("utm_campaign");
  });
});

describe("share link open tracker", () => {
  beforeEach(() => jest.clearAllMocks());

  it("fires for a beach share that carries only a share id", () => {
    render(
      <ShareLinkOpenTracker
        slug="blacks"
        windowValue={null}
        shareId={SHARE_ID}
        host="www.quiversurf.app"
      />,
    );

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith(
      "share_link_opened",
      expect.objectContaining({
        share_id: SHARE_ID,
        target_type: "beach",
        target_id: "blacks",
        viewer_context: "web_landing",
        host: "www.quiversurf.app",
      }),
      { includeAttribution: false },
    );
  });

  it("adds the share id and context to a window open", () => {
    render(
      <ShareLinkOpenTracker
        slug="blacks"
        windowValue="2026-06-03T14:30:00.000Z"
        shareId={SHARE_ID}
      />,
    );

    expect(track).toHaveBeenCalledWith(
      "share_link_opened",
      expect.objectContaining({
        share_id: SHARE_ID,
        target_type: "forecast_window",
        selected_forecast_at: "2026-06-03T14:30:00.000Z",
        viewer_context: "web_landing",
      }),
      { includeAttribution: false },
    );
  });

  it("does not fire for a visit with neither a share id nor a window", () => {
    render(<ShareLinkOpenTracker slug="blacks" windowValue={null} />);

    expect(track).not.toHaveBeenCalled();
  });

  it("does not count the go-host hop after Open in Quiver a second time", () => {
    render(
      <ShareLinkOpenTracker
        slug="blacks"
        windowValue={null}
        shareId={SHARE_ID}
        isSecondHop
      />,
    );

    expect(track).not.toHaveBeenCalled();
  });
});
