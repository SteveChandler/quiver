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

    const { rerender } = render(
      <StrictMode>
        <TideChart data={[]} forecasts={[]} hourly={[]} events={[]} />
      </StrictMode>
    );

    // Initial empty state
    expect(screen.getByText("5-Day Tide Chart")).toBeInTheDocument();
    expect(screen.getByText("No tide data available")).toBeInTheDocument();

    // Transition to events-based extrema (no hourly line -> synthesize line)
    const now = new Date();
    const events = [
      {
        ts: new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          6,
          0,
          0
        ).toISOString(),
        type: "HIGH" as const,
        height_ft: 4.2,
      },
      {
        ts: new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          12,
          0,
          0
        ).toISOString(),
        type: "LOW" as const,
        height_ft: 1.1,
      },
    ];

    rerender(
      <StrictMode>
        <TideChart data={[]} forecasts={[]} hourly={[]} events={events} />
      </StrictMode>
    );

    // Chart should render (accessible role and label are present)
    expect(
      screen.getByRole("img", { name: /tide chart/i })
    ).toBeInTheDocument();
    expect(screen.queryByText("No tide data available")).toBeNull();

    // Add hourly series for a second transition to stress reconciliation
    const hourly = [
      {
        ts: new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          5,
          0,
          0
        ).toISOString(),
        height_ft: 3.5,
      },
      {
        ts: new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          7,
          0,
          0
        ).toISOString(),
        height_ft: 4.0,
      },
    ];

    rerender(
      <StrictMode>
        <TideChart data={[]} forecasts={[]} hourly={hourly} events={events} />
      </StrictMode>
    );

    expect(
      screen.getByRole("img", { name: /tide chart/i })
    ).toBeInTheDocument();

    // Ensure no React errors were logged during transitions (keys/invariants)
    const newErrors =
      (console.error as jest.Mock).mock.calls.length - startErrors;
    expect(newErrors).toBe(0);
  });
});
