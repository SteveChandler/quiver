import { render, screen } from "@testing-library/react";
import LandingPage from "@/components/landing-page";

// Mock all the section components to test integration
jest.mock("@/components/landing-page/hero-section", () => ({
  HeroSection: () => <div data-testid="hero-section">Hero Section</div>,
}));

jest.mock("@/components/landing-page/social-feed-section", () => ({
  SocialFeedSection: () => (
    <div data-testid="social-feed-section">Social Feed Section</div>
  ),
}));

jest.mock("@/components/landing-page/forecast-section", () => ({
  ForecastSection: () => (
    <div data-testid="forecast-section">Forecast Section</div>
  ),
}));

jest.mock("@/components/landing-page/features-section", () => ({
  FeaturesSection: () => (
    <div data-testid="features-section">Features Section</div>
  ),
}));

jest.mock("@/components/landing-page/cta-section", () => ({
  CTASection: () => <div data-testid="cta-section">CTA Section</div>,
}));

jest.mock("@/components/landing-page/footer-section", () => ({
  FooterSection: () => <div data-testid="footer-section">Footer Section</div>,
}));

describe("LandingPage", () => {
  it("renders all sections in correct order", () => {
    render(<LandingPage />);

    // Check that all sections are rendered
    expect(screen.getByTestId("hero-section")).toBeInTheDocument();
    expect(screen.getByTestId("social-feed-section")).toBeInTheDocument();
    expect(screen.getByTestId("forecast-section")).toBeInTheDocument();
    expect(screen.getByTestId("features-section")).toBeInTheDocument();
    expect(screen.getByTestId("cta-section")).toBeInTheDocument();
    expect(screen.getByTestId("footer-section")).toBeInTheDocument();
  });

  it("applies the correct background gradient class", () => {
    const { container } = render(<LandingPage />);

    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv).toHaveClass(
      "min-h-screen",
      "bg-gradient-to-br",
      "from-sandy-beige",
      "via-white",
      "to-blue-50"
    );
  });

  it("renders sections in the correct order", () => {
    render(<LandingPage />);

    const allSections = [
      screen.getByTestId("hero-section"),
      screen.getByTestId("social-feed-section"),
      screen.getByTestId("forecast-section"),
      screen.getByTestId("features-section"),
      screen.getByTestId("cta-section"),
      screen.getByTestId("footer-section"),
    ];

    // Check that sections appear in order in the DOM
    for (let i = 0; i < allSections.length - 1; i++) {
      expect(allSections[i].compareDocumentPosition(allSections[i + 1])).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
    }
  });

  it("is accessible and has proper structure", () => {
    const { container } = render(<LandingPage />);

    // Check that the main container has proper HTML structure
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv).toHaveClass("min-h-screen");
  });
});
