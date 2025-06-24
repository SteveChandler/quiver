import { render, screen } from "@testing-library/react";
import { SectionWrapper } from "@/components/landing-page/section-wrapper";

// Mock framer-motion to avoid animation issues in tests
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

describe("SectionWrapper", () => {
  it("renders children correctly", () => {
    render(
      <SectionWrapper>
        <div>Test content</div>
      </SectionWrapper>
    );

    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("renders title and subtitle when provided", () => {
    render(
      <SectionWrapper title="Test Title" subtitle="Test subtitle description">
        <div>Content</div>
      </SectionWrapper>
    );

    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test subtitle description")).toBeInTheDocument();
  });

  it("renders without title and subtitle when not provided", () => {
    render(
      <SectionWrapper>
        <div>Content only</div>
      </SectionWrapper>
    );

    expect(screen.getByText("Content only")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <SectionWrapper className="custom-class py-10">
        <div>Content</div>
      </SectionWrapper>
    );

    const section = container.querySelector("section");
    expect(section).toHaveClass("custom-class", "py-10");
  });

  it("applies center content styling when centerContent is true", () => {
    render(
      <SectionWrapper title="Centered Title" centerContent={true}>
        <div>Content</div>
      </SectionWrapper>
    );

    const titleContainer = screen.getByText("Centered Title").closest("div");
    expect(titleContainer).toHaveClass("text-center");
  });

  it("applies custom title and subtitle classes", () => {
    render(
      <SectionWrapper
        title="Custom Title"
        subtitle="Custom Subtitle"
        titleClassName="custom-title-class"
        subtitleClassName="custom-subtitle-class"
      >
        <div>Content</div>
      </SectionWrapper>
    );

    const title = screen.getByText("Custom Title");
    const subtitle = screen.getByText("Custom Subtitle");

    expect(title).toHaveClass("custom-title-class");
    expect(subtitle).toHaveClass("custom-subtitle-class");
  });

  it("applies correct max-width container class", () => {
    const { container } = render(
      <SectionWrapper maxWidth="4xl">
        <div>Content</div>
      </SectionWrapper>
    );

    const innerDiv = container.querySelector(".max-w-4xl");
    expect(innerDiv).toBeInTheDocument();
  });
});
