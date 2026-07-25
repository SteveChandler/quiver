import { fireEvent, render, screen, within } from "@testing-library/react";
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

  it("renders the Swell View spotlight without a duplicate CTA", () => {
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
    // The spotlight no longer repeats the hero's "Get the app" CTA.
    expect(
      within(spotlight).queryByRole("link", { name: "Get the app" }),
    ).not.toBeInTheDocument();
  });

  it("renders community testimonials from real surfer feedback", () => {
    render(<QuiverFieldGuideLanding platform="ios" />);

    const community = screen.getByTestId("field-guide-community");
    expect(
      within(community).getByRole("heading", {
        name: /recent check-ins from the community/i,
      }),
    ).toBeInTheDocument();
    expect(community).toHaveTextContent(/swell direction, interval, and wind/i);
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
    ).toHaveAttribute("src", expect.stringContaining("local-intel-720.webp"));
  });

  it("renders audience and access context", () => {
    render(<QuiverFieldGuideLanding platform="ios" />);

    const audienceAccess = screen.getByTestId("field-guide-audience-access");
    expect(audienceAccess).toHaveTextContent("Dawn patrol regulars");
    expect(audienceAccess).toHaveTextContent("custom spots");
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

  it("starts the hero media slot on the poster and plays video only after request", () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = jest.fn().mockReturnValue({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });

    try {
      const { container } = render(<QuiverFieldGuideLanding platform="ios" />);
      const media = screen.getByTestId("field-guide-hero-video");

      expect(
        within(media).getByAltText("Quiver app launch video preview"),
      ).toHaveAttribute(
        "src",
        expect.stringContaining("/images/hero/quiver-landing-hero-poster.jpg"),
      );
      expect(
        container.querySelector('[data-testid="field-guide-hero-video"] video'),
      ).toBeNull();

      fireEvent.click(within(media).getByRole("button", { name: "Play demo" }));

      const video = container.querySelector(
        '[data-testid="field-guide-hero-video"] video',
      );
      expect(video).not.toBeNull();
      expect(video).toHaveAttribute(
        "src",
        "/videos/quiver-landing-hero-720.mp4",
      );
      expect(video).not.toHaveAttribute("poster");
      expect(media.querySelector("img")).toHaveAttribute(
        "src",
        expect.stringContaining("/images/hero/quiver-landing-hero-poster.jpg"),
      );
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it("does not render repeated zine masthead rows", () => {
    const { container } = render(<QuiverFieldGuideLanding platform="ios" />);

    expect(container.querySelector(".zine-masthead")).toBeNull();
  });
});
