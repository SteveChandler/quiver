import { render, screen } from "@testing-library/react";
import { HeroCard } from "@/components/ui/hero-card";

describe("HeroCard", () => {
  it("renders children", () => {
    render(
      <HeroCard>
        <p>Wave height: 4 ft</p>
      </HeroCard>
    );

    expect(screen.getByText("Wave height: 4 ft")).toBeInTheDocument();
  });

  it("renders attribution when provided", () => {
    render(
      <HeroCard attribution="NOAA tide data via Scripps Pier">
        <p>Content</p>
      </HeroCard>
    );

    expect(
      screen.getByText("NOAA tide data via Scripps Pier")
    ).toBeInTheDocument();
  });

  it("does not render attribution element when omitted", () => {
    render(
      <HeroCard>
        <p>Content</p>
      </HeroCard>
    );

    // Only one paragraph — the children
    const paragraphs = screen.getAllByRole("paragraph").length;
    expect(paragraphs).toBe(1);
  });

  it("applies gradient and border classes to the section element", () => {
    const { container } = render(
      <HeroCard
        gradient="from-white/80 to-cyan-50/60"
        borderColor="border-cyan-200/50"
      >
        <p>Content</p>
      </HeroCard>
    );

    const section = container.querySelector("section");
    expect(section).toHaveClass("from-white/80");
    expect(section).toHaveClass("to-cyan-50/60");
    expect(section).toHaveClass("border-cyan-200/50");
  });

  it("forwards aria-label to the section element", () => {
    render(
      <HeroCard aria-label="Current tide conditions">
        <p>Content</p>
      </HeroCard>
    );

    expect(
      screen.getByRole("region", { name: "Current tide conditions" })
    ).toBeInTheDocument();
  });

  it("applies data-testid to the section element", () => {
    const { container } = render(
      <HeroCard data-testid="tide-hero-card">
        <p>Content</p>
      </HeroCard>
    );

    expect(container.querySelector("[data-testid='tide-hero-card']")).toBeInTheDocument();
  });

  it("merges custom className with base classes", () => {
    const { container } = render(
      <HeroCard className="custom-spacing">
        <p>Content</p>
      </HeroCard>
    );

    const section = container.querySelector("section");
    expect(section).toHaveClass("custom-spacing");
    expect(section).toHaveClass("rounded-2xl");
    expect(section).toHaveClass("shadow-lg");
  });
});
