/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PartnerQrLandingClient } from "@/app/p/[partnerCode]/partner-qr-landing-client";

jest.mock("@/lib/utils/visitor-id", () => ({
  getVisitorId: () => "12345678-1234-1234-1234-123456789012",
}));

jest.mock("@/lib/utils/browser-session-id", () => ({
  getBrowserSessionId: () => "browser-session-1",
}));

jest.mock("@/components/pricing/android-waitlist-cta", () => ({
  AndroidWaitlistCta: ({ children, onClickTrack }: any) => (
    <button type="button" onClick={onClickTrack}>
      {children}
    </button>
  ),
}));

const defaultProps = {
  partnerCode: "SURF12",
  partnerName: "Pacific Surf Co",
  qrUrl:
    "https://www.quiversurf.app/p/SURF12?ref=SURF12&utm_source=partner_qr&utm_medium=partner_qr&utm_campaign=partner_access&utm_content=SURF12",
  appSchemeUrl: "quiver://p/SURF12",
  startPath: "/?ref=SURF12&utm_source=partner_qr&utm_content=SURF12",
  utm: {
    utm_source: "partner_qr",
    utm_medium: "partner_qr",
    utm_campaign: "partner_access",
    utm_content: "SURF12",
  },
};

function setUserAgent(userAgent: string): void {
  Object.defineProperty(window.navigator, "userAgent", {
    value: userAgent,
    configurable: true,
  });
}

function latestEventBody(): any {
  const calls = (fetch as jest.Mock).mock.calls;
  const body = calls[calls.length - 1]?.[1]?.body;
  return JSON.parse(body);
}

function eventBody(eventType: string): any {
  const calls = (fetch as jest.Mock).mock.calls;
  const match = calls
    .map((call) => JSON.parse(call[1]?.body))
    .find((body) => body.eventType === eventType);
  if (!match) {
    throw new Error(`Missing event ${eventType}`);
  }
  return match;
}

function clickWithoutNavigation(element: HTMLElement): void {
  element.addEventListener("click", (event) => event.preventDefault(), {
    once: true,
  });
  fireEvent.click(element);
}

describe("PartnerQrLandingClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;
  });

  it("renders a QR whose value equals the passed qrUrl", () => {
    const { container } = render(<PartnerQrLandingClient {...defaultProps} />);
    const svg = container.querySelector("svg[data-smart-url]");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("data-smart-url", defaultProps.qrUrl);
  });

  it("links App Store clicks with a per-partner campaign token", () => {
    render(<PartnerQrLandingClient {...defaultProps} />);

    const appStoreUrl = new URL(
      screen.getByRole("link", { name: /open app store/i }).getAttribute("href") ??
        "",
    );

    expect(appStoreUrl.searchParams.get("ct")).toBe("partner_SURF12");
    expect(appStoreUrl.searchParams.get("mt")).toBe("8");
  });

  it("fires app_handoff_qr_rendered and invite_link_opened on mount with partner metadata", async () => {
    render(<PartnerQrLandingClient {...defaultProps} />);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    expect(eventBody("invite_link_opened")).toEqual(
      expect.objectContaining({
        eventType: "invite_link_opened",
        sessionId: "12345678-1234-1234-1234-123456789012",
        metadata: expect.objectContaining({
          surface: "partner_landing",
          partner_code: "SURF12",
          browser_session_id: "browser-session-1",
          platform: "desktop",
          utm_source: "partner_qr",
          utm_content: "SURF12",
        }),
      }),
    );
    expect(eventBody("app_handoff_qr_rendered")).toEqual(
      expect.objectContaining({
        eventType: "app_handoff_qr_rendered",
        metadata: expect.objectContaining({
          source: "partner_landing",
          surface: "partner_landing",
          partner_code: "SURF12",
          utm_source: "partner_qr",
          utm_content: "SURF12",
        }),
      }),
    );
  });

  it("tracks App Store and web fallback CTA clicks by destination type", async () => {
    render(<PartnerQrLandingClient {...defaultProps} />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    clickWithoutNavigation(
      screen.getByRole("link", { name: /open app store/i }),
    );
    expect(latestEventBody()).toEqual(
      expect.objectContaining({
        eventType: "invite_app_store_clicked",
        metadata: expect.objectContaining({
          partner_code: "SURF12",
          destination_type: "app_store",
        }),
      }),
    );

    clickWithoutNavigation(
      screen.getByRole("link", { name: /continue on web/i }),
    );
    expect(latestEventBody()).toEqual(
      expect.objectContaining({
        eventType: "invite_continue_web_clicked",
        metadata: expect.objectContaining({
          partner_code: "SURF12",
          destination_type: "web_signup",
        }),
      }),
    );
  });

  it("fires invite_open_app_clicked with the quiver://p scheme href", async () => {
    render(<PartnerQrLandingClient {...defaultProps} />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    const openApp = screen.getByRole("link", { name: /already have the app/i });
    expect(openApp).toHaveAttribute("href", "quiver://p/SURF12");

    clickWithoutNavigation(openApp);
    expect(latestEventBody()).toEqual(
      expect.objectContaining({
        eventType: "invite_open_app_clicked",
        metadata: expect.objectContaining({
          partner_code: "SURF12",
          destination_type: "app_scheme",
        }),
      }),
    );
  });

  it("shows Android beta CTA and tracks it as a partner destination", async () => {
    setUserAgent("Mozilla/5.0 (Linux; Android 14)");
    render(<PartnerQrLandingClient {...defaultProps} />);

    const androidCta = await screen.findByRole("button", {
      name: /get the android beta/i,
    });
    fireEvent.click(androidCta);

    expect(latestEventBody()).toEqual(
      expect.objectContaining({
        eventType: "invite_app_store_clicked",
        metadata: expect.objectContaining({
          platform: "android",
          destination_type: "android_waitlist",
          partner_code: "SURF12",
        }),
      }),
    );
  });
});
