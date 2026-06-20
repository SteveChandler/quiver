import { render, screen, within } from "@testing-library/react";
import type { ImgHTMLAttributes } from "react";

import { QuiverFieldGuideLanding } from "@/components/landing-page/field-guide/quiver-field-guide-landing";

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
  NativeAppFunnelCta: () => (
    <a data-testid="funnel-cta" href="https://www.quiversurf.app/app">
      app cta
    </a>
  ),
}));

describe("QuiverFieldGuideLanding", () => {
  it("renders the landing sections and proof block", () => {
    render(<QuiverFieldGuideLanding platform="ios" />);

    expect(screen.getByTestId("field-guide-hero")).toBeInTheDocument();
    expect(screen.getByTestId("field-guide-spotlight")).toBeInTheDocument();
    expect(screen.getByTestId("field-guide-proof")).toBeInTheDocument();
    expect(screen.getByTestId("field-guide-coverage")).toBeInTheDocument();
    expect(screen.getByTestId("field-guide-inside-app")).toBeInTheDocument();
    expect(
      screen.getByTestId("field-guide-audience-access"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("field-guide-features")).toBeInTheDocument();
    expect(screen.getByTestId("field-guide-walkthrough")).toBeInTheDocument();
    expect(screen.getByTestId("field-guide-final-cta")).toBeInTheDocument();
  });

  it("explains why Quiver is different from a generic surf report", () => {
    render(<QuiverFieldGuideLanding platform="ios" />);

    const walkthrough = screen.getByTestId("field-guide-walkthrough");
    expect(
      within(walkthrough).getByRole("heading", {
        name: /not your average surf report/i,
      }),
    ).toBeInTheDocument();
    expect(walkthrough).toHaveTextContent(
      "a surf brain that actually knows you",
    );
    expect(walkthrough).toHaveTextContent("Free beach reads, not a paywall");
    expect(walkthrough).toHaveTextContent(
      "Decisions shaped around your boards",
    );
    expect(walkthrough).toHaveTextContent(
      "A feedback loop from real sessions",
    );
    expect(walkthrough).not.toHaveTextContent("Get the dawn call");
  });

  it("renders the primary heading and hero CTAs", () => {
    render(<QuiverFieldGuideLanding platform="ios" />);

    expect(
      screen.getByRole("heading", { name: /know where to paddle out/i }),
    ).toBeInTheDocument();
    const hero = screen.getByTestId("field-guide-hero");
    expect(
      within(hero).getByRole("link", { name: "Get the app" }),
    ).toHaveAttribute(
      "href",
      "/download?source=landing_hero&placement=hero&platform=ios",
    );
    expect(
      within(hero).getByRole("link", { name: "Watch demo" }),
    ).toHaveAttribute("href", "#demo");
    expect(screen.getByTestId("funnel-cta")).toBeInTheDocument();
  });

  it("renders the Swell View spotlight CTA", () => {
    render(<QuiverFieldGuideLanding platform="ios" />);

    const spotlight = screen.getByTestId("field-guide-spotlight");
    expect(
      within(spotlight).getByRole("heading", {
        name: /quiver's swell view is here/i,
      }),
    ).toBeInTheDocument();
    expect(
      within(spotlight).getByText("FREE · NEW IN THE APP"),
    ).toBeInTheDocument();
    expect(
      within(spotlight).getByRole("link", { name: "Get the app" }),
    ).toHaveAttribute(
      "href",
      "/download?source=landing_swell_view&placement=spotlight&platform=ios",
    );
  });

  it("uses defensible proof claims", () => {
    render(<QuiverFieldGuideLanding platform="ios" />);

    const proof = screen.getByTestId("field-guide-proof");
    expect(proof).toHaveTextContent("10-day");
    expect(proof).toHaveTextContent("Every 3 hours");
    expect(proof).toHaveTextContent("Sharper calls");
  });

  it("renders coverage and Surfline comparison context", () => {
    render(<QuiverFieldGuideLanding platform="ios" />);

    const coverage = screen.getByTestId("field-guide-coverage");
    expect(coverage).toHaveTextContent("279+");
    expect(coverage).toHaveTextContent("US coasts, Hawaii, Puerto Rico, Baja");
    expect(
      screen.getByRole("link", { name: /vs surfline/i }),
    ).toHaveAttribute("href", "/vs/surfline");
  });

  it("renders the inside-the-app product panel", () => {
    render(<QuiverFieldGuideLanding platform="ios" />);

    const insideApp = screen.getByTestId("field-guide-inside-app");
    expect(insideApp).toHaveTextContent("Inside the app");
    expect(
      screen.getByRole("heading", {
        name: /built for the board you paddle out on/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByAltText(/nearby surf spots and local intel/i),
    ).toHaveAttribute("src", expect.stringContaining("local-intel"));
  });

  it("renders audience and access context", () => {
    render(<QuiverFieldGuideLanding platform="ios" />);

    const audienceAccess = screen.getByTestId("field-guide-audience-access");
    expect(audienceAccess).toHaveTextContent("Dawn patrol regulars");
    expect(audienceAccess).toHaveTextContent(
      "Public forecast data is free forever",
    );
    expect(audienceAccess).toHaveTextContent(
      "Public forecast data is free forever. Upgrade for board-aware picks, smart alerts, custom spots, offline session saving, and personal forecasting that learns from your boards, spots, alerts, and saved sessions.",
    );
    expect(audienceAccess).toHaveTextContent(
      "Public forecast data stays free forever",
    );
    expect(audienceAccess).toHaveTextContent(
      "No paywall for basic beach reads",
    );
    expect(audienceAccess).toHaveTextContent(
      "Pro adds board-aware picks, alerts, custom spots, offline session saving, and personal forecasting",
    );
    expect(audienceAccess).not.toHaveTextContent(
      "14-day App Store trial for Pro",
    );
    expect(
      screen.getByRole("heading", {
        name: /one surf app\. pro when you need the sharper call/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /see plans/i })).toHaveAttribute(
      "href",
      "/plans",
    );
  });

  it("renders Quiver zine stickers", () => {
    const { container } = render(<QuiverFieldGuideLanding platform="ios" />);

    expect(container.querySelector("[data-zine-sticker]")).not.toBeNull();
  });

  it("uses the launch video in the hero media slot", () => {
    const { container } = render(<QuiverFieldGuideLanding platform="ios" />);
    const video = container.querySelector(
      '[data-testid="field-guide-hero-video"] video',
    );

    expect(video).not.toBeNull();
    expect(video).toHaveAttribute("src", "/videos/quiver-landing-hero-720.mp4");
    expect(video).toHaveAttribute(
      "poster",
      "/images/hero/quiver-landing-hero-poster.jpg",
    );
  });

  it("does not render repeated zine masthead rows", () => {
    const { container } = render(<QuiverFieldGuideLanding platform="ios" />);

    expect(container.querySelector(".zine-masthead")).toBeNull();
  });
});
