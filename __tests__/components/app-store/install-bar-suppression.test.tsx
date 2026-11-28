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

beforeEach(() => {
  pathname = "/ca/san-diego/blacks";
});

describe("IphoneAppBannerGate", () => {
  it("drops the banner on a bar page", async () => {
    setUserAgent(IPHONE_CHROME_UA);
    render(<IphoneAppBannerGate />);
    await act(async () => {});

    expect(screen.queryByTestId("iphone-app-banner")).not.toBeInTheDocument();
  });

  it("keeps the banner on pages the bar does not run on", async () => {
    setUserAgent(IPHONE_CHROME_UA);
    pathname = "/forecast";
    render(<IphoneAppBannerGate />);

    await waitFor(() => expect(screen.getByTestId("iphone-app-banner")).toBeInTheDocument());
  });
});

describe("HideWhenInstallBarOwns", () => {
  const child = <div data-testid="handoff">in-page ask</div>;

  it("renders its child on the server, so CDN HTML is unchanged", () => {
    setUserAgent(IPHONE_SAFARI_UA);

    expect(renderToStaticMarkup(<HideWhenInstallBarOwns>{child}</HideWhenInstallBarOwns>)).toContain("in-page ask");
  });

  it("hides the child for bar iPhone visitors after mount", async () => {
    setUserAgent(IPHONE_SAFARI_UA);
    render(<HideWhenInstallBarOwns>{child}</HideWhenInstallBarOwns>);
    await act(async () => {});

    expect(screen.queryByTestId("handoff")).not.toBeInTheDocument();
  });

  it("keeps the child for Android", async () => {
    setUserAgent(ANDROID_UA);
    render(<HideWhenInstallBarOwns>{child}</HideWhenInstallBarOwns>);
    await act(async () => {});

    expect(screen.getByTestId("handoff")).toBeInTheDocument();
  });
});

describe("BeachDetailInstallCta under the bar", () => {
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
    setUserAgent(userAgent);
    render(cta());
    await act(async () => {});

    expect(screen.queryByTestId("install-app-cta")).not.toBeInTheDocument();
  });

  it("still shows it on Android", async () => {
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

describe("after the cam install sheet claims the visit", () => {
  const { openInstallAskClaim, resetInstallAskClaimForTests } = jest.requireActual<
    typeof import("@/lib/app-store/install-ask-claim")
  >("@/lib/app-store/install-ask-claim");
  const RealSection = jest.requireActual<{ InstallAppCtaSection: typeof InstallAppCtaSection }>(
    "@/components/app-store/install-app-cta-section",
  ).InstallAppCtaSection;

  beforeEach(() => {
    window.sessionStorage.clear();
    resetInstallAskClaimForTests();
  });

  it("drops the iPhone banner off bar pages too", async () => {
    setUserAgent(IPHONE_CHROME_UA);
    pathname = "/forecast";
    render(<IphoneAppBannerGate />);
    await waitFor(() => expect(screen.getByTestId("iphone-app-banner")).toBeInTheDocument());

    act(() => openInstallAskClaim());
    expect(screen.queryByTestId("iphone-app-banner")).not.toBeInTheDocument();
  });

  it("drops the in-page handoff CTA for every platform", async () => {
    document.body.innerHTML = "";
    setUserAgent(ANDROID_UA);
    render(
      <>
        <ContentPageAppHandoffCta
          source="s"
          surface="beach_detail"
          placement="p"
          target="beach:blacks"
          eyebrow="e"
          title="t"
          description="d"
          ctaLabel="c"
        />
      </>,
    );
    await act(async () => {});
    expect(document.querySelector('[data-testid^="content-page-app-handoff-cta"]')).not.toBeNull();

    act(() => openInstallAskClaim());
    expect(document.querySelector('[data-testid^="content-page-app-handoff-cta"]')).toBeNull();
  });

  it("server-renders the in-page asks unchanged, so CDN HTML never depends on the visit", () => {
    window.sessionStorage.setItem("quiver_install_ask_claimed_v1", "cam_install_sheet");
    const html = renderToStaticMarkup(
      <RealSection platform="ios" source="s" surface="beach-detail" placement="after-tabs" />,
    );
    expect(html).toContain('aria-label="Get the Quiver app"');
  });
});
