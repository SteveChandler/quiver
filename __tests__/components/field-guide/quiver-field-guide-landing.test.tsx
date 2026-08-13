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
    expect(screen.queryByTestId("field-guide-spotlight")).not.toBeInTheDocument();
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
      screen.getByRole("heading", {
        level: 1,
        name: "Know where to paddle out before dawn.",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
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
    expect(
      within(hero).getByRole("link", { name: "Watch demo" }),
    ).toHaveClass("underline");
    expect(
      within(hero).getByRole("link", { name: "Watch demo" }),
    ).not.toHaveClass("border-2");
    expect(
      within(hero).getByTestId("field-guide-hero-primary-cta"),
    ).toHaveClass("bg-[#F78E42]");
    expect(screen.getByTestId("funnel-cta")).toBeInTheDocument();
  });

  it("renders the ordered How Quiver works steps and a real product decision", () => {
    render(<QuiverFieldGuideLanding platform="ios" />);

    expect(
      screen.getByRole("heading", {
        name: /turn a forecast into a surf plan/i,
      }),
    ).toBeInTheDocument();
    const walkthrough = screen.getByTestId("field-guide-walkthrough");
    const steps = within(walkthrough).getByTestId(
      "field-guide-walkthrough-steps",
    );
    expect(steps.tagName).toBe("OL");
    expect(within(steps).getAllByRole("listitem")).toHaveLength(4);
    expect(within(steps).getByText("Save your home break.")).toBeInTheDocument();
    expect(within(steps).getByText("Add the boards in your quiver.")).toBeInTheDocument();
    expect(within(steps).getByText("Get one call for the window.")).toBeInTheDocument();
    expect(within(steps).getByText("Log what happened in the water.")).toBeInTheDocument();
    expect(
      within(walkthrough).getByAltText(/5:00 PM best window/i),
    ).toHaveAttribute("src", expect.stringContaining("surf-call-720.webp"));
    expect(walkthrough).toHaveTextContent("Worth it");
  });

  it("renders community testimonials from real surfer feedback", () => {
    render(<QuiverFieldGuideLanding platform="ios" />);

    const community = screen.getByTestId("field-guide-community");
    expect(
      within(community).getByRole("heading", {
        name: /what surfers told us/i,
      }),
    ).toBeInTheDocument();
    expect(community).toHaveTextContent(/shared with us by email/i);
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
        name: /one surf app\. go pro when it’s time to lock in/i,
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

  it("keeps the hero media on the poster until request and exposes native controls", () => {
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
      expect(video).toHaveAttribute("controls");
      expect(video).not.toHaveAttribute("poster");
      expect(within(media).getByText("App preview")).toBeInTheDocument();
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
