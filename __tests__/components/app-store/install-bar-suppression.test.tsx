import { act, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server.node";

import { BeachDetailInstallCta } from "@/components/app-store/beach-detail-install-cta";
import { IphoneAppBannerGate } from "@/components/app-store/iphone-app-banner-gate";
import { HideWhenInstallBarOwns } from "@/components/app-store/install-bar-owned-slot";
import { ContentPageAppHandoffCta } from "@/components/app-store/content-page-app-handoff-cta";
import { InstallAppCtaSection } from "@/components/app-store/install-app-cta-section";
import { INSTALL_ASK_SELECTORS } from "@/lib/app-store/install-bar";

let pathname = "/ca/san-diego/blacks";
jest.mock("next/navigation", () => ({ usePathname: () => pathname }));
jest.mock("@/components/app-store/iphone-app-banner", () => ({
  IphoneAppBanner: () => <div data-testid="iphone-app-banner" />,
}));
jest.mock("@/components/app-store/install-app-cta-section", () => ({
  InstallAppCtaSection: () => <div data-testid="install-app-cta" />,
}));

const IPHONE_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

function setUserAgent(userAgent: string): void {
  Object.defineProperty(window.navigator, "userAgent", { configurable: true, value: userAgent });
}

const ORIGINAL_FLAG = process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED;

beforeEach(() => {
  pathname = "/ca/san-diego/blacks";
});

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED;
  else process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED = ORIGINAL_FLAG;
});

describe("IphoneAppBannerGate", () => {
  it("shows the banner for non-Safari iPhone when the bar is off", async () => {
    delete process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED;
    setUserAgent(IPHONE_CHROME_UA);
    render(<IphoneAppBannerGate />);

    await waitFor(() => expect(screen.getByTestId("iphone-app-banner")).toBeInTheDocument());
  });

  it("drops the banner on a bar page when the bar is on", async () => {
    process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED = "true";
    setUserAgent(IPHONE_CHROME_UA);
    render(<IphoneAppBannerGate />);
    await act(async () => {});

    expect(screen.queryByTestId("iphone-app-banner")).not.toBeInTheDocument();
  });

  it("keeps the banner on pages the bar does not run on", async () => {
    process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED = "true";
    setUserAgent(IPHONE_CHROME_UA);
    pathname = "/forecast";
    render(<IphoneAppBannerGate />);

    await waitFor(() => expect(screen.getByTestId("iphone-app-banner")).toBeInTheDocument());
  });
});

describe("HideWhenInstallBarOwns", () => {
  const child = <div data-testid="handoff">in-page ask</div>;

  it("renders its child on the server, so CDN HTML is unchanged", () => {
    process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED = "true";
    setUserAgent(IPHONE_SAFARI_UA);

    expect(renderToStaticMarkup(<HideWhenInstallBarOwns>{child}</HideWhenInstallBarOwns>)).toContain("in-page ask");
  });

  it("hides the child for bar iPhone visitors after mount", async () => {
    process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED = "true";
    setUserAgent(IPHONE_SAFARI_UA);
    render(<HideWhenInstallBarOwns>{child}</HideWhenInstallBarOwns>);
    await act(async () => {});

    expect(screen.queryByTestId("handoff")).not.toBeInTheDocument();
  });

  it.each([
    ["Android with the bar on", ANDROID_UA, "true"],
    ["iPhone with the bar off", IPHONE_SAFARI_UA, undefined],
  ])("keeps the child for %s", async (_name, userAgent, flag) => {
    if (flag === undefined) delete process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED;
    else process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED = flag;
    setUserAgent(userAgent);
    render(<HideWhenInstallBarOwns>{child}</HideWhenInstallBarOwns>);
    await act(async () => {});

    expect(screen.getByTestId("handoff")).toBeInTheDocument();
  });
});

describe("BeachDetailInstallCta with the bar on", () => {
  function cta() {
    return (
      <BeachDetailInstallCta
        pathname="/ca/san-diego/blacks"
        source="beach-detail-blacks"
        beachName="Blacks"
      />
    );
  }

  it.each([
    ["iPhone Safari", IPHONE_SAFARI_UA],
    ["iPhone Chrome", IPHONE_CHROME_UA],
  ])("hides the in-page install section on %s", async (_name, userAgent) => {
    process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED = "true";
    setUserAgent(userAgent);
    render(cta());
    await act(async () => {});

    expect(screen.queryByTestId("install-app-cta")).not.toBeInTheDocument();
  });

  it("still shows it on Android", async () => {
    process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED = "true";
    setUserAgent(ANDROID_UA);
    render(cta());

    await waitFor(() => expect(screen.getByTestId("install-app-cta")).toBeInTheDocument());
  });
});

describe("install ask selectors", () => {
  it("match the real components the bar yields to", () => {
    const ContentCta = ContentPageAppHandoffCta;
    const Section = jest.requireActual<{ InstallAppCtaSection: typeof InstallAppCtaSection }>(
      "@/components/app-store/install-app-cta-section",
    ).InstallAppCtaSection;

    const html =
      renderToStaticMarkup(
        <Section platform="ios" source="s" surface="beach-detail" placement="after-tabs" />,
      ) +
      renderToStaticMarkup(
        <ContentCta
          source="s"
          surface="beach_detail"
          placement="p"
          target="beach:blacks"
          eyebrow="e"
          title="t"
          description="d"
          ctaLabel="c"
        />,
      );
    document.body.innerHTML = html;

    for (const selector of INSTALL_ASK_SELECTORS) {
      expect(document.querySelector(selector)).not.toBeNull();
    }
  });
});
