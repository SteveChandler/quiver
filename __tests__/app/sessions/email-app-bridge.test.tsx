/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import {
  buildSessionEmailWebSignInUrl,
  buildSessionNativeAppUrl,
  EmailSessionAppBridge,
  isSessionEmailAppBridgeRequest,
} from "@/app/sessions/new/email-app-bridge";

describe("email session app bridge", () => {
  const emailParams = new URLSearchParams({
    entrySource: "email",
    utm_source: "manual_test",
    utm_medium: "email",
    utm_campaign: "email_attribution_validation",
    email_type: "manual_attribution_test",
    message_instance_id: "manual-email-attribution-20260708-1015",
    beachId: "mission-beach",
  });

  it("detects email-attributed session links", () => {
    expect(isSessionEmailAppBridgeRequest(emailParams)).toBe(true);
    expect(isSessionEmailAppBridgeRequest(new URLSearchParams("mode=log"))).toBe(false);
    expect(
      isSessionEmailAppBridgeRequest(new URLSearchParams("utm_campaign=launch"))
    ).toBe(false);
  });

  it("builds a native sessions/new URL with attribution preserved", () => {
    const appUrl = buildSessionNativeAppUrl(emailParams);
    const url = new URL(appUrl);

    expect(url.protocol).toBe("quiver:");
    expect(url.hostname).toBe("sessions");
    expect(url.pathname).toBe("/new");
    expect(url.searchParams.get("entrySource")).toBe("email");
    expect(url.searchParams.get("native_handoff")).toBe("web_email_bridge");
    expect(url.searchParams.get("email_type")).toBe("manual_attribution_test");
    expect(url.searchParams.get("message_instance_id")).toBe(
      "manual-email-attribution-20260708-1015"
    );
    expect(url.searchParams.get("beachId")).toBe("mission-beach");
  });

  it("builds a web sign-in fallback that preserves the session redirect", () => {
    const signInUrl = buildSessionEmailWebSignInUrl(emailParams);
    const url = new URL(signInUrl, "https://www.quiversurf.app");

    expect(url.pathname).toBe("/auth/sign-in");
    expect(url.searchParams.get("redirectTo")).toContain("/sessions/new?");
    expect(url.searchParams.get("redirectTo")).toContain("email_type=manual_attribution_test");
  });

  it("renders app and web fallback CTAs for unauthenticated email clicks", () => {
    render(
      <EmailSessionAppBridge
        appUrl="quiver://sessions/new?entrySource=email"
        signInUrl="/auth/sign-in?redirectTo=%2Fsessions%2Fnew"
        isAuthenticated={false}
        onContinueWeb={jest.fn()}
        autoAttempt={false}
      />
    );

    expect(
      screen.getByRole("link", { name: /open quiver app/i })
    ).toHaveAttribute("href", "quiver://sessions/new?entrySource=email");
    expect(
      screen.getByRole("link", { name: /continue on web/i })
    ).toHaveAttribute("href", "/auth/sign-in?redirectTo=%2Fsessions%2Fnew");
  });

  it("lets authenticated web users continue to the web session form", () => {
    const onContinueWeb = jest.fn();

    render(
      <EmailSessionAppBridge
        appUrl="quiver://sessions/new?entrySource=email"
        signInUrl="/auth/sign-in?redirectTo=%2Fsessions%2Fnew"
        isAuthenticated
        onContinueWeb={onContinueWeb}
        autoAttempt={false}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /continue on web/i }));
    expect(onContinueWeb).toHaveBeenCalledTimes(1);
  });
});
