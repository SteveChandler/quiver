import React from "react";
import { render, screen } from "@testing-library/react";
import { ForecastAndTides } from "@/components/beach-detail/forecast-and-tides";

// Mock Best Times API and RPC to avoid network/DB dependencies
jest.mock("@/lib/bestTimes", () => ({
  fetchBestTimesApi: jest.fn(async () => ({
    windows: [
      {
        start_ts: new Date().toISOString(),
        end_ts: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
        grade: "Good",
        score: 65,
      },
    ],
  })),
  fetchBestTimes: jest.fn(async () => ({ data: [], error: null })),
}));

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
  it("renders without throwing and shows Best Times header", () => {
    const beach = { id: "beach-uuid", name: "Test Beach" } as any;
    const forecasts: any[] = [];

    render(<ForecastAndTides beach={beach} forecasts={forecasts} />);

    // Static header text from the component
    expect(screen.getByText("Best Times")).toBeInTheDocument();
  });
});
