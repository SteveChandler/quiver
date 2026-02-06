import { render, screen } from "@testing-library/react";
import { BeachHeader } from "@/components/beach-detail/beach-header";

// Mock Next.js Link component
jest.mock("next/link", () => {
  return function MockLink({ children, href, ...props }: any) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

describe("BeachHeader", () => {
  it("should render the beach name", () => {
    render(<BeachHeader beachName="Pacific Beach" />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Pacific Beach"
    );
  });

  it("should render the back link to map", () => {
    render(<BeachHeader beachName="Ocean Beach" />);

    const backLink = screen.getByRole("link");
    expect(backLink).toHaveAttribute("href", "/map");
  });

  it("should render the back arrow icon", () => {
    render(<BeachHeader beachName="Mission Beach" />);

    // Check for the presence of the ArrowLeft icon
    const arrowIcon = screen.getByRole("link").querySelector("svg");
    expect(arrowIcon).toBeInTheDocument();
  });

  it("should have proper accessibility attributes", () => {
    render(<BeachHeader beachName="Sunset Cliffs" />);

    const header = screen.getByRole("banner");
    expect(header).toBeInTheDocument();

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toBeInTheDocument();
  });

  it("should apply correct CSS classes", () => {
    render(<BeachHeader beachName="La Jolla Cove" />);

    const header = screen.getByRole("banner");
    expect(header).toHaveClass(
      "sticky",
      "top-0",
      "z-10",
      "bg-background",
      "border-b"
    );

    const container = header.querySelector(".container");
    expect(container).toHaveClass("flex", "items-center", "h-16", "px-4");
  });

  it("should handle long beach names", () => {
    const longBeachName =
      "This is a very long beach name that might cause layout issues";
    render(<BeachHeader beachName={longBeachName} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      longBeachName
    );
  });

  it("should handle empty beach name", () => {
    render(<BeachHeader beachName="" />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Surf Report");
  });

  it("should handle special characters in beach name", () => {
    const specialBeachName = "Côte d'Azur & Beach's Point";
    render(<BeachHeader beachName={specialBeachName} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      specialBeachName
    );
  });

  describe("Responsive behavior", () => {
    it("should maintain layout on different screen sizes", () => {
      render(<BeachHeader beachName="Responsive Beach" />);

      const container = screen.getByRole("banner").querySelector(".container");
      expect(container).toHaveClass("flex", "items-center");

      // The component should use responsive classes
      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveClass("text-xl", "font-bold");
    });
  });

  describe("Integration with navigation", () => {
    it("should provide accessible navigation back to map", () => {
      render(<BeachHeader beachName="Test Beach" />);

      const backLink = screen.getByRole("link");
      expect(backLink).toHaveAttribute("href", "/map");

      // Should be keyboard accessible
      expect(backLink).toHaveAttribute("href");
    });
  });
});
