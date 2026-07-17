import { render, screen } from "@testing-library/react";
import type { ImgHTMLAttributes } from "react";

import { DownloadView } from "@/components/download/download-view";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    fill: _fill,
    priority: _priority,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
  }) => {
    // eslint-disable-next-line jsx-a11y/alt-text -- mirrors the project-level next/image test mock
    return <img {...props} />;
  },
}));

jest.mock("@/components/app-store/native-app-funnel-cta", () => ({
  NativeAppFunnelCta: ({ surface }: { surface: string }) => (
    <a
      data-testid="funnel-cta"
      data-surface={surface}
      href="https://www.quiversurf.app/app"
    >
      app cta
    </a>
  ),
}));

describe("DownloadView", () => {
  it("renders the download hero heading", () => {
    render(<DownloadView platform="ios" />);

    expect(
      screen.getByRole("heading", { name: /get quiver for your phone/i }),
    ).toBeInTheDocument();
  });

  it("renders download-surface CTAs", () => {
    render(<DownloadView platform="ios" />);

    expect(screen.getAllByTestId("funnel-cta")[0]).toHaveAttribute(
      "data-surface",
      "download",
    );
  });

  it("links to the Surfline comparison page", () => {
    render(<DownloadView platform="ios" />);

    expect(screen.getAllByTestId("store-download-compare-link")[0]).toHaveAttribute(
      "href",
      "/vs/surfline",
    );
  });

  it("shows the app chapters", () => {
    render(<DownloadView platform="ios" />);

    expect(
      screen.getByRole("heading", { name: /honest surf forecasts/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /find the right window/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /build your field notes/i }),
    ).toBeInTheDocument();
  });

  it("describes immediate Android beta value without a tester incentive", () => {
    const { container } = render(<DownloadView platform="android" />);

    expect(
      screen.getByText(/personalized surf decisions.*saved spots.*alerts/i),
    ).toBeInTheDocument();
    expect(container.textContent ?? "").not.toMatch(
      /free year|year of (?:quiver )?pro|queue priority/i,
    );
  });

  it("does not render repeated zine masthead rows", () => {
    const { container } = render(<DownloadView platform="ios" />);

    expect(container.querySelector(".zine-masthead")).toBeNull();
  });
});
