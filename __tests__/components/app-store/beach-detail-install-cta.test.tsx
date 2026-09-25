import { renderToStaticMarkup } from "react-dom/server.node";
import { render, screen, waitFor } from "@testing-library/react";

import { BeachDetailInstallCta } from "@/components/app-store/beach-detail-install-cta";

jest.mock("@/components/app-store/install-app-cta-section", () => ({
  InstallAppCtaSection: () => <div data-testid="install-app-cta" />,
}));

const IPHONE_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

function setUserAgent(userAgent: string): void {
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: userAgent,
  });
}

function cta() {
  return (
    <BeachDetailInstallCta
      pathname="/ca/san-diego/blacks"
      source="beach-detail-blacks"
      beachName="Blacks"
    />
  );
}

describe("BeachDetailInstallCta", () => {
  it("server-renders nothing, so the CDN-shared HTML is the same for every visitor", () => {
    setUserAgent(IPHONE_SAFARI_UA);

    expect(renderToStaticMarkup(cta())).toBe("");
  });

  it.each([
    ["iPhone Safari", IPHONE_SAFARI_UA],
    ["Android Chrome", ANDROID_CHROME_UA],
  ])("shows the install section after mount on %s", async (_name, userAgent) => {
    setUserAgent(userAgent);
    render(cta());

    await waitFor(() => {
      expect(screen.getByTestId("install-app-cta")).toBeInTheDocument();
    });
  });

  it("leaves the install ask to IphoneAppBanner on non-Safari iPhone", async () => {
    setUserAgent(IPHONE_CHROME_UA);
    render(cta());

    await waitFor(() => {
      expect(screen.queryByTestId("install-app-cta")).not.toBeInTheDocument();
    });
  });
});
