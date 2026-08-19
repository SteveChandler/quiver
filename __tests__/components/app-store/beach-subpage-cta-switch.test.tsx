import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server.node";
import { render, screen, waitFor } from "@testing-library/react";

import { BeachSubPageCtaSwitch } from "@/components/app-store/beach-subpage-cta-switch";

jest.mock("@/components/app-store/install-app-cta-section", () => ({
  InstallAppCtaSection: () => <div data-testid="install-app-cta" />,
}));

jest.mock("@/components/seo/alert-capture-cta", () => ({
  AlertCaptureCta: () => <div data-testid="alert-capture-cta" />,
}));

jest.mock("@/components/ui/sticky-signup-bar", () => ({
  StickySignupBar: () => <div data-testid="sticky-signup-bar" />,
}));

const IPHONE_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1";
const DESKTOP_SAFARI_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

function setUserAgent(userAgent: string): void {
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: userAgent,
  });
}

function createSwitch(installCtaEnabled = true): ReactElement {
  return (
    <BeachSubPageCtaSwitch
      beachName="Blacks"
      installCtaEnabled={installCtaEnabled}
      pathname="/ca/san-diego/blacks/tides"
      placement="tides-blacks"
      searchReferralCta={{
        ctaText: "Get Tide Alerts",
        supportingText: "Know when the tide is right at Blacks",
      }}
      source="tides-blacks"
      stickyCtaText="Get Alerts"
      stickySupportingText="Tide alerts for Blacks"
    >
      <div data-testid="middle-content" />
    </BeachSubPageCtaSwitch>
  );
}

describe("BeachSubPageCtaSwitch", () => {
  it("server-renders the sticky signup path with no inline alert CTA", () => {
    setUserAgent(IPHONE_SAFARI_UA);

    const markup = renderToStaticMarkup(createSwitch());

    expect(markup).not.toContain('data-testid="alert-capture-cta"');
    expect(markup).toContain('data-testid="sticky-signup-bar"');
    expect(markup).not.toContain('data-testid="install-app-cta"');
  });

  it("shows only the install CTA for iOS Safari after client detection", async () => {
    setUserAgent(IPHONE_SAFARI_UA);
    render(createSwitch());

    await waitFor(() => {
      expect(screen.getByTestId("install-app-cta")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("alert-capture-cta")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sticky-signup-bar")).not.toBeInTheDocument();
  });

  it.each([
    ["desktop Safari", DESKTOP_SAFARI_UA],
    ["non-Safari iPhone", IPHONE_CHROME_UA],
  ])("keeps the sticky signup path and no inline alert CTA for %s", async (_name, userAgent) => {
    setUserAgent(userAgent);
    render(createSwitch());

    await waitFor(() => {
      expect(screen.queryByTestId("alert-capture-cta")).not.toBeInTheDocument();
      expect(screen.getByTestId("sticky-signup-bar")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("install-app-cta")).not.toBeInTheDocument();
  });

  it("keeps the server-default path when the install flag is off", async () => {
    setUserAgent(IPHONE_SAFARI_UA);
    render(createSwitch(false));

    await waitFor(() => {
      expect(screen.queryByTestId("alert-capture-cta")).not.toBeInTheDocument();
      expect(screen.getByTestId("sticky-signup-bar")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("install-app-cta")).not.toBeInTheDocument();
  });
});
