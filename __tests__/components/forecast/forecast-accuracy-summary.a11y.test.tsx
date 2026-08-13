import { render, screen } from "@testing-library/react";
import { ForecastAccuracySummary } from "@/components/forecast/forecast-accuracy-summary";

describe("ForecastAccuracySummary accessibility", () => {
  it("gives the refresh control an accessible name and hides its icon", () => {
    render(
      <ForecastAccuracySummary
        data={{ totalSessions: 1, avgAccuracy: 80, topBeaches: [] }}
        onRefresh={jest.fn()}
      />,
    );

    const refreshButton = screen.getByRole("button", {
      name: "Refresh forecast accuracy",
    });

    expect(refreshButton).toBeInTheDocument();
    expect(refreshButton.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
