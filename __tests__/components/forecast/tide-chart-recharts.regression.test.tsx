import React, { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import { TideChart } from "@/components/forecast/tide-chart-recharts";

// Ensure Recharts picks up a non-zero container size under JSDOM
beforeAll(() => {
  // @ts-ignore
  Element.prototype.getBoundingClientRect = function () {
    return {
      width: 800,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 800,
    } as DOMRect;
  };
});

describe("TideChart regression", () => {
  it("handles empty → loaded transitions under StrictMode without React errors", () => {
    const startErrors = (console.error as jest.Mock).mock.calls.length;

    // Use a fixed "now" time for consistent testing
    const now = new Date();

    const { rerender } = render(
      <StrictMode>
        <TideChart data={[]} forecasts={[]} hourly={[]} events={[]} now={now} />
      </StrictMode>
    );

    // Initial empty state
    expect(screen.getByText("Tide Forecast")).toBeInTheDocument();
    expect(screen.getByText("No tide data available")).toBeInTheDocument();

    // Transition to events-based extrema (no hourly line -> synthesize line)
    const events = [
      {
        ts: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString(), // 6 hours from now
        type: "HIGH" as const,
        height_ft: 4.2,
      },
      {
        ts: new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString(), // 12 hours from now
        type: "LOW" as const,
        height_ft: 1.1,
      },
    ];

    rerender(
      <StrictMode>
        <TideChart
          data={[]}
          forecasts={[]}
          hourly={[]}
          events={events}
          now={now}
        />
      </StrictMode>
    );

    // Chart should render (accessible role and label are present)
    expect(
      screen.getByRole("img", { name: /tide forecast/i })
    ).toBeInTheDocument();
    expect(screen.queryByText("No tide data available")).toBeNull();

    // Add hourly series for a second transition to stress reconciliation
    const hourly = [
      {
        ts: new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString(), // 5 hours from now
        height_ft: 3.5,
      },
      {
        ts: new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString(), // 7 hours from now
        height_ft: 4.0,
      },
    ];

    rerender(
      <StrictMode>
        <TideChart
          data={[]}
          forecasts={[]}
          hourly={hourly}
          events={events}
          now={now}
        />
      </StrictMode>
    );

    expect(
      screen.getByRole("img", { name: /tide forecast/i })
    ).toBeInTheDocument();

    // Ensure no React errors were logged during transitions (keys/invariants)
    const newErrors =
      (console.error as jest.Mock).mock.calls.length - startErrors;
    expect(newErrors).toBe(0);
  });
});
