import { render, screen, within } from "@testing-library/react";
import type React from "react";

import ForecastAccuracyPage, {
  metadata,
} from "@/app/forecast-accuracy/page";
import { AccuracyComparison } from "@/components/forecast-accuracy/accuracy-comparison";
import { AccuracyHero } from "@/components/forecast-accuracy/accuracy-hero";
import { PersonalFitSection } from "@/components/forecast-accuracy/personal-fit-section";
import { SessionOutcomeProof } from "@/components/forecast-accuracy/session-outcome-proof";
import {
  CURATED_ACCURACY,
  CURATED_MATCH,
  CURATED_SESSION_OUTCOME,
} from "@/lib/forecast-accuracy/curated-comparison";

const HERO_HEADING = "The forecast that learns what you like.";

jest.mock("@/components/ui/scroll-reveal", () => ({
  ScrollReveal: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock("@/components/zine/quiver-sticker", () => ({
  QuiverSticker: () => null,
}));

jest.mock("@/components/seo/faq-section", () => ({
  FAQSection: ({ items }: { items: { question: string }[] }) => (
    <div>
      {items.map((item) => (
        <p key={item.question}>{item.question}</p>
      ))}
    </div>
  ),
}));

describe("forecast accuracy page (curated marketing)", () => {
  it("is indexable — no noindex robots directive", () => {
    expect((metadata.robots as any)?.index).not.toBe(false);
    expect(metadata.title).toMatchObject({
      absolute: expect.stringMatching(/Surfline/i),
    });
    expect(metadata.title).toMatchObject({
      absolute: expect.stringMatching(/NOAA/i),
    });
  });

  it("renders the curated page with the 3-way comparison and the claim", () => {
    render(<ForecastAccuracyPage />);

    // All three contenders appear.
    expect(screen.getAllByText("Quiver").length).toBeGreaterThan(0);
    expect(screen.getByText("Surfline")).toBeInTheDocument();
    expect(screen.getByText("NOAA")).toBeInTheDocument();

    // The headline ad claim and the vs-NOAA number.
    expect(
      screen.getByRole("heading", { name: HERO_HEADING }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(`${CURATED_ACCURACY.vsNoaaImprovementPct}%`).length,
    ).toBeGreaterThan(0);

    // Personalization leads: the match concordance number is on the page.
    expect(
      screen.getAllByText(`${CURATED_MATCH.concordancePct}%`).length,
    ).toBeGreaterThan(0);

    expect(
      screen.getByRole("heading", {
        name: /Tighter than Surfline\. 100% good sessions at three breaks\./i,
      }),
    ).toBeInTheDocument();

    // The Surfline head-to-head FAQ is present.
    expect(
      screen.getByText("Is Quiver really more accurate than Surfline?"),
    ).toBeInTheDocument();
  });

  it("leads with the personalization story and the real match number", () => {
    render(<PersonalFitSection />);

    expect(
      screen.getByRole("heading", { name: /Quiver rates/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(`${CURATED_MATCH.concordancePct}%`)).toBeInTheDocument();
    expect(screen.getByText(/agreement on which day was better/i)).toBeInTheDocument();
  });

  it("marks Quiver as the winner in the comparison and shows MAE values", () => {
    const { container } = render(<AccuracyComparison />);
    const section = within(container);

    expect(section.getByText("WINNER")).toBeInTheDocument();
    expect(section.getByText("0.30m")).toBeInTheDocument();
    expect(section.getByText("0.35m")).toBeInTheDocument();
    expect(section.getByText("0.67m")).toBeInTheDocument();
  });

  it("separates the Surfline accuracy win from the dated session outcome", () => {
    const { container } = render(<SessionOutcomeProof />);
    const section = within(container);

    expect(section.getByText("Quiver average miss")).toBeInTheDocument();
    expect(section.getByText(/Surfline: 0\.35m/i)).toBeInTheDocument();
    expect(section.getByText("100%")).toBeInTheDocument();
    for (const beach of CURATED_SESSION_OUTCOME.beaches) {
      expect(section.getByText(beach.name)).toBeInTheDocument();
    }
    expect(
      section.queryByText(/followed a recommendation/i),
    ).not.toBeInTheDocument();
  });

  it("hero is self-contained and reads curated credibility stats", () => {
    render(<AccuracyHero />);

    expect(
      screen.getByRole("heading", { name: HERO_HEADING }),
    ).toBeInTheDocument();
    expect(screen.getByText("Beaches tracked")).toBeInTheDocument();
    expect(screen.getByText("Buoy readings")).toBeInTheDocument();
    // No building / confidence language leaks in.
    expect(screen.queryByText(/building/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Model only/i)).not.toBeInTheDocument();
  });
});
