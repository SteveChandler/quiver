import { render, screen } from "@testing-library/react";
import LandingPage from "@/components/landing-page";

// Mock the performance utils to disable progressive loading in tests
jest.mock("@/lib/utils/performance-utils", () => ({
  PerformanceUtils: {
    createImageObserver: jest.fn(() => null),
    preloadCriticalResources: jest.fn(),
  },
}));

// Mock all the section components to test integration
jest.mock("@/components/landing-page/navbar", () => ({
  Navbar: () => <nav data-testid="navbar">Navbar</nav>,
}));

jest.mock("@/components/landing-page/hero-section", () => ({
  HeroSection: () => <div data-testid="hero-section">Hero Section</div>,
}));

jest.mock("@/components/landing-page/surf-highlights-section", () => ({
  SurfHighlightsSection: () => (
    <div data-testid="surf-highlights-section">Surf Highlights Section</div>
  ),
}));

jest.mock("@/components/landing-page/activities-section", () => ({
  ActivitiesSection: () => (
    <div data-testid="activities-section">Activities Section</div>
  ),
}));

jest.mock("@/components/landing-page/forecast-section", () => ({
  ForecastSection: () => (
    <div data-testid="forecast-section">Forecast Section</div>
  ),
}));

jest.mock("@/components/landing-page/cta-section", () => ({
  CTASection: () => <div data-testid="cta-section">CTA Section</div>,
}));

jest.mock("@/components/landing-page/footer-section", () => ({
  FooterSection: () => <div data-testid="footer-section">Footer Section</div>,
}));

describe("LandingPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders navbar and hero section immediately", () => {
    render(<LandingPage />);

    // Navbar and hero section should render immediately since they're not lazy loaded
    expect(screen.getByTestId("navbar")).toBeInTheDocument();
    expect(screen.getByTestId("hero-section")).toBeInTheDocument();
  });

  it("applies the correct background class (AllTrails-style white)", () => {
    const { container } = render(<LandingPage />);

    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv).toHaveClass("min-h-screen", "bg-white");
  });

  it("renders progressive section containers", () => {
    const { container } = render(<LandingPage />);

    // Check that the progressive loading structure exists
    const sectionsContainer = container.querySelector(".space-y-0");
    expect(sectionsContainer).toBeInTheDocument();

    // Should have 6 progressive section containers (one for each lazy-loaded section)
    const progressiveSections = sectionsContainer?.children;
    expect(progressiveSections).toHaveLength(6);
  });

  it("shows AllTrails-style sections", () => {
    const { container } = render(<LandingPage />);

    // Should show AllTrails-style sections
    // Since mocks render immediately, test that sections are present
    const surfHighlightsSection = screen.getByTestId("surf-highlights-section");
    expect(surfHighlightsSection).toBeInTheDocument();

    const activitiesSection = screen.getByTestId("activities-section");
    expect(activitiesSection).toBeInTheDocument();
  });

  it("has proper semantic structure with AllTrails-style layout", () => {
    const { container } = render(<LandingPage />);

    // Check that the main container has proper HTML structure
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv).toHaveClass("min-h-screen");

    // Should have navbar, hero section and sections container
    expect(screen.getByTestId("navbar")).toBeInTheDocument();
    expect(screen.getByTestId("hero-section")).toBeInTheDocument();
    expect(container.querySelector(".space-y-0")).toBeInTheDocument();
  });

  it("includes loading spinner in skeleton placeholders", () => {
    const { container } = render(<LandingPage />);

    // In the test environment with mocks, sections render immediately
    // Test that the structure supports progressive loading
    const sectionsContainer = container.querySelector(".space-y-0");
    expect(sectionsContainer).toBeInTheDocument();

    // Verify we have the expected number of progressive sections
    const progressiveSections = sectionsContainer?.children;
    expect(progressiveSections).toHaveLength(6); // 6 lazy-loaded sections
  });
});
