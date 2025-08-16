import React from "react";
import { render, screen } from "@testing-library/react";
import { ForecastAndTides } from "@/components/beach-detail/forecast-and-tides";

// Stub Supabase client (unused when API path succeeds, but safe to mock)
jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: () => ({
            lt: () => ({
              order: () => ({
                limit: () => ({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }),
    }),
  })),
}));

// Light stubs for heavy child components to keep this a true smoke test
jest.mock("@/components/beaches-enhanced-forecast", () => ({
  BeachesEnhancedForecast: ({ beachName }: any) => (
    <div data-testid="beaches-enhanced-forecast">{beachName}</div>
  ),
}));

jest.mock("@/components/forecast/tide-chart-recharts", () => ({
  TideChart: () => <div data-testid="tide-chart" />,
}));

describe("ForecastAndTides (smoke)", () => {
  it("renders without throwing and shows Coach Pick card", () => {
    const beach = { id: "beach-uuid", name: "Test Beach" } as any;
    const forecasts: any[] = [];

    render(<ForecastAndTides beach={beach} forecasts={forecasts} />);

    // Coach Pick rendered (title text)
    expect(screen.getByText(/Coach Pick/i)).toBeInTheDocument();
  });
});
