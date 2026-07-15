import { render, screen } from "@testing-library/react";

import { PlatformStatusStrip } from "@/components/landing-page/platform-status-strip";

jest.mock("@/components/app-store/native-app-funnel-cta", () => ({
  NativeAppFunnelCta: ({
    platform,
    source,
    surface,
    placement,
    cohort,
  }: {
    platform: string;
    source: string;
    surface: string;
    placement: string;
    cohort?: string;
  }) => (
    <button
      type="button"
      data-testid="native-app-funnel-cta"
      data-platform={platform}
      data-source={source}
      data-surface={surface}
      data-placement={placement}
      data-cohort={cohort}
    >
      {platform === "android" ? "Get the Android beta" : "Open App Store"}
    </button>
  ),
}));

describe("PlatformStatusStrip", () => {
  it("renders the mobile visitor's native action with app-first attribution", () => {
    render(<PlatformStatusStrip platform="android" />);

    expect(
      screen.getByText(/iphone is live\. android beta is open\./i),
    ).toBeInTheDocument();

    const cta = screen.getByTestId("native-app-funnel-cta");
    expect(cta).toHaveAttribute("data-platform", "android");
    expect(cta).toHaveAttribute("data-source", "landing_platform_strip");
    expect(cta).toHaveAttribute("data-surface", "landing-page");
    expect(cta).toHaveAttribute("data-placement", "platform_strip");
    expect(cta).toHaveAttribute("data-cohort", "app_first");
    expect(
      screen.getByText(/personalized surf decisions.*best window/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/free year|year of pro/i)).not.toBeInTheDocument();
  });

  it("keeps desktop visitors focused on the QR and email handoff", () => {
    render(<PlatformStatusStrip platform="desktop" />);

    expect(screen.queryByTestId("native-app-funnel-cta")).not.toBeInTheDocument();
    expect(screen.getByText(/scan the qr or send the link/i)).toBeInTheDocument();
  });
});
