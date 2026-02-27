import React from "react";
import { render, screen } from "@testing-library/react";
import { SpotOverview } from "@/components/beach-detail/spot-overview";
import { ForecastAndTides } from "@/components/beach-detail/forecast-and-tides";

jest.mock("@/actions/beach-media-actions", () => ({
  getBestBeachPhotosAction: jest.fn(async () => ({ success: true, data: [] })),
}));

jest.mock("@/actions/beach-calibration-actions", () => ({
  getLatestBeachCalibrationAction: jest.fn(async () => ({
    success: true,
    data: null,
  })),
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

describe("SpotOverview (smoke)", () => {
  it("renders Spot Summary without throwing", () => {
    const beach = {
      id: "beach-uuid",
      name: "Test Beach",
      break_type: "Beach Break",
      best_swell_cardinals: ["SW"],
      swell_window_min_deg: null,
      swell_window_max_deg: null,
      wind_offshore_deg: null,
      wind_offshore_tol_deg: null,
      preferred_tide_ft_min: null,
      preferred_tide_ft_max: null,
    } as any;

    render(<SpotOverview beach={beach} />);

    expect(screen.getByText("Spot Summary")).toBeInTheDocument();
  });
});

describe("ForecastAndTides (smoke)", () => {
  it("renders without throwing and shows chips header", () => {
    // BestSurfWindow fetches intel via the client data gateway; mock it to avoid network errors.
    const originalFetch = global.fetch;
    (global as any).fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { intel: null } }),
    }));

    const beach = {
      id: "beach-uuid",
      name: "Test Beach",
      lat: 32.7,
      lon: -117.2,
    } as any;
    const forecasts: any[] = [];

    render(<ForecastAndTides beach={beach} forecasts={forecasts} />);

    // Heuristic: chips/header present
    expect(
      screen.getByText(/Sunrise\/Sunset shown in charts/i)
    ).toBeInTheDocument();

    (global as any).fetch = originalFetch;
  });
});
