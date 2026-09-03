import { render, screen } from "@testing-library/react";

import { StoreDownloadButtons } from "@/components/landing-page/store-download-buttons";

jest.mock("@/components/app-store/native-app-funnel-cta", () => ({
  NativeAppFunnelCta: ({
    desktopClassName,
    desktopShowEmailForm,
    placement,
    surface,
  }: {
    desktopClassName?: string;
    desktopShowEmailForm?: boolean;
    placement: string;
    surface: string;
  }) => (
    <a
      data-testid="funnel-cta"
      data-desktop-class={desktopClassName}
      data-desktop-show-email-form={String(desktopShowEmailForm)}
      data-placement={placement}
      data-surface={surface}
      href="https://www.quiversurf.app/app"
    >
      app cta
    </a>
  ),
}));

describe("StoreDownloadButtons", () => {
  it("renders the device-aware funnel CTA with surface and placement", () => {
    render(
      <StoreDownloadButtons platform="ios" surface="landing" placement="hero" />,
    );

    const cta = screen.getByTestId("funnel-cta");
    expect(cta).toHaveAttribute("data-surface", "landing");
    expect(cta).toHaveAttribute("data-placement", "hero");
  });

  it("passes desktop styling through to the funnel CTA", () => {
    render(
      <StoreDownloadButtons
        platform="desktop"
        surface="download"
        placement="hero"
      />,
    );

    expect(screen.getByTestId("funnel-cta")).toHaveAttribute(
      "data-desktop-class",
      expect.stringContaining("bg-[#EFE5CF]"),
    );
    expect(screen.getByTestId("funnel-cta")).toHaveAttribute(
      "data-desktop-show-email-form",
      "false",
    );
  });

  it("shows a secondary Surfline comparison link when requested", () => {
    render(
      <StoreDownloadButtons
        platform="ios"
        surface="landing"
        placement="hero"
        includeComparison
      />,
    );

    expect(screen.getByTestId("store-download-compare-link")).toHaveAttribute(
      "href",
      "/vs/surfline",
    );
    expect(
      screen.getByRole("link", { name: /compare with surfline/i }),
    ).toBeInTheDocument();
  });

  it("omits the secondary comparison link by default", () => {
    render(
      <StoreDownloadButtons
        platform="android"
        surface="landing"
        placement="hero"
      />,
    );

    expect(screen.queryByTestId("store-download-compare-link")).toBeNull();
  });

  it("applies stacked orientation classes", () => {
    render(
      <StoreDownloadButtons
        platform="desktop"
        surface="download"
        placement="final"
        orientation="stack"
      />,
    );

    expect(screen.getByTestId("store-download-buttons")).toHaveClass(
      "flex-col",
    );
  });
});
