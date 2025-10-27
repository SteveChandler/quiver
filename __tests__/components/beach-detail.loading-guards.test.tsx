jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: jest.fn(),
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
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { BeachDetail } from "@/components/beach-detail";

// Helper to mock useDataFetcher for all calls (beach, forecasts, sources, photos)
function mockDataFetcherSequence(
  states: Array<{ data: any; loading: boolean; error: string | null }>
) {
  const fn = useDataFetcher as unknown as jest.Mock;
  fn.mockReset();
  const wrap = (s: any) => ({
    ...s,
    refetch: jest.fn(),
    retry: jest.fn(),
    reset: jest.fn(),
  });
  const beachState = states[0] || { data: null, loading: false, error: null };
  const forecastsState = states[1] || { data: [], loading: false, error: null };
  const sourcesState = states[2] || { data: null, loading: false, error: null };
  const photosState = states[3] || { data: [], loading: false, error: null };
  const coerceArray = (d: any) => (Array.isArray(d) ? d : []);
  const normalizedBeach = { ...beachState, data: beachState?.data };
  const normalizedForecasts = {
    ...forecastsState,
    data: coerceArray(forecastsState?.data),
  };
  const normalizedSources = {
    ...sourcesState,
    data: sourcesState?.data,
  };
  const normalizedPhotos = {
    ...photosState,
    data: coerceArray(photosState?.data),
  };
  let call = 0;
  fn.mockImplementation(() => {
    const idx = call % 4; // beach, forecasts, sources, photos (repeat)
    call += 1;
    const state =
      idx === 0
        ? normalizedBeach
        : idx === 1
        ? normalizedForecasts
        : idx === 2
        ? normalizedSources
        : normalizedPhotos;
    return wrap(state);
  });
  return fn;
}

describe("BeachDetail loading and error guards", () => {
  afterEach(() => {
    // Keep module mocks from jest.setup.js (e.g., useAuth) intact
    jest.clearAllMocks();
  });

  it("shows loader while loading and not error", () => {
    const spy = mockDataFetcherSequence([
      { data: null, loading: true, error: null }, // beach
      { data: [], loading: true, error: null }, // forecasts
      { data: null, loading: false, error: null }, // sources
      { data: [], loading: false, error: null }, // photos
    ]);

    render(<BeachDetail id="beach-1" />);

    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    expect(screen.queryByText(/Beach data not found/i)).not.toBeInTheDocument();
    expect(spy).toHaveBeenCalled();
  });

  it("shows error when finished loading and beach missing", () => {
    const spy = mockDataFetcherSequence([
      { data: null, loading: false, error: "Failed" }, // beach
      { data: [], loading: false, error: null }, // forecasts
      { data: null, loading: false, error: null }, // sources
      { data: [], loading: false, error: null }, // photos
    ]);

    render(<BeachDetail id="beach-1" />);

    // Assert the error UI by its recovery CTA for stability
    expect(
      screen.getByRole("button", { name: /Back to Map/i })
    ).toBeInTheDocument();
    expect(spy).toHaveBeenCalled();
  });

  it("renders when beach exists even if forecasts empty", () => {
    const spy = mockDataFetcherSequence([
      {
        data: { id: "beach-1", name: "Test Beach", lat: 0, lon: 0 },
        loading: false,
        error: null,
      }, // beach
      { data: [], loading: false, error: null }, // forecasts
      { data: null, loading: false, error: null }, // sources
      { data: [], loading: false, error: null }, // photos
    ]);

    render(<BeachDetail id="beach-1" />);

    // Assert the beach name is rendered to confirm content is present
    expect(
      screen.getByRole("heading", { name: "Test Beach" })
    ).toBeInTheDocument();
    expect(screen.queryByText(/Beach data not found/i)).not.toBeInTheDocument();
    expect(spy).toHaveBeenCalled();
  });
});
