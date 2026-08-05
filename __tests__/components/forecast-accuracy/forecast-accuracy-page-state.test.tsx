import { render, screen, within } from "@testing-library/react";
import type React from "react";

import ForecastAccuracyPage, { metadata } from "@/app/forecast-accuracy/page";
import { AccuracyComparison } from "@/components/forecast-accuracy/accuracy-comparison";
import { AccuracyHero } from "@/components/forecast-accuracy/accuracy-hero";

const HERO_HEADING = "How to judge a surf forecast.";

jest.mock("@/components/ui/scroll-reveal", () => ({
  ScrollReveal: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock("@/components/zine/quiver-sticker", () => ({
  QuiverSticker: () => null,
}));

jest.mock("@/components/seo/faq-section", () => ({
  FAQSection: ({
    items,
  }: {
    items: { question: string; answer: string }[];
  }) => (
    <div>
      {items.map((item) => (
        <div key={item.question}>
          <p>{item.question}</p>
          <p>{item.answer}</p>
        </div>
      ))}
    </div>
  ),
}));

describe("forecast accuracy methodology page", () => {
  it("stays indexable without ranking metadata", () => {
    expect(
      (metadata.robots as { index?: boolean } | undefined)?.index,
    ).not.toBe(false);
    expect(metadata.title).toBe("How Surf Forecast Accuracy Is Measured");
    expect(metadata.description).toContain("no forecast accuracy ranking");
    expect(metadata.description).not.toMatch(/beats|more accurate/i);
  });

  it("renders the methodology and states the comparison limit", () => {
    render(<ForecastAccuracyPage />);

    expect(
      screen.getByRole("heading", { name: HERO_HEADING }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Offshore wave height is not breaking face height.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Measure the same thing on the same sample.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/No same-sample comparison/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText("Does Quiver claim an accuracy ranking over Surfline?"),
    ).toBeInTheDocument();
  });

  it("explains the two wave-height definitions without a winner bar", () => {
    const { container } = render(<AccuracyComparison />);
    const section = within(container);

    expect(
      section.getByText("Significant wave height offshore"),
    ).toBeInTheDocument();
    expect(
      section.getByText("Breaking face height at the beach"),
    ).toBeInTheDocument();
    expect(section.queryByText(/winner|lowest error/i)).not.toBeInTheDocument();
  });

  it("keeps the no-ranking statement in the hero", () => {
    render(<AccuracyHero />);

    expect(
      screen.getByRole("heading", { name: HERO_HEADING }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No same-sample comparison. No accuracy ranking."),
    ).toBeInTheDocument();
  });

  it("does not render the retired comparison metrics", () => {
    render(<ForecastAccuracyPage />);

    expect(screen.queryByText("0.30m")).not.toBeInTheDocument();
    expect(screen.queryByText("0.35m")).not.toBeInTheDocument();
    expect(screen.queryByText("0.67m")).not.toBeInTheDocument();
    expect(screen.queryByText("55%")).not.toBeInTheDocument();
    expect(screen.queryByText("WINNER")).not.toBeInTheDocument();
  });
});
