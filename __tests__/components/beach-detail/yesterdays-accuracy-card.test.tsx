import { render, screen } from "@testing-library/react";
import { YesterdaysAccuracyCard } from "@/components/beach-detail/yesterdays-accuracy-card";
import type { YesterdayAccuracy } from "@/types/accuracy";

const mockAccuracy: YesterdayAccuracy = {
  beach_id: "test-id",
  forecast_date: "2026-02-15",
  avg_predicted_m: 1.0, // ~3.3 ft
  avg_observed_m: 0.91, // ~3.0 ft
  mae_m: 0.09,
  relative_error_pct: 10.0,
  observation_count: 8,
  should_display: true,
};

describe("YesterdaysAccuracyCard", () => {
  test("renders with correct data-testid", () => {
    render(<YesterdaysAccuracyCard accuracy={mockAccuracy} />);
    expect(screen.getByTestId("yesterdays-accuracy-card")).toBeInTheDocument();
  });

  test("shows predicted height in feet", () => {
    render(<YesterdaysAccuracyCard accuracy={mockAccuracy} />);
    // 1.0m * 3.28084 ≈ 3.3 ft
    expect(screen.getByText(/3\.3/)).toBeInTheDocument();
  });

  test("shows actual height in feet", () => {
    render(<YesterdaysAccuracyCard accuracy={mockAccuracy} />);
    // 0.91m * 3.28084 ≈ 3.0 ft
    expect(screen.getByText(/3\.0/)).toBeInTheDocument();
  });

  test("shows accuracy percentage", () => {
    render(<YesterdaysAccuracyCard accuracy={mockAccuracy} />);
    // 100 - 10.0 = 90%
    expect(screen.getByText(/90%/)).toBeInTheDocument();
  });

  test("shows observation count", () => {
    render(<YesterdaysAccuracyCard accuracy={mockAccuracy} />);
    expect(screen.getByText(/8/)).toBeInTheDocument();
    expect(screen.getByText(/observation/i)).toBeInTheDocument();
  });

  test("shows formatted date", () => {
    render(<YesterdaysAccuracyCard accuracy={mockAccuracy} />);
    expect(screen.getByText(/Feb 15/)).toBeInTheDocument();
  });

  test("shows green color for high accuracy (>=75%)", () => {
    const highAccuracy = { ...mockAccuracy, relative_error_pct: 10 };
    const { container } = render(
      <YesterdaysAccuracyCard accuracy={highAccuracy} />
    );
    // 90% accuracy -> green
    const progressBar = container.querySelector(
      "[data-testid='accuracy-bar']"
    );
    expect(progressBar).toHaveClass("bg-emerald-500");
  });

  test("shows yellow color for medium accuracy (50-75%)", () => {
    const medAccuracy = { ...mockAccuracy, relative_error_pct: 40 };
    const { container } = render(
      <YesterdaysAccuracyCard accuracy={medAccuracy} />
    );
    // 60% accuracy -> yellow
    const progressBar = container.querySelector(
      "[data-testid='accuracy-bar']"
    );
    expect(progressBar).toHaveClass("bg-amber-500");
  });

  test("shows red color for low accuracy (<50%)", () => {
    const lowAccuracy = { ...mockAccuracy, relative_error_pct: 60 };
    const { container } = render(
      <YesterdaysAccuracyCard accuracy={lowAccuracy} />
    );
    // 40% accuracy -> red
    const progressBar = container.querySelector(
      "[data-testid='accuracy-bar']"
    );
    expect(progressBar).toHaveClass("bg-red-500");
  });

  test("applies custom className", () => {
    render(
      <YesterdaysAccuracyCard accuracy={mockAccuracy} className="mt-4" />
    );
    const card = screen.getByTestId("yesterdays-accuracy-card");
    expect(card.className).toContain("mt-4");
  });

  test("renders singular 'observation' for count of 1", () => {
    const singleObs = { ...mockAccuracy, observation_count: 1 };
    render(<YesterdaysAccuracyCard accuracy={singleObs} />);
    expect(screen.getByText(/1 buoy observation$/)).toBeInTheDocument();
  });

  test("clamps accuracy to 0 when relative_error_pct > 100", () => {
    const terrible = { ...mockAccuracy, relative_error_pct: 150 };
    render(<YesterdaysAccuracyCard accuracy={terrible} />);
    expect(screen.getByText(/0%/)).toBeInTheDocument();
  });

  test("clamps accuracy to 100 when relative_error_pct < 0", () => {
    const perfect = { ...mockAccuracy, relative_error_pct: -5 };
    render(<YesterdaysAccuracyCard accuracy={perfect} />);
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  test("renders the card header with icon and title", () => {
    const { container } = render(
      <YesterdaysAccuracyCard accuracy={mockAccuracy} />
    );
    expect(
      screen.getByText("Yesterday\u2019s Accuracy")
    ).toBeInTheDocument();
    // CheckCircle icon should be present
    const icon = container.querySelector("svg");
    expect(icon).toBeInTheDocument();
  });

  test("renders section element", () => {
    render(<YesterdaysAccuracyCard accuracy={mockAccuracy} />);
    const card = screen.getByTestId("yesterdays-accuracy-card");
    expect(card.tagName).toBe("SECTION");
  });
});
