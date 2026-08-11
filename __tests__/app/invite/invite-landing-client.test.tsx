/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { InviteLandingClient } from "@/app/invite/[token]/invite-landing-client";
import { IOS_APP_STORE_WEB_REDIRECT_PATH } from "@/lib/constants/app-store";

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
  token: "raw-token",
  tokenHash: "hashed-token",
  inviteUrl: "https://www.quiversurf.app/invite/raw-token",
  startPath: "/invite/start?token=raw-token",
  inviter: {
    id: "inviter-id",
    displayName: "Kai",
    avatarUrl: null,
  },
  utm: {
    utm_source: "quiver_native",
    utm_medium: "share",
    utm_campaign: "invite_access",
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

describe("InviteLandingClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;
  });

  it("renders invite acquisition CTAs and tracks the invite open without raw token metadata", async () => {
    render(<InviteLandingClient {...defaultProps} />);

    expect(
      screen.getByRole("heading", {
        name: /Kai invited you to their surf crew/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open app store/i }),
    ).toHaveAttribute("href", IOS_APP_STORE_WEB_REDIRECT_PATH);
    expect(
      screen.getByRole("link", { name: /already have the app/i }),
    ).toHaveAttribute("href", "quiver://invite/raw-token");
    expect(
      screen.getByRole("link", { name: /continue on web/i }),
    ).toHaveAttribute("href", "/invite/start?token=raw-token");

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(eventBody("invite_link_opened")).toEqual(
      expect.objectContaining({
        eventType: "invite_link_opened",
        sessionId: "12345678-1234-1234-1234-123456789012",
        metadata: expect.objectContaining({
          token_hash: "hashed-token",
          inviter_id: "inviter-id",
          surface: "invite_landing",
          browser_session_id: "browser-session-1",
          platform: "desktop",
          utm_source: "quiver_native",
        }),
      }),
    );
    expect(eventBody("app_handoff_qr_rendered")).toEqual(
      expect.objectContaining({
        eventType: "app_handoff_qr_rendered",
        metadata: expect.objectContaining({
          source: "invite_landing",
          surface: "invite_landing",
          placement: "desktop_invite_qr",
          qr_id: "invite_desktop_qr",
          token_hash: "hashed-token",
        }),
      }),
    );
    expect(
      JSON.stringify(eventBody("invite_link_opened").metadata),
    ).not.toContain("raw-token");
    expect(
      JSON.stringify(eventBody("app_handoff_qr_rendered").metadata),
    ).not.toContain("raw-token");
  });

  it("tracks App Store and web fallback CTA clicks by destination type", async () => {
    render(<InviteLandingClient {...defaultProps} />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    clickWithoutNavigation(
      screen.getByRole("link", { name: /open app store/i }),
    );
    expect(latestEventBody()).toEqual(
      expect.objectContaining({
        eventType: "invite_app_store_clicked",
        metadata: expect.objectContaining({
          token_hash: "hashed-token",
          destination_type: "app_store",
          attribution_scope: "app_store_click_only",
          post_install_invite_consumption: false,
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
          token_hash: "hashed-token",
          destination_type: "web_signup",
        }),
      }),
    );
  });

  it("shows Android beta CTA and tracks it as an invite destination", async () => {
    setUserAgent("Mozilla/5.0 (Linux; Android 14)");
    render(<InviteLandingClient {...defaultProps} />);

    expect(
      await screen.findByText(/Android beta access is open/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Open the iPhone app/i)).not.toBeInTheDocument();

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
        }),
      }),
    );
  });
});
