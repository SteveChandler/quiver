jest.mock("@/hooks/use-beach-detail-data", () => ({
  useBeachDetailData: jest.fn(),
}));
jest.mock("@/hooks/use-forecast-calibration", () => ({
  useForecastCalibration: () => ({ sessionSnapshots: [] }),
}));
jest.mock("@/hooks/use-intel-data", () => ({
  useIntelData: () => ({
    data: { posts: [] },
    posts: [],
    loading: false,
    error: null,
    hasData: false,
    refetch: jest.fn(),
    updateFilters: jest.fn(),
  }),
  useNearbyIntelData: () => ({
    data: { posts: [] },
    posts: [],
    loading: false,
    error: null,
    hasData: false,
    refetch: jest.fn(),
    updateFilters: jest.fn(),
  }),
}));
jest.mock("@/components/favorite-button", () => ({
  FavoriteButton: () => <button data-testid="favorite-mock" />,
}));
jest.mock("@/components/home/HomeBeachBanner", () => ({
  HomeBeachBanner: () => <div data-testid="home-beach-banner" />,
}));

import React from "react";
import { render, screen } from "@testing-library/react";
import { useBeachDetailData } from "@/hooks/use-beach-detail-data";
import { BeachDetail } from "@/components/beach-detail";

// Helper to mock useBeachDetailData
function mockBeachDetailData(
  beach: any,
  loading: boolean,
  error: string | null
) {
  const fn = useBeachDetailData as unknown as jest.Mock;
  fn.mockReturnValue({
    beach: beach || null,
    forecasts: [],
    sources: null,
    loading,
    errors: {
      beach: error,
      forecasts: null,
      sources: null,
    },
    refetch: jest.fn(),
  });
  return fn;
}

describe("BeachDetail loading and error guards", () => {
  afterEach(() => {
    // Keep module mocks from jest.setup.js (e.g., useAuth) intact
    jest.clearAllMocks();
  });

  it("shows loader while loading and not error", () => {
    const spy = mockBeachDetailData(null, true, null);

    render(<BeachDetail id="beach-1" />);

    expect(screen.getByText(/Checking the lineup/i)).toBeInTheDocument();
    expect(screen.queryByText(/Beach data not found/i)).not.toBeInTheDocument();
    expect(spy).toHaveBeenCalled();
  });

  it("shows error when finished loading and beach missing", () => {
    const spy = mockBeachDetailData(null, false, "Failed");

    render(<BeachDetail id="beach-1" />);

    // Assert the error UI by its recovery CTA for stability
    expect(
      screen.getByRole("button", { name: /Back to Map/i })
    ).toBeInTheDocument();
    expect(spy).toHaveBeenCalled();
  });

  it("renders when beach exists even if forecasts empty", () => {
    const beach = {
      id: "beach-1",
      name: "Test Beach",
      lat: 0,
      lon: 0,
      city: "Test City",
      state: "CA",
      country: "USA",
      break_type: "Beach Break",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    };
    const spy = mockBeachDetailData(beach, false, null);

    render(<BeachDetail id="beach-1" />);

    // Assert the beach name is rendered to confirm content is present
    expect(
      screen.getByRole("heading", { name: "Test Beach Surf Report" })
    ).toBeInTheDocument();
    expect(screen.queryByText(/Beach data not found/i)).not.toBeInTheDocument();
    expect(spy).toHaveBeenCalled();
  });
});
